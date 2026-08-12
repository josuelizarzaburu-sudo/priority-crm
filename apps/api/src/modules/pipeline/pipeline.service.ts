import { Injectable, Logger, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common'
import { horasLaborables, sumarHorasLaborables, HORAS_PLAZO_GESTION } from './horas-laborables'
import { PrismaService } from '../../prisma/prisma.service'
import { CreateDealDto } from './dto/create-deal.dto'
import { UpdateDealDto } from './dto/update-deal.dto'
import { MoveDealDto } from './dto/move-deal.dto'
import { AssignDealDto } from './dto/assign-deal.dto'
import { LogActivityDto } from './dto/log-activity.dto'
import { CloseDealDto } from './dto/close-deal.dto'
import { AddFutureOpportunityDto } from './dto/add-future-opportunity.dto'
import { PipelineGateway } from './pipeline.gateway'
import { NotificationsService } from '../notifications/notifications.service'
import { soloVeSusNegocios } from './puede-vender'
import { EquiposService } from '../equipos/equipos.service'
import {
  filtroDeEquipo,
  origenDeLead,
  sePuedeReasignar,
  veSoloSuEquipo,
  ORIGENES_VALIDOS,
  type LeadOrigin,
} from '../equipos/equipos-scope'

/**
 * Roles con acceso a informacion comercial sensible.
 *
 * Se declaran como LISTA BLANCA a proposito. Antes cada endpoint preguntaba
 * `if (role === 'SALES_REP') prohibido`, o sea una lista negra de un solo rol:
 * cualquier rol nuevo que se agregara al sistema quedaba automaticamente con
 * acceso, sin que nadie lo decidiera. Fue lo que paso con los perfiles de
 * Operaciones. Con lista blanca, un rol nuevo entra sin permisos hasta que se lo
 * agregue aqui de forma explicita.
 */
/**
 * Comisiones: SOLO super admin.
 *
 * Josue lo restringio a proposito: el reporte existe para calcular sus propias
 * comisiones, no es informacion que deba circular. OJO: esto deja fuera a OWNER
 * (Pablo) y MANAGER (Roxana), que antes si entraban. Si alguno lo necesita, se
 * agrega aqui y en la ruta del frontend (commissions/page.tsx) — los dos sitios,
 * o la pantalla y la API quedan desalineadas.
 */
const PUEDEN_VER_COMISIONES = ['SUPER_ADMIN']

/**
 * Reparto de leads: administracion comercial.
 */
/**
 * Quien reparte leads.
 *
 * JEFE_EQUIPO entra aqui, pero con dos limites que se aplican mas abajo en
 * assignDeal: solo reparte a gente de SU equipo, y solo leads de la empresa
 * (PRIORITY_HEALTH / PRIORITY). Los PROPIO no los puede tocar nadie.
 */
const PUEDEN_REPARTIR_LEADS = ['SUPER_ADMIN', 'OWNER', 'MANAGER', 'JEFE_EQUIPO']

/**
 * Quien decide de que equipo es un lead.
 *
 * Sin JEFE_EQUIPO a proposito: un jefe reparte DENTRO de su equipo, pero no mueve
 * leads entre equipos. Si pudiera, podria vaciarse los suyos o quitarle los del
 * otro jefe.
 */
const PUEDEN_ADMINISTRAR_LOTES = ['SUPER_ADMIN', 'OWNER', 'MANAGER']

@Injectable()
export class PipelineService {
  private readonly logger = new Logger(PipelineService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: PipelineGateway,
    private readonly notifications: NotificationsService,
    private readonly equipos: EquiposService,
  ) {}

  async getStagesWithDeals(organizationId: string) {
    return this.prisma.pipelineStage.findMany({
      where: { organizationId },
      orderBy: { position: 'asc' },
      include: {
        deals: {
          orderBy: { position: 'asc' },
          include: {
            contact: { select: { id: true, firstName: true, lastName: true, company: true } },
            assignedTo: { select: { id: true, name: true } },
          },
        },
      },
    })
  }

  async getDeals(organizationId: string, userId: string, role: string, puedeVender?: boolean) {
    const where: any = { organizationId }
    if (soloVeSusNegocios(role, puedeVender)) {
      where.assignedToId = userId
    } else if (veSoloSuEquipo(role)) {
      // El jefe de equipo ve los negocios de su gente y los suyos propios, nada
      // mas. Si todavia no tiene equipo asignado se vera solo a si mismo, que es
      // lo correcto: no hay a quien supervisar todavia.
      const miembros = await this.equipos.miembrosDelJefe(userId, organizationId)
      Object.assign(where, filtroDeEquipo(userId, miembros))
    }
    const deals = await this.prisma.deal.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        stage: true,
        contact: { select: { id: true, firstName: true, lastName: true } },
        assignedTo: { select: { id: true, name: true } },
        activities: { orderBy: { createdAt: 'desc' }, take: 1, select: { createdAt: true } },
      },
    })
    console.log('Deals from DB:', deals.map((d) => ({ id: d.id, status: d.status, stageId: d.stageId })))
    return deals
  }

  async getMyDeals(userId: string, organizationId: string) {
    const deals = await this.prisma.deal.findMany({
      where: { organizationId, assignedToId: userId },
      orderBy: { position: 'asc' },
      include: {
        stage: true,
        contact: { select: { id: true, firstName: true, lastName: true, company: true } },
        activities: { orderBy: { createdAt: 'desc' } },
      },
    })

    const won = deals.filter((d) => d.status === 'WON')
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const wonThisMonth = won.filter((d) => d.closedAt && d.closedAt >= startOfMonth)
    console.log(
      `[getMyDeals] userId=${userId} total=${deals.length} WON=${won.length} WON_this_month=${wonThisMonth.length}`,
      wonThisMonth.map((d) => ({ id: d.id, status: d.status, closedAt: d.closedAt, stageId: d.stageId })),
    )

    return deals
  }

  async getCommissionsReport(organizationId: string, role: string) {
    // Lista blanca, no lista negra. Antes esto decia "si es SALES_REP, prohibido",
    // asi que CUALQUIER otro rol pasaba —incluidos los perfiles de Operaciones—
    // y se llevaba todos los negocios ganados de la empresa con el nombre del
    // vendedor de cada uno. La pantalla si estaba bien protegida, pero la API no:
    // bastaba con llamarla directamente. Se enumera quien SI puede entrar, que
    // ademas es la misma lista que ya usa la ruta del frontend.
    if (!PUEDEN_VER_COMISIONES.includes(role)) {
      throw new ForbiddenException('No tienes acceso al reporte de comisiones')
    }
    return this.prisma.deal.findMany({
      where: { organizationId, status: 'WON' },
      orderBy: { closedAt: 'desc' },
      include: {
        contact: { select: { id: true, firstName: true, lastName: true } },
        assignedTo: { select: { id: true, name: true } },
      },
    })
  }

  /**
   * Corrige el origen de un lead ya creado.
   *
   * Existe porque el origen decide la comision, y hasta ahora un negocio creado
   * desde Mi Pipeline por alguien no restringido (super admin, dueño) quedaba
   * como PRIORITY_HEALTH cuando en realidad era propio.
   *
   * Va aparte de updateDeal a proposito: updateDeal sobrescribe customFields
   * entero con lo que mande el cliente, asi que usarlo para tocar un solo campo
   * se llevaria por delante prima, seguimiento y todo lo demas. Aqui se fusiona.
   *
   * Solo gerencia: el origen no es algo que cada quien deba poder subirse a
   * PROPIO por su cuenta, justamente porque comisiona mas.
   */
  async cambiarOrigenDeal(
    id: string,
    origen: LeadOrigin,
    organizationId: string,
    userId: string,
    role: string,
  ) {
    if (!PUEDEN_ADMINISTRAR_LOTES.includes(role)) {
      throw new ForbiddenException('Solo administración puede cambiar el origen de un lead')
    }
    if (!ORIGENES_VALIDOS.includes(origen)) {
      throw new BadRequestException('Origen no válido')
    }

    const deal = await this.getDeal(id, organizationId)
    const anterior = origenDeLead(deal.customFields)
    if (anterior === origen) return deal

    const customFields = {
      ...((deal.customFields as Record<string, unknown>) ?? {}),
      leadOrigin: origen,
    }

    const updated = await this.prisma.deal.update({
      where: { id },
      data: {
        customFields: customFields as any,
        // Un lead que pasa a PROPIO deja de pertenecer al lote de un equipo: es
        // del asesor que lo consiguio, no material que se reparta.
        ...(origen === 'PROPIO' ? { equipoId: null } : {}),
      },
      include: { stage: true },
    })

    // Queda en la bitacora porque cambia la comision: tiene que ser rastreable
    // quien lo cambio y cuando.
    await this.prisma.activity.create({
      data: {
        type: 'NOTE',
        description: `Origen del lead cambiado de ${anterior} a ${origen}`,
        dealId: id,
        contactId: deal.contactId,
        organizationId,
        userId,
      },
    })

    return updated
  }

  async getUnassignedDeals(organizationId: string, role: string, userId?: string) {
    // Misma correccion que en comisiones: lista blanca en vez de lista negra.
    // Los leads sin asignar son material comercial (datos de contacto de
    // prospectos); solo administracion los reparte.
    if (!PUEDEN_REPARTIR_LEADS.includes(role)) {
      throw new ForbiddenException('No tienes acceso a los leads sin asignar')
    }

    const where: any = { organizationId, assignedToId: null, status: 'OPEN' }

    if (veSoloSuEquipo(role) && userId) {
      // El jefe ve UNICAMENTE el lote de su equipo: los que le tocaron por
      // reparto automatico y los que subio el mismo. Nunca los de otro equipo ni
      // los que estan en la bolsa comun sin repartir.
      const equipoId = await this.equipos.equipoDelJefe(userId, organizationId)
      // Sin equipo asignado todavia no le corresponde ningun lote. Se usa un id
      // imposible en vez de omitir el filtro: omitirlo le mostraria los leads de
      // toda la empresa por un dato faltante.
      where.equipoId = equipoId ?? '__sin_equipo__'
    }

    return this.prisma.deal.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        stage: true,
        equipo: { select: { id: true, nombre: true } },
        contact: {
          select: { id: true, firstName: true, lastName: true, phone: true, email: true, customFields: true },
        },
      },
    })
  }

  /**
   * Mueve un lead de un equipo a otro (o lo deja sin equipo con null).
   *
   * Solo gerencia. Un jefe no puede pasarle sus leads a otro equipo ni quitarle
   * los suyos: el reparto entre equipos lo decide administracion.
   *
   * Sirve para dos cosas: corregir un reparto automatico que no cuadra, y
   * repartir los leads viejos que quedaron sin equipo al activar esta funcion.
   */
  async cambiarEquipoDeal(
    id: string,
    equipoId: string | null,
    organizationId: string,
    userId: string,
    role: string,
  ) {
    if (!PUEDEN_ADMINISTRAR_LOTES.includes(role)) {
      throw new ForbiddenException('Solo administración puede mover leads entre equipos')
    }

    const deal = await this.getDeal(id, organizationId)

    // Un lead PROPIO no cambia de equipo, por la misma razon por la que no se
    // reasigna: es del vendedor que lo consiguio.
    if (!sePuedeReasignar(deal.customFields)) {
      throw new ForbiddenException('Los leads propios no se pueden mover de equipo')
    }

    if (equipoId) {
      const equipo = await this.prisma.equipo.findFirst({
        where: { id: equipoId, organizationId, activo: true },
        select: { id: true, nombre: true },
      })
      if (!equipo) throw new NotFoundException('Equipo no encontrado o inactivo')
    }

    const updated = await this.prisma.deal.update({
      where: { id },
      data: { equipoId },
      include: { stage: true, equipo: { select: { id: true, nombre: true } } },
    })

    await this.prisma.activity.create({
      data: {
        type: 'NOTE',
        description: equipoId
          ? `Lead movido al equipo ${(updated as any).equipo?.nombre ?? equipoId}`
          : 'Lead devuelto a la bolsa común',
        dealId: id,
        contactId: deal.contactId,
        organizationId,
        userId,
      },
    })

    return updated
  }

  async assignDeal(id: string, dto: AssignDealDto, organizationId: string, assignedById: string, role: string) {
    if (!PUEDEN_REPARTIR_LEADS.includes(role)) {
      throw new ForbiddenException('No tienes permiso para asignar negocios')
    }
    const deal = await this.getDeal(id, organizationId)

    // REGLA QUE NO SE ROMPE: un lead PROPIO es del vendedor que lo consiguio.
    // Se comprueba para TODOS los roles, no solo para el jefe de equipo: si el
    // dueno pudiera reasignarlo, la regla no seria tal.
    if (!sePuedeReasignar(deal.customFields)) {
      throw new ForbiddenException(
        'Los leads propios no se pueden reasignar: pertenecen al asesor que los consiguio',
      )
    }

    const agent = await this.prisma.user.findFirst({
      where: { id: dto.agentId, organizationId },
    })
    if (!agent) throw new NotFoundException('Agent not found')

    // El jefe de equipo solo reparte dentro de su equipo. Se valida en el
    // servidor y no solo escondiendo opciones en el desplegable, porque si no
    // bastaria con editar la peticion para colgarle un lead a otro equipo.
    if (veSoloSuEquipo(role)) {
      const miembros = await this.equipos.miembrosDelJefe(assignedById, organizationId)
      const permitidos = new Set([assignedById, ...miembros])
      if (!permitidos.has(dto.agentId)) {
        throw new ForbiddenException('Solo puedes asignar leads a integrantes de tu equipo')
      }
    }

    const updated = await this.prisma.deal.update({
      where: { id },
      data: { assignedToId: dto.agentId },
      include: {
        stage: true,
        contact: { select: { id: true, firstName: true, lastName: true, phone: true, email: true, customFields: true } },
        assignedTo: { select: { id: true, name: true, email: true, phone: true } },
      },
    })

    await this.prisma.activity.create({
      data: {
        type: 'STAGE_CHANGE',
        description: `Asignado a ${agent.name}`,
        dealId: id,
        contactId: deal.contactId,
        organizationId,
        userId: assignedById,
      },
    })

    this.gateway.broadcastLeadAssigned(dto.agentId, updated)
    this.gateway.broadcastDealUpdated(organizationId, updated)

    if (updated.assignedTo?.email && updated.contact) {
      const cf = updated.customFields as any
      const c = updated.contact as any
      const contactName = `${c.firstName}${c.lastName ? ` ${c.lastName}` : ''}`
      this.notifications
        .notifyDealAssigned(
          { id: updated.assignedTo.id, email: updated.assignedTo.email, phone: (updated.assignedTo as any).phone },
          {
            dealId: updated.id,
            orgId: organizationId,
            contactName,
            phone: c.phone ?? '',
            email: c.email ?? undefined,
            profileType: cf?.profileType ?? 'D',
            source: String(cf?.source ?? 'WEB'),
            arrivalTime: cf?.leadCreatedAt ? new Date(cf.leadCreatedAt) : new Date(),
          },
        )
        .catch(err => this.logger.error(`Notification error: ${err}`))
    }

    return updated
  }

  async getDeal(id: string, organizationId: string, userId?: string, role?: string, puedeVender?: boolean) {
    const deal = await this.prisma.deal.findFirst({
      where: { id, organizationId },
      include: {
        stage: true,
        contact: true,
        assignedTo: { select: { id: true, name: true, email: true, phone: true } },
        activities: {
          orderBy: { createdAt: 'desc' },
          take: 20,
          include: { user: { select: { id: true, name: true } } },
        },
      },
    })
    if (!deal) throw new NotFoundException('Deal not found')
    if (soloVeSusNegocios(role ?? '', puedeVender) && userId && deal.assignedToId !== userId) {
      throw new ForbiddenException('No tienes acceso a este deal')
    }
    return deal
  }

  async logActivity(
    dealId: string,
    dto: LogActivityDto,
    organizationId: string,
    userId: string,
    role?: string,
    puedeVender?: boolean,
  ) {
    const deal = await this.getDeal(dealId, organizationId, userId, role, puedeVender)
    return this.prisma.activity.create({
      data: {
        type: dto.type as any,
        description: dto.description,
        dealId,
        contactId: deal.contactId ?? null,
        organizationId,
        userId,
      },
      include: { user: { select: { id: true, name: true } } },
    })
  }

  /**
   * Entrega comercial → operaciones.
   *
   * Cuando un deal se marca como Ganado, esa persona deja de ser una oportunidad
   * y pasa a ser cliente. Se crea automáticamente, sin paso intermedio y sin
   * ejecutiva asignada, para que aparezca en la bandeja de Yessenia.
   *
   * Detalles que importan:
   * - `Cliente.contactId` es único, así que si el deal se cierra dos veces (o hay
   *   varios deals del mismo contacto) NO se duplica el cliente.
   * - `identificacion` es obligatoria pero el contacto comercial casi nunca trae
   *   cédula. Si no la encuentra, entra igual con un marcador y queda con el
   *   semáforo `revisar` encendido, para que la ejecutiva la complete.
   * - Nunca tumba el cierre del deal: si algo falla acá, se registra y ya. Cerrar
   *   la venta es lo crítico; la ficha se puede crear después a mano.
   */
  private async crearClienteDesdeDeal(dealId: string, organizationId: string, userId: string) {
    const deal = await this.prisma.deal.findFirst({
      where: { id: dealId, organizationId },
      select: {
        id: true,
        customFields: true,
        contact: {
          select: { id: true, firstName: true, lastName: true, email: true, phone: true },
        },
      },
    })

    // Un deal sin contacto no tiene a quién convertir en cliente.
    if (!deal?.contact) {
      this.logger.warn(
        `[crearClienteDesdeDeal] el deal ${dealId} no tiene contacto, no se crea cliente`,
      )
      return null
    }

    // Si ese contacto ya tiene ficha, no se crea otra: se le suman las polizas
    // nuevas. Antes se salia sin hacer nada y la segunda venta se perdia.
    const yaExiste = await this.prisma.cliente.findUnique({
      where: { contactId: deal.contact.id },
      select: { id: true },
    })
    if (yaExiste) {
      this.logger.log(
        `[crearClienteDesdeDeal] el contacto del deal ${dealId} ya tiene ficha (${yaExiste.id}); se le suman las polizas`,
      )
      await this.crearPolizasYNota(
        yaExiste.id,
        (deal.customFields ?? {}) as any,
        organizationId,
        userId,
      )
      return yaExiste
    }

    // La cedula la captura el comercial al cerrar y es OBLIGATORIA. Es la llave
    // real para no duplicar: Cliente ya es unico por (organizationId, identificacion).
    const cf = (deal.customFields ?? {}) as any
    const entradas: any[] = Array.isArray(cf?.insuranceData)
      ? cf.insuranceData
      : cf?.insuranceData
        ? [cf.insuranceData]
        : []
    const posible =
      entradas.map((e) => e?.identificacion).find((v) => typeof v === 'string' && v.trim()) ??
      cf?.autoData?.cedulaRuc ??
      cf?.cedula ??
      cf?.cedulaRuc ??
      null
    const cedula = typeof posible === 'string' ? posible.trim() : ''
    const tieneCedula = /^\d{10,13}$/.test(cedula)

    // Si el cliente YA existe con esa cedula, no se crea otro: se le suman las
    // polizas nuevas y la nota. Es el caso de venderle un segundo seguro a alguien
    // que ya es cliente.
    if (tieneCedula) {
      const porCedula = await this.prisma.cliente.findFirst({
        where: { organizationId, identificacion: cedula },
        select: { id: true },
      })
      if (porCedula) {
        this.logger.log(
          `[crearClienteDesdeDeal] el cliente ${porCedula.id} ya existe (cedula ${cedula}); se le suman las polizas del deal ${dealId}`,
        )
        await this.crearPolizasYNota(porCedula.id, cf, organizationId, userId)
        return porCedula
      }
    }

    // Sin cedula valida entra con marcador y el semaforo encendido. No deberia
    // pasar (el cierre la exige), pero quedan los deals cerrados antes del cambio.
    const identificacion = tieneCedula ? cedula : `PENDIENTE-${deal.contact.id.slice(-8)}`

    try {
      // Datos que el comercial va llenando en la ficha del lead (no al cerrar),
      // y que operaciones necesita. Viven en customFields del deal.
      const txt = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null)
      const direccion = txt(cf?.direccion)
      // Se guarda legible ("Sí — BMI") en vez del codigo, porque la ficha del
      // cliente lo muestra tal cual y ahi un "SI" a secas no dice nada.
      const otroSeguro = txt(cf?.vieneDeOtroSeguro)
      const aseguradoraPrevia = txt(cf?.aseguradoraAnterior)
      const vieneDeOtroSeguro =
        otroSeguro === 'SI'
          ? aseguradoraPrevia
            ? `Sí — ${aseguradoraPrevia}`
            : 'Sí'
          : otroSeguro === 'NO'
            ? 'No'
            : null

      const creado = await this.prisma.cliente.create({
        data: {
          nombres: deal.contact.firstName,
          apellidos: deal.contact.lastName ?? '',
          identificacion,
          email: deal.contact.email,
          celular: deal.contact.phone,
          ...(direccion ? { direccion } : {}),
          ...(vieneDeOtroSeguro ? { vieneDeOtroSeguro } : {}),
          // De donde vino el cliente. Se copia del deal porque despues no hay
          // forma de recuperarlo: la ficha nace sin ese contexto.
          origenLead: origenDeLead(deal.customFields),
          organizationId,
          contactId: deal.contact.id,
          createdById: userId,
          // Sin ejecutiva: así cae en la bandeja de "nuevos por asignar".
          ejecutivoId: null,
          revisar: true,
          revisarMotivo: tieneCedula
            ? 'Cliente creado automáticamente desde un deal ganado. Falta completar la ficha.'
            : 'Cliente creado automáticamente desde un deal ganado. Falta la cédula.',
        },
        select: { id: true },
      })
      this.logger.log(
        `[crearClienteDesdeDeal] cliente ${creado.id} creado desde el deal ${dealId} (cedula: ${identificacion})`,
      )
      await this.migrarDependientes(creado.id, cf)
      await this.crearPolizasYNota(creado.id, cf, organizationId, userId)
      return creado
    } catch (e) {
      // Puede chocar el unique de (organizationId, identificacion) si ya existía
      // una ficha con esa cédula cargada a mano. No es motivo para romper el cierre.
      this.logger.error(
        `[crearClienteDesdeDeal] no se pudo crear el cliente del deal ${dealId}: ${e}`,
      )
      return null
    }
  }

  /** Frecuencia de pago del cierre -> enum FormaPago del operativo. */
  private readonly FORMA_PAGO: Record<string, string> = {
    'pago-contado': 'CONTADO',
    contado: 'CONTADO',
    'debito-mensual': 'MENSUAL',
    mensual: 'MENSUAL',
    'diferido-especial': 'DIFERIDO_ESPECIAL',
    diferido: 'DIFERIDO',
  }

  /**
   * Pasa al operativo lo que el comercial capturo al cerrar: una poliza por cada
   * entrada del cierre, mas la nota para la ejecutiva.
   *
   * La idea es que la ejecutiva reciba la ficha lo mas completa posible y solo
   * corrija o complete, en vez de teclear todo de cero. Las polizas entran con
   * `revisar` encendido porque los datos vienen del comercial y no de la poliza
   * emitida: hay que confirmarlos antes de darlos por buenos.
   */
  /**
   * Copia los dependientes que el comercial cargo en el lead a la ficha del
   * cliente.
   *
   * En el lead viven dentro de customFields.additionalContacts (nombre historico,
   * en pantalla se llaman Dependientes). Sin esto, la ejecutiva tenia que volver a
   * teclearlos uno por uno.
   *
   * No revienta si algo falla: el cliente ya se creo y es lo importante.
   */
  private async migrarDependientes(clienteId: string, cf: any) {
    const lista = Array.isArray(cf?.additionalContacts) ? cf.additionalContacts : []
    if (lista.length === 0) return

    // El lead usa etiquetas sueltas ('esposa', 'hijo'); la ficha usa el enum
    // Parentesco. Lo que no cuadre entra como OTRO en vez de perderse.
    const PARENTESCO: Record<string, string> = {
      esposa: 'CONYUGE',
      esposo: 'CONYUGE',
      conyuge: 'CONYUGE',
      hijo: 'HIJO',
      hija: 'HIJA',
      padre: 'PADRE',
      madre: 'MADRE',
      hermano: 'HERMANO',
      hermana: 'HERMANA',
    }

    for (const d of lista) {
      const nombres = typeof d?.firstName === 'string' ? d.firstName.trim() : ''
      if (!nombres) continue
      try {
        // La fecha se fija a medianoche UTC: leerla en hora local guardaria el
        // dia anterior, el mismo error que ya corregimos en otras partes.
        const nac =
          typeof d?.birthDate === 'string' && d.birthDate
            ? new Date(`${d.birthDate.slice(0, 10)}T00:00:00.000Z`)
            : null

        await this.prisma.dependiente.create({
          data: {
            clienteId,
            nombres,
            apellidos: typeof d?.lastName === 'string' ? d.lastName.trim() || null : null,
            identificacion:
              typeof d?.identificacion === 'string' ? d.identificacion.trim() || null : null,
            ...(nac && !Number.isNaN(nac.getTime()) ? { fechaNacimiento: nac } : {}),
            parentesco: (PARENTESCO[String(d?.relationship ?? '').toLowerCase()] ?? 'OTRO') as any,
          },
        })
      } catch (err) {
        // Uno que falle no debe impedir que se copien los demas.
        this.logger.error(
          `[migrarDependientes] no se pudo copiar un dependiente del cliente ${clienteId}: ${err}`,
        )
      }
    }
  }

  private async crearPolizasYNota(
    clienteId: string,
    customFields: any,
    organizationId: string,
    userId: string,
  ) {
    const entradas: any[] = Array.isArray(customFields?.insuranceData)
      ? customFields.insuranceData
      : customFields?.insuranceData
        ? [customFields.insuranceData]
        : []

    if (entradas.length === 0) return

    const autor = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { name: true },
    })

    const RAMOS_VALIDOS = ['SALUD', 'AUTO', 'VIDA', 'HOGAR']
    const numero = (v: any) => {
      const n = Number(v)
      return Number.isFinite(n) && n > 0 ? n : null
    }

    for (const e of entradas) {
      try {
        const tipo = RAMOS_VALIDOS.includes(e?.ramo) ? e.ramo : 'SALUD'
        const anio = parseInt(e?.anio, 10)
        await this.prisma.poliza.create({
          data: {
            tipo: tipo as any,
            clienteId,
            organizationId,
            aseguradora: e?.aseguradora ?? null,
            plan: e?.plan ?? null,
            primaNeta: numero(e?.netPremium),
            sumaAsegurada: numero(e?.sumaAsegurada),
            formaPago: (this.FORMA_PAGO[e?.paymentFrequency] ?? null) as any,
            fechaEmision: e?.issueDate ? new Date(e.issueDate) : null,
            estado: 'NUEVO' as any,
            // Solo tienen sentido en AUTO, pero si vienen se guardan igual.
            marca: e?.marca ?? null,
            modelo: e?.modelo ?? null,
            anio: Number.isFinite(anio) ? anio : null,
            placa: e?.placa ?? null,
            agenteId: userId,
            agenteNombre: autor?.name ?? null,
            revisar: true,
            revisarMotivo:
              'Datos capturados por el comercial al cerrar el deal. Confirmar contra la póliza emitida.',
          },
        })
      } catch (err) {
        // Una poliza que falle no debe tumbar las demas ni el cliente.
        this.logger.error(
          `[crearPolizasYNota] no se pudo crear una poliza del cliente ${clienteId}: ${err}`,
        )
      }
    }

    // La nota del comercial va una sola vez, aunque venga repetida en cada entrada.
    const nota = entradas.map((e) => e?.notaOperaciones).find((n) => typeof n === 'string' && n.trim())
    if (nota) {
      try {
        await this.prisma.notaCliente.create({
          data: {
            contenido: `Nota del comercial al cerrar la venta: ${String(nota).trim()}`,
            clienteId,
            autorId: userId,
            autorNombre: autor?.name ?? null,
          },
        })
      } catch (err) {
        this.logger.error(
          `[crearPolizasYNota] no se pudo guardar la nota del cliente ${clienteId}: ${err}`,
        )
      }
    }

    this.logger.log(
      `[crearPolizasYNota] cliente ${clienteId}: ${entradas.length} poliza(s) creadas${nota ? ' + nota' : ''}`,
    )
  }

  /**
   * Eficiencia de gestion por vendedor.
   *
   * "Sin gestion" = lead asignado al que no se le hizo NADA dentro del plazo.
   * El plazo se cuenta en horas laborables, no corridas: un lead asignado el
   * viernes a las 6 de la tarde vence el miercoles, no el sabado.
   *
   * Tres estados a proposito, no dos: un lead asignado hace diez minutos todavia
   * no es "sin gestion", le queda tiempo. Mezclarlos castigaria injustamente a
   * quien acaba de recibir leads esta manana.
   */
  async getEficienciaGestion(organizationId: string) {
    const deals = await this.prisma.deal.findMany({
      where: { organizationId, assignedToId: { not: null } },
      select: {
        id: true,
        createdAt: true,
        assignedToId: true,
        assignedTo: { select: { id: true, name: true } },
        activities: {
          orderBy: { createdAt: 'asc' },
          select: { createdAt: true, description: true, type: true },
        },
      },
    })

    const ahora = new Date()
    const porVendedor = new Map<
      string,
      { id: string; nombre: string; gestionados: number; sinGestion: number; enPlazo: number; sumaHoras: number; conGestion: number }
    >()

    for (const d of deals) {
      const vendedorId = d.assignedToId as string
      const acc =
        porVendedor.get(vendedorId) ??
        {
          id: vendedorId,
          nombre: d.assignedTo?.name ?? 'Sin nombre',
          gestionados: 0,
          sinGestion: 0,
          enPlazo: 0,
          sumaHoras: 0,
          conGestion: 0,
        }
      porVendedor.set(vendedorId, acc)

      // El reloj arranca cuando se asigno. La asignacion queda registrada como
      // una actividad "Asignado a ...". Si el deal nacio ya asignado, no hay tal
      // actividad y se usa la fecha de creacion.
      const asignacion = [...d.activities]
        .reverse()
        .find((a) => (a.description ?? '').startsWith('Asignado a'))
      const inicio = asignacion?.createdAt ?? d.createdAt

      // Cuenta como gestion cualquier actividad POSTERIOR a la asignacion que no
      // sea la asignacion misma (esa la hace el jefe, no el vendedor).
      const primeraGestion = d.activities.find(
        (a) =>
          a.createdAt > inicio && !(a.description ?? '').startsWith('Asignado a'),
      )

      if (primeraGestion) {
        const horas = horasLaborables(inicio, primeraGestion.createdAt)
        if (horas <= HORAS_PLAZO_GESTION) {
          acc.gestionados++
          acc.sumaHoras += horas
          acc.conGestion++
          continue
        }
        // Gestionado, pero tarde: cuenta como sin gestion en el plazo.
        acc.sinGestion++
        continue
      }

      // Sin ninguna gestion todavia: depende de si ya se le vencio el plazo.
      const vence = sumarHorasLaborables(inicio, HORAS_PLAZO_GESTION)
      if (ahora > vence) acc.sinGestion++
      else acc.enPlazo++
    }

    return [...porVendedor.values()]
      .map((v) => {
        const total = v.gestionados + v.sinGestion + v.enPlazo
        // El porcentaje se mide solo sobre los que YA vencieron: incluir los que
        // aun estan en plazo ensuciaria el numero segun la hora del dia.
        const evaluables = v.gestionados + v.sinGestion
        return {
          id: v.id,
          nombre: v.nombre,
          total,
          gestionados: v.gestionados,
          sinGestion: v.sinGestion,
          enPlazo: v.enPlazo,
          porcentajeGestion: evaluables > 0 ? Math.round((v.gestionados / evaluables) * 100) : null,
          horasPromedio: v.conGestion > 0 ? Math.round((v.sumaHoras / v.conGestion) * 10) / 10 : null,
        }
      })
      .sort((a, b) => (b.porcentajeGestion ?? -1) - (a.porcentajeGestion ?? -1))
  }

  async closeDeal(
    id: string,
    dto: CloseDealDto,
    organizationId: string,
    userId: string,
    role?: string,
    puedeVender?: boolean,
  ) {
    const deal = await this.getDeal(id, organizationId, userId, role, puedeVender)

    // Belt-and-suspenders: if value is missing, sync from insuranceData (array or object) or prima
    const cfPrima     = (deal.customFields as any)?.prima
    const rawIns      = (deal.customFields as any)?.insuranceData
    let cfNetPremium: number | undefined
    if (Array.isArray(rawIns)) {
      const total = rawIns.reduce((s: number, e: any) => s + (typeof e.netPremium === 'number' ? e.netPremium : 0), 0)
      if (total > 0) cfNetPremium = total
    } else if (rawIns && typeof rawIns === 'object') {
      const np = rawIns.netPremium
      if (typeof np === 'number' && np > 0) cfNetPremium = np
    }
    const syncValue   = cfNetPremium !== undefined ? cfNetPremium
                      : typeof cfPrima === 'number' && cfPrima > 0 ? cfPrima
                      : undefined
    const valuePatch =
      dto.status === 'WON' && syncValue !== undefined && !deal.value
        ? { value: syncValue }
        : {}

    const updated = await this.prisma.deal.update({
      where: { id },
      data: {
        status: dto.status as any,
        closedAt: new Date(),
        ...(dto.status === 'WON' ? { stageId: this.WON_STAGE_ID } : {}),
        ...valuePatch,
        ...(dto.closingReason ? { notes: dto.closingReason } : {}),
      },
      include: {
        stage: true,
        contact: { select: { id: true, firstName: true, lastName: true } },
        assignedTo: { select: { id: true, name: true } },
      },
    })

    await this.prisma.activity.create({
      data: {
        type: 'NOTE',
        description:
          dto.status === 'WON'
            ? 'Deal marcado como Ganado'
            : `Deal marcado como Perdido${dto.closingReason ? `: ${dto.closingReason}` : ''}`,
        dealId: id,
        contactId: deal.contactId ?? null,
        organizationId,
        userId,
      },
    })

    // Entrega a operaciones: el ganado se vuelve cliente al instante, sin paso
    // intermedio. Aislado en su propio try para que un fallo acá nunca impida
    // cerrar la venta.
    if (dto.status === 'WON') {
      try {
        await this.crearClienteDesdeDeal(id, organizationId, userId)
      } catch (e) {
        this.logger.error(`[closeDeal] fallo la entrega a operaciones del deal ${id}: ${e}`)
      }
    }

    this.gateway.broadcastDealUpdated(organizationId, updated)
    return updated
  }

  async createDeal(
    dto: CreateDealDto,
    organizationId: string,
    createdById: string,
    role: string,
    puedeVender?: boolean,
  ) {
    const lastDeal = await this.prisma.deal.findFirst({
      where: { stageId: dto.stageId },
      orderBy: { position: 'desc' },
    })
    const position = (lastDeal?.position ?? 0) + 1000

    const customFields: Record<string, unknown> = { ...(dto.customFields as any) }
    let assignedToId = dto.assignedToId

    if (soloVeSusNegocios(role, puedeVender)) {
      // Quien solo gestiona lo suyo —vendedor de planta, o perfil de Operaciones
      // con el permiso— crea negocios unicamente para si mismo. El origen y la
      // asignacion se imponen en el servidor: no se confia en lo que mande el
      // cliente, porque si no bastaria con editar la peticion para colgarle un
      // negocio a otra persona.
      customFields.leadOrigin = 'PROPIO'
      assignedToId = createdById
    } else {
      // Antes esto aplastaba a PRIORITY_HEALTH cualquier origen que no fuera
      // PROPIO, asi que los leads subidos por Excel (PRIORITY) perdian su
      // etiqueta en silencio. Ahora se respetan los tres valores validos y solo
      // se normaliza lo desconocido.
      customFields.leadOrigin = origenDeLead(customFields)
    }

    return this.prisma.deal.create({
      data: { ...dto, assignedToId, customFields: customFields as any, organizationId, createdById, position },
      include: { stage: true, contact: { select: { id: true, firstName: true, lastName: true } } },
    })
  }

  async updateDeal(
    id: string,
    dto: UpdateDealDto,
    organizationId: string,
    userId?: string,
    role?: string,
    puedeVender?: boolean,
  ) {
    const existing = await this.getDeal(id, organizationId, userId, role, puedeVender)

    const data: any = { ...dto }

    // Sync revenue field from insurance data (array) or legacy prima
    const rawInsurance = (dto.customFields as any)?.insuranceData
    const prima = (dto.customFields as any)?.prima
    if (Array.isArray(rawInsurance)) {
      const total = rawInsurance.reduce((s: number, e: any) => s + (typeof e.netPremium === 'number' ? e.netPremium : 0), 0)
      if (total > 0) data.value = total
    } else if (rawInsurance && typeof rawInsurance === 'object') {
      const netPremium = rawInsurance.netPremium
      if (typeof netPremium === 'number' && netPremium >= 0) data.value = netPremium
    } else if (typeof prima === 'number' && prima >= 0) {
      data.value = prima
    }

    const updated = await this.prisma.deal.update({
      where: { id },
      data,
      include: {
        stage: true,
        contact: { select: { id: true, firstName: true, lastName: true, phone: true } },
        assignedTo: { select: { id: true, name: true, email: true, phone: true } },
      },
    })

    // Schedule follow-up reminders when followUpAt is set or changed
    const newFollowUpAt = (dto.customFields as any)?.followUpAt as string | undefined
    const oldFollowUpAt = (existing.customFields as any)?.followUpAt as string | undefined
    console.log('Saving follow-up for deal:', id)
    console.log('Follow-up date:', newFollowUpAt ?? '(not set in this update)')
    console.log('Old follow-up date:', oldFollowUpAt ?? '(none)')
    console.log('assignedTo:', updated.assignedTo?.id ?? '(unassigned)')
    if (newFollowUpAt && newFollowUpAt !== oldFollowUpAt && updated.assignedTo) {
      console.log('Scheduling BullMQ jobs...')
      const c = updated.contact as any
      const contactName = c
        ? `${c.firstName}${c.lastName ? ` ${c.lastName}` : ''}`
        : updated.title
      this.notifications
        .scheduleFollowUpReminders({
          dealId: id,
          orgId: organizationId,
          contactName,
          phone: c?.phone ?? '',
          followUpAt: newFollowUpAt,
          agentId: updated.assignedTo.id,
        })
        .catch(err => this.logger.error(`Follow-up scheduling error: ${err}`))
    } else {
      console.log('BullMQ scheduling skipped — no change, no date, or deal unassigned')
    }

    this.gateway.broadcastDealUpdated(organizationId, updated)
    return updated
  }

  private readonly WON_STAGE_ID = 'cmohtra9r000bz5t3q407kx05'

  async moveDeal(
    id: string,
    dto: MoveDealDto,
    organizationId: string,
    userId: string,
    role?: string,
    puedeVender?: boolean,
  ) {
    const deal = await this.getDeal(id, organizationId, userId, role, puedeVender)

    if ((deal.customFields as any)?.locked) {
      throw new ForbiddenException('Este deal está cerrado y no puede moverse de etapa')
    }

    const isMovingToWon = dto.stageId === this.WON_STAGE_ID
    const extraFields: Record<string, unknown> = {}

    if (isMovingToWon && dto.insuranceData && dto.insuranceData.length > 0) {
      const entries = dto.insuranceData.map((e, i) => ({ id: `${Date.now()}-${i}`, ...e }))
      const totalPremium = entries.reduce((s, e) => s + (typeof e.netPremium === 'number' ? e.netPremium : 0), 0)
      extraFields.customFields = {
        ...(deal.customFields as Record<string, unknown>),
        insuranceData: entries,
        locked: true,
      }
      extraFields.value = totalPremium
    }

    const wonFields = isMovingToWon ? { status: 'WON' as const, closedAt: new Date() } : {}

    const updated = await this.prisma.deal.update({
      where: { id },
      data: { stageId: dto.stageId, position: dto.position, ...wonFields, ...extraFields },
      include: {
        stage: true,
        contact: { select: { id: true, firstName: true, lastName: true, phone: true } },
        assignedTo: { select: { id: true, name: true } },
      },
    })

    await this.prisma.activity.create({
      data: {
        type: 'STAGE_CHANGE',
        description: `Moved to ${updated.stage.name}`,
        dealId: id,
        contactId: deal.contactId,
        organizationId,
        userId,
      },
    })

    this.gateway.broadcastDealMoved(organizationId, updated)

    if (isMovingToWon) {
      // Entrega a operaciones. Va tambien aca, no solo en closeDeal, porque
      // arrastrar la tarjeta a la columna Ganado es otro camino distinto y era
      // el que se estaba usando: el cliente no se creaba.
      try {
        await this.crearClienteDesdeDeal(id, organizationId, userId)
      } catch (e) {
        this.logger.error(`[moveDeal] fallo la entrega a operaciones del deal ${id}: ${e}`)
      }

      const c = updated.contact as any
      const cf = updated.customFields as any
      const contactName = c ? `${c.firstName}${c.lastName ? ` ${c.lastName}` : ''}` : updated.title
      this.notifications
        .notifyDealWon({
          dealId: id,
          orgId: organizationId,
          contactName,
          phone: c?.phone ?? '',
          plan: Array.isArray(cf?.insuranceData) ? cf.insuranceData[0]?.plan : cf?.insuranceData?.plan,
          netPremium: Array.isArray(cf?.insuranceData)
            ? cf.insuranceData.reduce((s: number, e: any) => s + (typeof e.netPremium === 'number' ? e.netPremium : 0), 0)
            : (cf?.insuranceData?.netPremium ?? (typeof cf?.prima === 'number' ? cf.prima : undefined)),
          vendorName: updated.assignedTo?.name ?? 'Sin asignar',
          closedAt: new Date(),
        })
        .catch(err => this.logger.error(`Deal-won notification error: ${err}`))
    }

    return updated
  }

  async addFutureOpportunity(dealId: string, dto: AddFutureOpportunityDto, organizationId: string) {
    const deal = await this.prisma.deal.findFirst({
      where: { id: dealId, organizationId },
      include: { contact: { select: { firstName: true, lastName: true, phone: true, email: true } } },
    })
    if (!deal) throw new NotFoundException('Deal not found')

    const oppId = Date.now().toString()
    const existing = (deal.customFields as any)?.futureOpportunities ?? []
    const newOpp = {
      id: oppId,
      insuranceType: dto.insuranceType,
      contactDate: dto.contactDate,
      note: dto.note ?? '',
      createdAt: new Date().toISOString(),
    }

    const updated = await this.prisma.deal.update({
      where: { id: dealId },
      data: { customFields: { ...(deal.customFields as any), futureOpportunities: [...existing, newOpp] } },
    })

    const c = deal.contact as any
    const contactName = c ? `${c.firstName}${c.lastName ? ` ${c.lastName}` : ''}` : deal.title

    this.notifications
      .scheduleFutureOpportunity({
        dealId,
        oppId,
        orgId: organizationId,
        contactName,
        phone: c?.phone ?? '',
        email: c?.email ?? undefined,
        insuranceType: dto.insuranceType,
        note: dto.note ?? '',
        contactDate: dto.contactDate,
      })
      .catch(err => this.logger.error(`Error scheduling future opportunity: ${err}`))

    this.gateway.broadcastDealUpdated(organizationId, updated)
    return updated
  }

  async removeFutureOpportunity(dealId: string, oppId: string, organizationId: string) {
    const deal = await this.prisma.deal.findFirst({ where: { id: dealId, organizationId } })
    if (!deal) throw new NotFoundException('Deal not found')

    const existing = (deal.customFields as any)?.futureOpportunities ?? []
    const filtered = existing.filter((o: any) => o.id !== oppId)

    const updated = await this.prisma.deal.update({
      where: { id: dealId },
      data: { customFields: { ...(deal.customFields as any), futureOpportunities: filtered } },
    })

    this.notifications
      .cancelFutureOpportunity(dealId, oppId)
      .catch(err => this.logger.error(`Error cancelling future opportunity job: ${err}`))

    this.gateway.broadcastDealUpdated(organizationId, updated)
    return updated
  }

  async deleteDeal(id: string, organizationId: string) {
    const deal = await this.getDeal(id, organizationId)
    const contactId = deal.contactId

    await this.prisma.$transaction(async (tx) => {
      await tx.activity.deleteMany({ where: { dealId: id } })
      await tx.deal.delete({ where: { id } })

      if (contactId) {
        const otherDeals = await tx.deal.count({ where: { contactId } })
        if (otherDeals === 0) {
          await tx.activity.updateMany({ where: { contactId }, data: { contactId: null } })
          await tx.conversation.updateMany({ where: { contactId }, data: { contactId: null } })
          await tx.contact.delete({ where: { id: contactId } })
        }
      }
    })

    return { id, deleted: true }
  }
}
