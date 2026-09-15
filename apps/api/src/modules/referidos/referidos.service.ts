import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { NotificacionesService } from '../notificaciones/notificaciones.service'

/**
 * Programa de referidos.
 *
 * Personas externas —no clientes, no empleados— traen contactos y ganan dinero y
 * puntos cuando la venta se cierra. El dinero paga cada referido; los puntos
 * premian la constancia, que es lo que el dinero suelto no premia.
 *
 * El referido entra al pipeline como cualquier otro lead: el vendedor no cambia
 * nada de lo que hace, y la acreditación ocurre sola al cerrarse.
 */

/** Quién administra el programa. */
const PUEDE_ADMINISTRAR = ['SUPER_ADMIN', 'OWNER', 'MANAGER', 'JEFE_OPERACIONES']

/** Reglas por defecto, hasta que se configuren. */
const REGLAS_INICIALES = {
  puntosPorReferido: 10,
  cortePrima: 2000,
  montoBajo: 20,
  montoAlto: 30,
}

@Injectable()
export class ReferidosService {
  private readonly logger = new Logger(ReferidosService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificaciones: NotificacionesService,
  ) {}

  private exigirAdmin(role: string) {
    if (!PUEDE_ADMINISTRAR.includes(role)) {
      throw new ForbiddenException('No tienes acceso al programa de referidos')
    }
  }

  /** Las reglas de la organización, creándolas con los valores iniciales si no existen. */
  async reglas(organizationId: string) {
    const existentes = await this.prisma.referidoReglas.findUnique({
      where: { organizationId },
    })
    if (existentes) return existentes

    return this.prisma.referidoReglas.create({
      data: { organizationId, ...REGLAS_INICIALES },
    })
  }

  async guardarReglas(
    organizationId: string,
    role: string,
    dto: {
      puntosPorReferido?: number
      cortePrima?: number
      montoBajo?: number
      montoAlto?: number
    },
  ) {
    this.exigirAdmin(role)

    /**
     * Los cambios afectan solo hacia adelante.
     *
     * Lo ya acreditado no se toca: si alguien juntó 30 puntos con las reglas de
     * hoy, esos 30 siguen siendo suyos. Recalcular el pasado destruiría la
     * confianza en el programa más rápido que cualquier otra cosa.
     */
    await this.reglas(organizationId)

    return this.prisma.referidoReglas.update({
      where: { organizationId },
      data: {
        ...(dto.puntosPorReferido !== undefined
          ? { puntosPorReferido: dto.puntosPorReferido }
          : {}),
        ...(dto.cortePrima !== undefined ? { cortePrima: dto.cortePrima } : {}),
        ...(dto.montoBajo !== undefined ? { montoBajo: dto.montoBajo } : {}),
        ...(dto.montoAlto !== undefined ? { montoAlto: dto.montoAlto } : {}),
      },
    })
  }

