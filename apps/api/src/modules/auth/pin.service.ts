import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common'
import * as bcrypt from 'bcryptjs'
import { PrismaService } from '../../prisma/prisma.service'
import { NotificationsService } from '../notifications/notifications.service'

/**
 * PIN de 6 dígitos para entrar al CRM desde el móvil.
 *
 * QUÉ PROTEGE
 * Un teléfono robado o prestado con la contraseña guardada en el navegador. Sin
 * PIN, quien lo tenga abre el CRM y ve datos de clientes; con PIN, la contraseña
 * guardada no le sirve porque no es lo que se le pide.
 *
 * QUÉ NO PROTEGE
 * A alguien que conozca la contraseña y entre desde otro dispositivo, ni un robo
 * con coacción. Para el primer caso está el login; para cerrar del todo una
 * cuenta comprometida, desactivarla.
 *
 * LA PIEZA QUE LO HACE FUNCIONAR
 * Configurar o cambiar el PIN exige la contraseña. Sin eso, quien robe el
 * teléfono cerraría sesión, entraría con la contraseña guardada y se pondría un
 * PIN nuevo — y toda la protección sería decorativa.
 */
@Injectable()
export class PinService {
  private readonly logger = new Logger(PinService.name)

  /** A los 5 fallos seguidos se cierra la sesión. */
  private readonly MAX_INTENTOS = 5

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  private validarFormato(pin: string) {
    if (!/^\d{6}$/.test(pin ?? '')) {
      throw new BadRequestException('El PIN debe tener exactamente 6 dígitos')
    }
    // Un PIN como 111111 o 123456 se adivina en los primeros intentos, y hay 5.
    if (/^(\d)\1{5}$/.test(pin)) {
      throw new BadRequestException('El PIN no puede ser el mismo dígito repetido')
    }
    if ('0123456789'.includes(pin) || '9876543210'.includes(pin)) {
      throw new BadRequestException('El PIN no puede ser una secuencia como 123456')
    }
  }

  /** Estado del PIN del usuario, para que la app sepa qué pantalla mostrar. */
  async estado(userId: string) {
    const u = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { pinHash: true, pinCreadoEn: true },
    })
    return { configurado: !!u?.pinHash, creadoEn: u?.pinCreadoEn ?? null }
  }

  /**
   * Configura o cambia el PIN. Exige la contraseña escrita.
   *
   * Avisa a los administradores por correo: si a alguien le roban el teléfono y
   * logran cambiar el PIN, ese aviso es lo que permite enterarse y desactivar la
   * cuenta. Convierte un intento de robo en algo detectable, no solo en algo que
   * se intenta impedir.
   */
  async configurar(userId: string, pin: string, password: string) {
    this.validarFormato(pin)

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, password: true, pinHash: true, organizationId: true },
    })
    if (!user) throw new NotFoundException('Usuario no encontrado')

    if (!password || !(await bcrypt.compare(password, user.password))) {
      throw new UnauthorizedException('La contraseña no es correcta')
    }

    const eraCambio = !!user.pinHash

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        pinHash: await bcrypt.hash(pin, 12),
        pinCreadoEn: new Date(),
        pinIntentos: 0,
      },
    })

    // El aviso no debe impedir guardar el PIN: si falla el correo, el usuario ya
    // configuró su acceso y bloquearlo ahí sería peor.
    this.avisarCambio(user, eraCambio).catch((e) =>
      this.logger.error(`[pin] no se pudo avisar del cambio: ${e}`),
    )

    return { ok: true }
  }

  private async avisarCambio(
    user: { id: string; name: string; email: string; organizationId: string },
    eraCambio: boolean,
  ) {
    const admins = await this.prisma.user.findMany({
      where: { organizationId: user.organizationId, role: 'SUPER_ADMIN', activo: true },
      select: { email: true },
    })
    const cuando = new Date().toLocaleString('es-EC', { timeZone: 'America/Guayaquil' })
    for (const a of admins) {
      // No se avisa a quien hizo el cambio sobre su propio PIN: seria ruido.
      if (a.email === user.email) continue
      await this.notifications.enviarAvisoSeguridad({
        email: a.email,
        asunto: `${user.name} ${eraCambio ? 'cambió' : 'configuró'} su PIN de acceso`,
        mensaje:
          `${user.name} ${eraCambio ? 'cambió' : 'configuró'} su PIN de acceso móvil el ${cuando}.\n\n` +
          `Si no fue una acción esperada, desactiva su cuenta desde Usuarios: eso cierra su sesión al instante.`,
      })
    }
  }

  /**
   * Verifica el PIN al desbloquear.
   *
   * Devuelve cuántos intentos quedan, para que la pantalla lo muestre: alguien
   * que se equivocó de verdad merece saber que le queda uno antes de perder la
   * sesión.
   */
  async verificar(userId: string, pin: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { pinHash: true, pinIntentos: true },
    })
    if (!user?.pinHash) throw new BadRequestException('No tienes un PIN configurado')

    if (await bcrypt.compare(pin ?? '', user.pinHash)) {
      if (user.pinIntentos > 0) {
        await this.prisma.user.update({ where: { id: userId }, data: { pinIntentos: 0 } })
      }
      return { ok: true }
    }

    const intentos = user.pinIntentos + 1
    await this.prisma.user.update({ where: { id: userId }, data: { pinIntentos: intentos } })

    if (intentos >= this.MAX_INTENTOS) {
      // Se reinicia el contador junto con el bloqueo: si no, al volver a entrar
      // con su contraseña quedaría con los intentos agotados y un solo error lo
      // dejaría fuera otra vez.
      await this.prisma.user.update({ where: { id: userId }, data: { pinIntentos: 0 } })
      throw new UnauthorizedException({
        message: 'Demasiados intentos. Vuelve a iniciar sesión con tu contraseña.',
        cerrarSesion: true,
      })
    }

    throw new UnauthorizedException({
      message: 'PIN incorrecto',
      intentosRestantes: this.MAX_INTENTOS - intentos,
    })
  }

  /**
   * Borra el PIN de alguien. Solo SUPER_ADMIN.
   *
   * Para cuando se pierde un teléfono o alguien olvida su PIN sin acordarse
   * tampoco de la contraseña. La próxima vez que entre configurará uno nuevo.
   */
  async borrarDeOtro(targetId: string, organizationId: string, callerRole: string) {
    if (callerRole !== 'SUPER_ADMIN') {
      throw new ForbiddenException('Solo SUPER_ADMIN puede borrar el PIN de otra persona')
    }
    const user = await this.prisma.user.findFirst({
      where: { id: targetId, organizationId },
      select: { id: true, name: true },
    })
    if (!user) throw new NotFoundException('Usuario no encontrado')

    await this.prisma.user.update({
      where: { id: targetId },
      data: { pinHash: null, pinCreadoEn: null, pinIntentos: 0 },
    })
    return { ok: true, nombre: user.name }
  }
}
