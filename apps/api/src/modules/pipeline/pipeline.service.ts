import { Injectable, Logger, NotFoundException, ForbiddenException } from '@nestjs/common'
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

@Injectable()
export class PipelineService {
  private readonly logger = new Logger(PipelineService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: PipelineGateway,
    private readonly notifications: NotificationsService,
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

  async getDeals(organizationId: string, userId: string, role: string) {
    const where: any = { organizationId }
    if (role === 'SALES_REP') where.assignedToId = userId
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
    if (role === 'SALES_REP') throw new ForbiddenException('No tienes acceso al reporte de comisiones')
    return this.prisma.deal.findMany({
      where: { organizationId, status: 'WON' },
      orderBy: { closedAt: 'desc' },
      include: {
        contact: { select: { id: true, firstName: true, lastName: true } },
        assignedTo: { select: { id: true, name: true } },
      },
    })
  }

  async getUnassignedDeals(organizationId: string, role: string) {
    if (role === 'SALES_REP') throw new ForbiddenException('Agents cannot view unassigned deals')
    return this.prisma.deal.findMany({
      where: { organizationId, assignedToId: null, status: 'OPEN' },
      orderBy: { createdAt: 'desc' },
      include: {
        stage: true,
        contact: {
          select: { id: true, firstName: true, lastName: true, phone: true, email: true, customFields: true },
        },
      },
    })
  }

  async assignDeal(id: string, dto: AssignDealDto, organizationId: string, assignedById: string, role: string) {
    if (role === 'SALES_REP') throw new ForbiddenException('Agents cannot assign deals')
    const deal = await this.getDeal(id, organizationId)

    const agent = await this.prisma.user.findFirst({
      where: { id: dto.agentId, organizationId },
    })
    if (!agent) throw new NotFoundException('Agent not found')

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

  async getDeal(id: string, organizationId: string, userId?: string, role?: string) {
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
    if (role === 'SALES_REP' && userId && deal.assignedToId !== userId) {
      throw new ForbiddenException('No tienes acceso a este deal')
    }
    return deal
  }

  async logActivity(dealId: string, dto: LogActivityDto, organizationId: string, userId: string, role?: string) {
    const deal = await this.getDeal(dealId, organizationId, userId, role)
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

    // Si ese contacto ya tiene ficha, no se toca (el candado real es el @unique).
    const yaExiste = await this.prisma.cliente.findUnique({
      where: { contactId: deal.contact.id },
      select: { id: true },
    })
    if (yaExiste) return yaExiste

    // La cédula puede venir del formulario de auto o de campos sueltos del lead.
    const cf = (deal.customFields ?? {}) as any
    const posible = cf?.autoData?.cedulaRuc ?? cf?.cedula ?? cf?.cedulaRuc ?? null
    const cedula = typeof posible === 'string' ? posible.trim() : ''
    const tieneCedula = /^\d{10,13}$/.test(cedula)

    // Sin cédula real se usa un marcador: cumple el unique y se ve claramente
    // que está pendiente. La ejecutiva lo corrige al completar la ficha.
    const identificacion = tieneCedula ? cedula : `PENDIENTE-${deal.contact.id.slice(-8)}`

    try {
      const creado = await this.prisma.cliente.create({
        data: {
          nombres: deal.contact.firstName,
          apellidos: deal.contact.lastName ?? '',
          identificacion,
          email: deal.contact.email,
          celular: deal.contact.phone,
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

  async closeDeal(id: string, dto: CloseDealDto, organizationId: string, userId: string, role?: string) {
    const deal = await this.getDeal(id, organizationId, userId, role)

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

  async createDeal(dto: CreateDealDto, organizationId: string, createdById: string, role: string) {
    const lastDeal = await this.prisma.deal.findFirst({
      where: { stageId: dto.stageId },
      orderBy: { position: 'desc' },
    })
    const position = (lastDeal?.position ?? 0) + 1000

    const customFields: Record<string, unknown> = { ...(dto.customFields as any) }
    let assignedToId = dto.assignedToId

    if (role === 'SALES_REP') {
      // Sales reps can only create deals for their own book of business —
      // origin and assignment are enforced server-side, not trusted from the client.
      customFields.leadOrigin = 'PROPIO'
      assignedToId = createdById
    } else {
      customFields.leadOrigin = customFields.leadOrigin === 'PROPIO' ? 'PROPIO' : 'PRIORITY_HEALTH'
    }

    return this.prisma.deal.create({
      data: { ...dto, assignedToId, customFields: customFields as any, organizationId, createdById, position },
      include: { stage: true, contact: { select: { id: true, firstName: true, lastName: true } } },
    })
  }

  async updateDeal(id: string, dto: UpdateDealDto, organizationId: string, userId?: string, role?: string) {
    const existing = await this.getDeal(id, organizationId, userId, role)

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

  async moveDeal(id: string, dto: MoveDealDto, organizationId: string, userId: string, role?: string) {
    const deal = await this.getDeal(id, organizationId, userId, role)

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
