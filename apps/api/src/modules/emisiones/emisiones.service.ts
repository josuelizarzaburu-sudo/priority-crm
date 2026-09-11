import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { NotificationsService } from '../notifications/notifications.service'
import { NotificacionesService } from '../notificaciones/notificaciones.service'
import { nombreCorto, nombreParaSaludo } from '../../common/texto'
import {
  construirCorreoVehiculo,
  formaPagoVehiculo,
  type DatosVehiculo,
} from '../requerimientos/plantillas-vehiculos'

/**
 * Emisiones de vehículos.
 *
 * Es el equivalente de la bienvenida en salud, pero para autos, y vive aparte
 * por una razón práctica: las emisiones de vehículo las manda Gianella y las
 * bienvenidas de salud las ejecutivas de cuenta. En la misma bandeja, cada una
 * vería trabajo que no le toca.
 *
 * La emisión se abre sola cuando se cierra un negocio de auto —con la inspección
 * ya aprobada— así que nadie tiene que acordarse de crearla.
 */

/** Quién gestiona emisiones: Fidelización y gerencia. */
const PUEDE_GESTIONAR = ['SUPER_ADMIN', 'OWNER', 'JEFE_OPERACIONES', 'OPERACIONES']

export const PLANTILLAS_EMISION = [
  {
    id: 'contado',
    label: 'Pago de contado',
    descripcion: 'Con las cuentas bancarias de la aseguradora',
    formaPago: 'CONTADO' as const,
  },
  {
    id: 'tarjeta',
    label: 'Pago con tarjeta',
    descripcion: 'Con el enlace de pago de la aseguradora',
    formaPago: 'TARJETA' as const,
  },
  {
    id: 'debito',
    label: 'Débito bancario',
    descripcion: 'Débito mensual a cuotas',
    formaPago: 'DEBITO' as const,
  },
]

@Injectable()
export class EmisionesService {
  private readonly logger = new Logger(EmisionesService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly notificaciones: NotificacionesService,
  ) {}

  private exigirAcceso(role: string) {
    if (!PUEDE_GESTIONAR.includes(role)) {
      throw new ForbiddenException('No tienes acceso a las emisiones de vehículos')
    }
  }

  async listar(
    organizationId: string,
    role: string,
    query: { estado?: string; search?: string },
  ) {
    this.exigirAcceso(role)

    const where: any = { organizationId }
    if (query.estado) where.estado = query.estado

    if (query.search?.trim()) {
      const s = query.search.trim()
      where.cliente = {
        OR: [
          { nombres: { contains: s, mode: 'insensitive' } },
          { apellidos: { contains: s, mode: 'insensitive' } },
          { identificacion: { contains: s } },
        ],
      }
    }

    return this.prisma.emision.findMany({
      where,
      include: {
        cliente: {
          select: {
            id: true,
            nombres: true,
            apellidos: true,
            email: true,
            nombrePreferido: true,
          },
        },
        poliza: {
          select: {
            aseguradora: true,
            plan: true,
            marca: true,
            modelo: true,
            anio: true,
            placa: true,
            formaPago: true,
            fechaEmision: true,
          },
        },
      },
      // Las pendientes primero: es la bandeja de trabajo, no un archivo.
      orderBy: [{ estado: 'asc' }, { createdAt: 'desc' }],
      take: 200,
    })
  }

  /**
   * Abre la emisión de una póliza recién cerrada.
   *
   * La llama el pipeline al ganar un negocio de vehículos. No lanza si algo
   * falla: la venta ya está hecha y perderla por no poder abrir la emisión sería
   * mucho peor.
   */
  async crearParaPoliza(
    clienteId: string,
    polizaId: string,
    organizationId: string,
    nombreCliente: string,
  ) {
    try {
      const yaExiste = await this.prisma.emision.findUnique({ where: { polizaId } })
      if (yaExiste) return yaExiste

      const emision = await this.prisma.emision.create({
        data: { clienteId, polizaId, organizationId },
      })

      const gestores = await this.prisma.user.findMany({
        where: { organizationId, role: { in: PUEDE_GESTIONAR as any }, activo: true },
        select: { id: true },
      })
      await this.notificaciones.crearParaVarios(
        gestores.map((g) => g.id),
        {
          organizationId,
          tipo: 'EMISION_NUEVA',
          titulo: 'Nueva emisión de vehículo',
          detalle: `${nombreCliente} — envíale el correo de emisión`,
          enlace: '/emisiones',
        },
      )

      return emision
    } catch (e) {
      this.logger.error(`[emisiones] no se pudo abrir la emisión: ${e}`)
      return null
    }
  }

