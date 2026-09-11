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

/**
 * Inspección de vehículos, previa al cierre de la venta.
 *
 * En autos el proceso es distinto al de salud. En salud se cierra la venta y
 * después operaciones hace su trabajo. En autos la inspección va ANTES: el
 * comercial manda los datos y la cotización a Gianella, ella gestiona la
 * inspección con la aseguradora, y solo cuando está aprobada se puede cerrar.
 *
 * Por eso no vive en Requerimientos —que asume que la venta ya ocurrió— sino
 * junto al deal, como un requisito del cierre.
 */

export const ESTADOS_INSPECCION = [
  'DE_INSPECCION',
  'APROBADO',
  'RECHAZADO_DEFINITIVO',
  'RECHAZADO_OBSERVACION',
] as const

export type EstadoInspeccion = (typeof ESTADOS_INSPECCION)[number]

/** Quién resuelve una inspección: Fidelización y gerencia. */
const PUEDE_RESOLVER = ['SUPER_ADMIN', 'OWNER', 'JEFE_OPERACIONES', 'OPERACIONES']

/** Correo al que llegan las solicitudes de inspección. */
const CORREO_INSPECCIONES = 'comercial@priority.ec'

@Injectable()
export class InspeccionesService {
  private readonly logger = new Logger(InspeccionesService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly notificaciones: NotificacionesService,
  ) {}

  /** La inspección de un deal, si existe. */
  async porDeal(dealId: string, organizationId: string) {
    return this.prisma.inspeccion.findFirst({
      where: { dealId, deal: { organizationId } },
      include: { notas: { orderBy: { createdAt: 'asc' } } },
    })
  }