  /**
   * Genera un código a partir del nombre: "Daniela Yépez" → "DANI-4417".
   *
   * Se usa el nombre y no un número al azar porque el referidor lo va a dictar
   * por teléfono y escribir en WhatsApp: "DANI-4417" se recuerda y se repite,
   * "8f3a92" no.
   */
  private async generarCodigo(nombres: string): Promise<string> {
    const base = (nombres ?? '')
      .trim()
      .toUpperCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^A-Z]/g, '')
      .slice(0, 4)
      .padEnd(4, 'X')

    // Se intenta varias veces: el sufijo es al azar y puede chocar.
    for (let i = 0; i < 20; i++) {
      const sufijo = Math.floor(1000 + Math.random() * 9000)
      const codigo = `${base}-${sufijo}`
      const usado = await this.prisma.referidor.findUnique({ where: { codigo } })
      if (!usado) return codigo
    }

    // Con 20 choques seguidos algo raro pasa; se cae a un código más largo
    // antes que devolver uno repetido.
    return `${base}-${Date.now().toString().slice(-6)}`
  }

  async crearReferidor(
    organizationId: string,
    role: string,
    dto: {
      nombres: string
      apellidos: string
      celular: string
      email?: string
      identificacion?: string
      notas?: string
    },
  ) {
    this.exigirAdmin(role)

    if (!dto.nombres?.trim() || !dto.apellidos?.trim()) {
      throw new BadRequestException('Faltan el nombre y el apellido')
    }
    // El celular es obligatorio: es por donde se le avisa y por donde se
    // coordina el pago.
    if (!dto.celular?.trim()) {
      throw new BadRequestException('Falta el celular')
    }

    const codigo = await this.generarCodigo(dto.nombres)

    return this.prisma.referidor.create({
      data: {
        codigo,
        nombres: dto.nombres.trim().toUpperCase(),
        apellidos: dto.apellidos.trim().toUpperCase(),
        celular: dto.celular.trim(),
        email: dto.email?.trim() || null,
        identificacion: dto.identificacion?.trim() || null,
        notas: dto.notas?.trim() || null,
        organizationId,
      },
    })
  }

  async listarReferidores(organizationId: string, role: string, search?: string) {
    this.exigirAdmin(role)

    const where: any = { organizationId }
    if (search?.trim()) {
      const s = search.trim()
      where.OR = [
        { nombres: { contains: s, mode: 'insensitive' } },
        { apellidos: { contains: s, mode: 'insensitive' } },
        { codigo: { contains: s.toUpperCase() } },
      ]
    }

    return this.prisma.referidor.findMany({
      where,
      include: {
        _count: { select: { referidos: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    })
  }

  /**
   * Registra un contacto referido.
   *
   * Todavía no crea el lead: eso lo hace operaciones al revisarlo. Crear el deal
   * de una permitiría llenar el pipeline con datos inventados desde fuera.
   */
  async crearReferido(
    codigo: string,
    dto: { nombres: string; celular: string; email?: string; interes?: string; nota?: string },
  ) {
    const referidor = await this.prisma.referidor.findUnique({
      where: { codigo: codigo.trim().toUpperCase() },
    })
    if (!referidor) throw new NotFoundException('Ese código no existe')
    if (referidor.estado !== 'ACTIVO') {
      throw new ForbiddenException('Este código está inactivo')
    }

    if (!dto.nombres?.trim() || !dto.celular?.trim()) {
      throw new BadRequestException('Faltan el nombre y el celular del contacto')
    }

    const referido = await this.prisma.referido.create({
      data: {
        referidorId: referidor.id,
        nombres: dto.nombres.trim().toUpperCase(),
        celular: dto.celular.trim(),
        email: dto.email?.trim() || null,
        interes: dto.interes?.trim()?.toUpperCase() || null,
        nota: dto.nota?.trim() || null,
        organizationId: referidor.organizationId,
      },
    })

    // Se avisa a quien reparte: un referido parado es plata perdida y el
    // referidor ya hizo su parte.
    const admins = await this.prisma.user.findMany({
      where: {
        organizationId: referidor.organizationId,
        role: { in: PUEDE_ADMINISTRAR as any },
        activo: true,
      },
      select: { id: true },
    })
    await this.notificaciones.crearParaVarios(
      admins.map((a) => a.id),
      {
        organizationId: referidor.organizationId,
        tipo: 'REFERIDO_NUEVO',
        titulo: 'Llegó un referido nuevo',
        detalle: `${referido.nombres} — por ${referidor.nombres} (${referidor.codigo})`,
        enlace: '/referidos',
      },
    )

    return referido
  }

  /**
   * Cuánto se paga por una póliza, según su prima anual.
   *
   * Tramos y no porcentaje: el referidor tiene que poder decir "me dan 20" sin
   * calcular nada. Un 5% de una prima que no conoce no significa nada para él.
   */
  private montoPorPrima(prima: number | null, reglas: any): number {
    const corte = Number(reglas.cortePrima)
    const bajo = Number(reglas.montoBajo)
    const alto = Number(reglas.montoAlto)
    // Sin prima cargada se paga el tramo bajo: es lo prudente, y se puede
    // ajustar a mano después.
    if (prima === null) return bajo
    return prima > corte ? alto : bajo
  }

  /**
   * Acredita un referido cuya venta se cerró.
   *
   * CLIENTE NUEVO: se acredita al cerrar. Nadie contrata y paga la prima de un
   * año para cancelar al mes, así que esperar no protege de nada y solo hace que
   * el referidor desconfíe del programa.
   *
   * CAMBIO DE BRÓKER: se acredita en la renovación, que es cuando Priority
   * cobra su comisión. No es desconfianza, es pagar cuando se cobra.
   */
  async acreditar(
    referidoId: string,
    organizationId: string,
    role: string,
    userId: string,
    dto?: { primaAnual?: number },
  ) {
    this.exigirAdmin(role)

    const referido = await this.prisma.referido.findFirst({
      where: { id: referidoId, organizationId },
      include: { referidor: true },
    })
    if (!referido) throw new NotFoundException('Referido no encontrado')
    if (referido.estado === 'ACREDITADO') {
      throw new ForbiddenException('Este referido ya fue acreditado')
    }

    const reglas = await this.reglas(organizationId)
    const puntos = reglas.puntosPorReferido
    const monto = this.montoPorPrima(dto?.primaAnual ?? null, reglas)

    const autor = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { name: true },
    })

    /**
     * Todo junto o nada.
     *
     * El saldo del referidor y el movimiento tienen que cuadrar siempre: si se
     * escribe uno y falla el otro, el historial deja de explicar el saldo, que
     * es justo para lo que existe.
     */
    const [actualizado] = await this.prisma.$transaction([
      this.prisma.referido.update({
        where: { id: referidoId },
        data: {
          estado: 'ACREDITADO',
          puntos,
          monto,
          acreditadoEn: new Date(),
        },
      }),
      this.prisma.referidor.update({
        where: { id: referido.referidorId },
        data: {
          puntos: { increment: puntos },
          acumulado: { increment: monto },
        },
      }),
      this.prisma.referidoMovimiento.create({
        data: {
          referidorId: referido.referidorId,
          referidoId,
          tipo: 'ACREDITACION',
          puntos,
          monto,
          detalle: `Referido cerrado: ${referido.nombres}`,
          autorId: userId,
          autorNombre: autor?.name ?? null,
        },
      }),
    ])

    this.logger.log(
      `[referidos] acreditado ${referido.nombres} a ${referido.referidor.codigo}: ${puntos} pts, $${monto}`,
    )

    return actualizado
  }

  /** Cambia el estado de un referido, con su motivo si no prosperó. */
  async cambiarEstadoReferido(
    referidoId: string,
    organizationId: string,
    role: string,
    dto: { estado: string; motivo?: string },
  ) {
    this.exigirAdmin(role)

    const validos = ['RECIBIDO', 'EN_GESTION', 'CERRADO', 'NO_PROSPERO']
    if (!validos.includes(dto.estado)) {
      throw new BadRequestException('Estado no válido')
    }
    // Sin motivo, el referidor no sabe qué falló y manda otro contacto igual.
    if (dto.estado === 'NO_PROSPERO' && !dto.motivo?.trim()) {
      throw new BadRequestException('Escribe por qué no prosperó')
    }

    const referido = await this.prisma.referido.findFirst({
      where: { id: referidoId, organizationId },
    })
    if (!referido) throw new NotFoundException('Referido no encontrado')

    return this.prisma.referido.update({
      where: { id: referidoId },
      data: { estado: dto.estado, motivo: dto.motivo?.trim() || null },
    })
  }

  /** Registra que se le pagó a un referidor. */
  async registrarPago(
    referidorId: string,
    organizationId: string,
    role: string,
    userId: string,
    dto: { monto: number; detalle?: string },
  ) {
    this.exigirAdmin(role)

    const referidor = await this.prisma.referidor.findFirst({
      where: { id: referidorId, organizationId },
    })
    if (!referidor) throw new NotFoundException('Referidor no encontrado')

    const monto = Number(dto.monto)
    if (!(monto > 0)) throw new BadRequestException('El monto tiene que ser mayor a cero')

    const porPagar = Number(referidor.acumulado) - Number(referidor.pagado)
    if (monto > porPagar) {
      throw new BadRequestException(
        `Solo se le deben $${porPagar.toFixed(2)}. Revisa el monto.`,
      )
    }

    const autor = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { name: true },
    })

    const [, actualizado] = await this.prisma.$transaction([
      this.prisma.referidoMovimiento.create({
        data: {
          referidorId,
          tipo: 'PAGO',
          monto: -monto,
          detalle: dto.detalle?.trim() || 'Pago al referidor',
          autorId: userId,
          autorNombre: autor?.name ?? null,
        },
      }),
      this.prisma.referidor.update({
        where: { id: referidorId },
        data: { pagado: { increment: monto } },
      }),
    ])

    return actualizado
  }

  /** Lo que ve el referidor en su pantalla. */
  async miPanel(codigo: string) {
    const referidor = await this.prisma.referidor.findUnique({
      where: { codigo: codigo.trim().toUpperCase() },
      include: {
        referidos: { orderBy: { createdAt: 'desc' }, take: 50 },
      },
    })
    if (!referidor) throw new NotFoundException('Ese código no existe')

    const reglas = await this.reglas(referidor.organizationId)

    return {
      codigo: referidor.codigo,
      nombres: referidor.nombres,
      puntos: referidor.puntos,
      // Lo ganado y lo que todavía no se le ha pagado.
      ganado: Number(referidor.acumulado),
      porCobrar: Number(referidor.acumulado) - Number(referidor.pagado),
      puntosPorReferido: reglas.puntosPorReferido,
      referidos: referidor.referidos.map((r) => ({
        id: r.id,
        nombres: r.nombres,
        interes: r.interes,
        estado: r.estado,
        puntos: r.puntos,
        monto: r.monto ? Number(r.monto) : null,
        motivo: r.motivo,
        createdAt: r.createdAt,
        acreditadoEn: r.acreditadoEn,
      })),
    }
  }

  /** Resumen para el CRM: cuánto se debe y qué está pendiente. */
  async resumen(organizationId: string, role: string) {
    this.exigirAdmin(role)

    const referidores = await this.prisma.referidor.findMany({
      where: { organizationId, estado: 'ACTIVO' },
      select: {
        id: true,
        codigo: true,
        nombres: true,
        apellidos: true,
        acumulado: true,
        pagado: true,
        puntos: true,
        _count: { select: { referidos: true } },
      },
    })

    const porPagar = referidores
      .map((r) => ({
        ...r,
        debe: Number(r.acumulado) - Number(r.pagado),
      }))
      .filter((r) => r.debe > 0)
      .sort((a, b) => b.debe - a.debe)

    const inicioMes = new Date()
    inicioMes.setDate(1)
    inicioMes.setHours(0, 0, 0, 0)

    const [delMes, cerradosDelMes] = await Promise.all([
      this.prisma.referido.count({
        where: { organizationId, createdAt: { gte: inicioMes } },
      }),
      this.prisma.referido.count({
        where: { organizationId, createdAt: { gte: inicioMes }, estado: 'ACREDITADO' },
      }),
    ])

    return {
      referidoresActivos: referidores.length,
      referidosDelMes: delMes,
      cerradosDelMes,
      totalPorPagar: Math.round(porPagar.reduce((s, r) => s + r.debe, 0) * 100) / 100,
      porPagar,
    }
  }

  /** Los referidos, para la bandeja del CRM. */
  async listarReferidos(organizationId: string, role: string, estado?: string) {
    this.exigirAdmin(role)

    return this.prisma.referido.findMany({
      where: { organizationId, ...(estado ? { estado } : {}) },
      include: {
        referidor: { select: { codigo: true, nombres: true, apellidos: true } },
        deal: { select: { id: true, title: true, assignedTo: { select: { name: true } } } },
      },
      // Los recién llegados primero: son los que hay que asignar.
      orderBy: [{ estado: 'asc' }, { createdAt: 'desc' }],
      take: 200,
    })
  }
}