  /** El correo armado desde la plantilla, editable antes de enviar. */
  async vistaPrevia(id: string, organizationId: string, role: string, plantillaId?: string) {
    this.exigirAcceso(role)

    const emision = await this.prisma.emision.findFirst({
      where: { id, organizationId },
      include: { cliente: true, poliza: true },
    })
    if (!emision) throw new NotFoundException('Emisión no encontrada')
    if (!emision.cliente.email) {
      throw new BadRequestException(
        'El cliente no tiene correo. Cárgalo en su ficha antes de enviar la emisión.',
      )
    }

    // Se propone la variante según cómo paga, para no tener que elegirla casi
    // nunca.
    const sugerida = formaPagoVehiculo(emision.poliza?.formaPago ?? null).toLowerCase()
    const elegida =
      PLANTILLAS_EMISION.find((p) => p.id === plantillaId)?.id ??
      PLANTILLAS_EMISION.find((p) => p.id === sugerida)?.id ??
      'contado'

    const datos = this.datosCorreo(emision, elegida)

    return {
      id: emision.id,
      estado: emision.estado,
      para: emision.cliente.email,
      asunto: `Bienvenido a Priority sus Asesores de Seguros - ${nombreCorto(
        emision.cliente.nombres,
        emision.cliente.apellidos,
        emision.cliente.nombrePreferido,
      )}`,
      // Si ya se envió, se muestra lo que salió y no la plantilla: es la
      // constancia de lo que se le dijo al cliente.
      texto: emision.correoTexto ?? construirCorreoVehiculo('EMISION', datos),
      plantilla: emision.correoPlantilla ?? elegida,
      plantillas: PLANTILLAS_EMISION.map(({ id, label, descripcion }) => ({
        id,
        label,
        descripcion,
      })),
      datos: {
        aseguradora: emision.poliza?.aseguradora,
        plan: emision.poliza?.plan,
        vehiculo: [emision.poliza?.marca, emision.poliza?.modelo].filter(Boolean).join(' '),
        placa: emision.poliza?.placa,
        vigencia: datos.vigencia,
      },
    }
  }

  private datosCorreo(emision: any, plantillaId: string): DatosVehiculo {
    const p = PLANTILLAS_EMISION.find((x) => x.id === plantillaId) ?? PLANTILLAS_EMISION[0]
    return {
      saludo: nombreParaSaludo(emision.cliente.nombres, emision.cliente.nombrePreferido),
      aseguradora: emision.poliza?.aseguradora ?? '',
      plan: emision.poliza?.plan ?? null,
      vehiculo: [emision.poliza?.marca, emision.poliza?.modelo].filter(Boolean).join(' ') || null,
      placa: emision.poliza?.placa ?? null,
      vigencia: emision.poliza?.fechaEmision
        ? new Date(emision.poliza.fechaEmision).toLocaleDateString('es-EC', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
            // UTC porque la fecha se guarda sin hora: en Ecuador leerla en hora
            // local daría el día anterior.
            timeZone: 'UTC',
          })
        : null,
      formaPago: p.formaPago,
    }
  }

  async enviar(
    id: string,
    dto: { texto?: string; plantilla?: string; copias?: string },
    organizationId: string,
    userId: string,
    role: string,
  ) {
    this.exigirAcceso(role)

    const emision = await this.prisma.emision.findFirst({
      where: { id, organizationId },
      include: { cliente: true, poliza: true },
    })
    if (!emision) throw new NotFoundException('Emisión no encontrada')
    if (!emision.cliente.email) {
      throw new BadRequestException('El cliente no tiene correo cargado')
    }
    if (emision.estado === 'ENVIADA') {
      throw new ForbiddenException(
        `Esta emisión ya se envió el ${new Date(emision.enviadaEn!).toLocaleDateString('es-EC')}`,
      )
    }

    const texto =
      dto.texto?.trim() ||
      construirCorreoVehiculo('EMISION', this.datosCorreo(emision, dto.plantilla ?? 'contado'))

    const envio = await this.notifications.enviarCorreoBienvenida({
      email: emision.cliente.email,
      nombreCompleto: emision.cliente.nombres,
      nombreParaAsunto: nombreCorto(
        emision.cliente.nombres,
        emision.cliente.apellidos,
        emision.cliente.nombrePreferido,
      ),
      texto,
      // Igual que en renovaciones: siempre comercial, más quien se agregue.
      copias: (dto.copias ?? '')
        .split(/[,;]/)
        .map((c) => c.trim())
        .filter((c) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(c)),
    } as any)

    // Si el correo no salió, la emisión queda PENDIENTE para reintentar.
    if (envio && envio.ok === false) {
      throw new BadRequestException(
        `No se pudo enviar el correo: ${envio.error ?? 'error del servicio de correo'}. La emisión queda pendiente para que puedas reintentar.`,
      )
    }

    return this.prisma.emision.update({
      where: { id },
      data: {
        estado: 'ENVIADA',
        enviadaEn: new Date(),
        enviadaPorId: userId,
        correoTexto: texto,
        correoDestinatario: emision.cliente.email,
        correoPlantilla: dto.plantilla ?? null,
      },
    })
  }
}