  /**
   * Envía la solicitud de inspección a Fidelización.
   *
   * Los adjuntos —la cotización de la aseguradora y la matrícula— viajan en el
   * correo y NO se guardan, igual que en renovaciones: el CRM no almacena
   * archivos, y guardarlos obligaría a montar almacenamiento para algo que vive
   * en la bandeja de Gianella.
   */
  async enviar(
    dealId: string,
    dto: {
      aseguradora?: string
      marca?: string
      modelo?: string
      anio?: number
      placa?: string
      nota?: string
      adjuntos?: { filename: string; content: string }[]
    },
    organizationId: string,
    userId: string,
  ) {
    const deal = await this.prisma.deal.findFirst({
      where: { id: dealId, organizationId },
      include: { contact: { select: { firstName: true, lastName: true, email: true, phone: true } } },
    })
    if (!deal) throw new NotFoundException('Negocio no encontrado')

    const cf = (deal.customFields ?? {}) as any
    const cedula = String(cf.identificacion ?? '').trim()

    /**
     * Sin cédula y correo no se puede pedir la inspección: son los datos que la
     * aseguradora exige para abrir el trámite. Se avisa aquí y no después, para
     * no hacer ir y volver a Gianella pidiéndolos.
     */
    const faltan = [
      !cedula ? 'cédula' : '',
      !deal.contact?.email ? 'correo del cliente' : '',
    ].filter(Boolean)
    if (faltan.length) {
      throw new BadRequestException(
        `Falta ${faltan.join(' y ')} para pedir la inspección. Complétalo en los datos del contacto.`,
      )
    }

    const autor = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { name: true },
    })

    const existente = await this.prisma.inspeccion.findUnique({ where: { dealId } })

    // Una inspección rechazada en definitivo no se reabre: si hay que intentar
    // con otra aseguradora, es otra gestión y conviene que se vea como tal.
    if (existente?.estado === 'RECHAZADO_DEFINITIVO') {
      throw new ForbiddenException(
        'Esta inspección fue rechazada en definitivo. Si vas a intentar con otra aseguradora, déjalo anotado en el negocio.',
      )
    }

    const datos = {
      aseguradora: dto.aseguradora?.trim() || null,
      marca: dto.marca?.trim() || null,
      modelo: dto.modelo?.trim() || null,
      anio: dto.anio ?? null,
      placa: dto.placa?.trim()?.toUpperCase() || null,
      enviadaEn: new Date(),
      enviadaPorId: userId,
      estado: 'DE_INSPECCION',
      // Al reenviar tras una observación, se limpia el resultado anterior: si no,
      // la ficha seguiría mostrando "rechazado" con una inspección en curso.
      resueltaEn: null,
      observacion: null,
    }

    const inspeccion = existente
      ? await this.prisma.inspeccion.update({
          where: { dealId },
          data: { ...datos, intentos: { increment: 1 } },
        })
      : await this.prisma.inspeccion.create({
          data: { ...datos, dealId, organizationId },
        })

    const cliente = `${deal.contact?.firstName ?? ''} ${deal.contact?.lastName ?? ''}`.trim()
    const vehiculo = [datos.marca, datos.modelo, datos.anio].filter(Boolean).join(' ')
    const reintento = existente ? ` (reinspección · intento ${inspeccion.intentos})` : ''

    await this.prisma.inspeccionNota.create({
      data: {
        inspeccionId: inspeccion.id,
        texto: existente
          ? `Reenviado a inspección. ${dto.nota?.trim() ?? ''}`.trim()
          : `Enviado a inspección. ${dto.nota?.trim() ?? ''}`.trim(),
        autorId: userId,
        autorNombre: autor?.name ?? null,
      },
    })

    const envio = await this.notifications.enviarAvisoSeguridad({
      email: CORREO_INSPECCIONES,
      asunto: `Inspección de vehículo${reintento} — ${cliente}`,
      mensaje: [
        `${autor?.name ?? 'Comercial'} solicita una inspección.`,
        '',
        `Cliente: ${cliente}`,
        `Cédula: ${cedula}`,
        `Correo: ${deal.contact?.email ?? ''}`,
        deal.contact?.phone ? `Celular: ${deal.contact.phone}` : '',
        '',
        datos.aseguradora ? `Aseguradora: ${datos.aseguradora}` : '',
        vehiculo ? `Vehículo: ${vehiculo}` : '',
        datos.placa ? `Placa: ${datos.placa}` : '',
        '',
        dto.nota?.trim() ? `Nota: ${dto.nota.trim()}` : '',
        '',
        dto.adjuntos?.length
          ? `Se adjuntan ${dto.adjuntos.length} archivo(s).`
          : 'Sin archivos adjuntos.',
      ]
        .filter((l) => l !== '')
        .join('\n'),
      adjuntos: dto.adjuntos,
    })

    if (envio && (envio as any).ok === false) {
      throw new BadRequestException(
        `No se pudo enviar el correo: ${(envio as any).error ?? 'error del servicio de correo'}. La inspección queda registrada; puedes reintentar el envío.`,
      )
    }

    // Aviso dentro del CRM a quien gestiona inspecciones.
    const gestores = await this.prisma.user.findMany({
      where: {
        organizationId,
        role: { in: PUEDE_RESOLVER as any },
        activo: true,
      },
      select: { id: true },
    })
    await this.notificaciones.crearParaVarios(
      gestores.map((g) => g.id),
      {
        organizationId,
        tipo: 'INSPECCION_SOLICITADA',
        titulo: `Inspección de vehículo${reintento}`,
        detalle: `${cliente}${vehiculo ? ` — ${vehiculo}` : ''}`,
        enlace: '/pipeline',
        provocadoPor: userId,
      },
    )

    return inspeccion
  }

  /**
   * Registra el resultado de la inspección.
   *
   * Lo hace Fidelización cuando la aseguradora responde. El comercial se entera
   * por la campanita, sin tener que preguntar.
   */
  async resolver(
    dealId: string,
    dto: { estado: EstadoInspeccion; observacion?: string },
    organizationId: string,
    userId: string,
    role: string,
  ) {
    if (!PUEDE_RESOLVER.includes(role)) {
      throw new ForbiddenException('Solo Fidelización puede registrar el resultado')
    }
    if (!ESTADOS_INSPECCION.includes(dto.estado)) {
      throw new BadRequestException('Estado de inspección no válido')
    }

    const inspeccion = await this.prisma.inspeccion.findFirst({
      where: { dealId, organizationId },
      include: { deal: { include: { contact: { select: { firstName: true, lastName: true } } } } },
    })
    if (!inspeccion) throw new NotFoundException('Esta inspección no existe')

    // Un rechazo con observación necesita decir QUÉ hay que reparar: sin eso el
    // comercial no puede explicarle al cliente ni reinspeccionar.
    if (dto.estado === 'RECHAZADO_OBSERVACION' && !dto.observacion?.trim()) {
      throw new BadRequestException(
        'Escribe qué hay que corregir para volver a inspeccionar',
      )
    }

    const autor = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { name: true },
    })

    const actualizada = await this.prisma.inspeccion.update({
      where: { dealId },
      data: {
        estado: dto.estado,
        observacion: dto.observacion?.trim() || null,
        resueltaEn: new Date(),
      },
    })

    const comoSeLlama: Record<EstadoInspeccion, string> = {
      DE_INSPECCION: 'de inspección',
      APROBADO: 'aprobada',
      RECHAZADO_DEFINITIVO: 'rechazada en definitivo',
      RECHAZADO_OBSERVACION: 'rechazada con observación',
    }

    await this.prisma.inspeccionNota.create({
      data: {
        inspeccionId: inspeccion.id,
        texto: `Inspección ${comoSeLlama[dto.estado]}.${
          dto.observacion?.trim() ? ` ${dto.observacion.trim()}` : ''
        }`,
        autorId: userId,
        autorNombre: autor?.name ?? null,
      },
    })

    // Se avisa a quien pidió la inspección, que es quien está esperando.
    if (inspeccion.enviadaPorId) {
      const cliente = `${inspeccion.deal?.contact?.firstName ?? ''} ${
        inspeccion.deal?.contact?.lastName ?? ''
      }`.trim()
      await this.notificaciones.crear({
        usuarioId: inspeccion.enviadaPorId,
        organizationId,
        tipo: 'INSPECCION_RESUELTA',
        titulo: `Inspección ${comoSeLlama[dto.estado]}`,
        detalle:
          `${cliente}${dto.observacion?.trim() ? ` — ${dto.observacion.trim()}` : ''}` ||
          undefined,
        enlace: '/pipeline',
        provocadoPor: userId,
      })
    }

    this.logger.log(`[inspecciones] deal ${dealId}: ${dto.estado}`)
    return actualizada
  }

  /**
   * ¿Se puede cerrar este deal?
   *
   * Un vehículo sin inspección aprobada no se puede vender: la aseguradora no
   * emite la póliza. Bloquearlo aquí evita que el comercial dé por cerrada una
   * venta que después se cae.
   */
  async puedeCerrar(
    dealId: string,
    organizationId: string,
    /**
     * Ramos de las entradas que se están cerrando.
     *
     * Hace falta porque los leads creados ANTES de que existiera el selector de
     * tipo de seguro no tienen ese dato: la única forma de saber que son de auto
     * es el ramo que el comercial elige en el modal de cierre.
     */
    ramosDelCierre?: (string | null | undefined)[],
  ) {
    const deal = await this.prisma.deal.findFirst({
      where: { id: dealId, organizationId },
      select: { customFields: true },
    })

    const esAuto = (v: unknown) =>
      ['AUTO', 'VEHICULO', 'VEHICULOS'].includes(String(v ?? '').toUpperCase())

    const cf = (deal?.customFields ?? {}) as any
    const esVehiculo =
      // El tipo del lead, cuando se eligió al crearlo.
      esAuto(cf.insuranceType) ||
      // El ramo que se está cerrando ahora mismo.
      (ramosDelCierre ?? []).some(esAuto) ||
      // O el de los datos del seguro ya capturados.
      (Array.isArray(cf.insuranceData) && cf.insuranceData.some((e: any) => esAuto(e?.ramo)))

    const inspeccion = await this.prisma.inspeccion.findFirst({
      where: { dealId, organizationId },
      select: { estado: true, observacion: true },
    })

    // Queda registrado que se comprobo, para poder ver en los registros del
    // servidor si esta validacion corrio y con que datos: sin esto, un "me deja
    // cerrar igual" no se puede diagnosticar sin adivinar.
    this.logger.log(
      `[inspecciones] cierre de ${dealId}: esVehiculo=${esVehiculo} ` +
        `tipo=${cf.insuranceType ?? '-'} ramos=${JSON.stringify(ramosDelCierre ?? [])} ` +
        `inspeccion=${inspeccion?.estado ?? 'ninguna'}`,
    )

    if (!inspeccion) {
      // Un vehículo SIN inspección tampoco se puede cerrar: la aseguradora no
      // emite sin ella, y dejarlo pasar era el hueco que permitía ganar el deal
      // sin haberla pedido nunca.
      if (esVehiculo) {
        // El mensaje dice QUÉ hacer y en qué orden: en un lead antiguo el bloque
        // de inspección solo aparece cuando los datos del seguro ya dicen que es
        // de auto, y sin esa explicación quedaría atascado.
        return {
          puede: false as const,
          motivo:
            'Este negocio es de vehículo y todavía no se ha enviado la inspección. ' +
            'Guarda primero los datos del seguro con ramo Auto —sin cerrar— y el bloque de ' +
            'inspección aparecerá en el panel para enviarla.',
        }
      }
      // En los demás ramos no aplica.
      return { puede: true as const }
    }

    if (inspeccion.estado === 'APROBADO') return { puede: true as const }

    const motivos: Record<string, string> = {
      DE_INSPECCION: 'La inspección está en curso. Espera el resultado para cerrar.',
      RECHAZADO_DEFINITIVO:
        'La inspección fue rechazada en definitivo. No se puede emitir esta póliza.',
      RECHAZADO_OBSERVACION: `La inspección fue rechazada con observación${
        inspeccion.observacion ? `: ${inspeccion.observacion}` : ''
      }. Vuelve a enviarla cuando esté corregido.`,
    }

    return { puede: false as const, motivo: motivos[inspeccion.estado] ?? 'Inspección pendiente' }
  }
}
