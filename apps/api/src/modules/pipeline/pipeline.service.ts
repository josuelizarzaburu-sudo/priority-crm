import { Injectable, Logger, NotFoundException, ForbiddenException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { CreateDealDto } from './dto/create-deal.dto'
import { UpdateDealDto } from './dto/update-deal.dto'
import { MoveDealDto } from './dto/move-deal.dto'
import { AssignDealDto } from './dto/assign-deal.dto'
import { LogActivityDto } from './dto/log-activity.dto'
import { CloseDealDto } from './dto/close-deal.dto'
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
    return this.prisma.deal.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        stage: true,
        contact: { select: { id: true, firstName: true, lastName: true } },
        assignedTo: { select: { id: true, name: true } },
        activities: { orderBy: { createdAt: 'desc' }, take: 1, select: { createdAt: true } },
      },
    })
  }

  async getMyDeals(userId: string, organizationId: string) {
    return this.prisma.deal.findMany({
      where: { organizationId, assignedToId: userId },
      orderBy: { position: 'asc' },
      include: {
        stage: true,
        contact: { select: { id: true, firstName: true, lastName: true, company: true } },
        activities: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
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

  async closeDeal(id: string, dto: CloseDealDto, organizationId: string, userId: string, role?: string) {
    const deal = await this.getDeal(id, organizationId, userId, role)

    // Belt-and-suspenders: if value is missing, sync from insuranceData.netPremium or prima
    const cfPrima      = (deal.customFields as any)?.prima
    const cfNetPremium = (deal.customFields as any)?.insuranceData?.netPremium
    const syncValue    = typeof cfNetPremium === 'number' && cfNetPremium > 0 ? cfNetPremium
                       : typeof cfPrima      === 'number' && cfPrima      > 0 ? cfPrima
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

    this.gateway.broadcastDealUpdated(organizationId, updated)
    return updated
  }

  async createDeal(dto: CreateDealDto, organizationId: string, createdById: string) {
    const lastDeal = await this.prisma.deal.findFirst({
      where: { stageId: dto.stageId },
      orderBy: { position: 'desc' },
    })
    const position = (lastDeal?.position ?? 0) + 1000

    return this.prisma.deal.create({
      data: { ...dto, customFields: dto.customFields as any, organizationId, createdById, position },
      include: { stage: true, contact: { select: { id: true, firstName: true, lastName: true } } },
    })
  }

  async updateDeal(id: string, dto: UpdateDealDto, organizationId: string, userId?: string, role?: string) {
    const existing = await this.getDeal(id, organizationId, userId, role)

    const data: any = { ...dto }

    // Sync revenue field: insuranceData.netPremium takes precedence over legacy prima
    const netPremium = (dto.customFields as any)?.insuranceData?.netPremium
    const prima      = (dto.customFields as any)?.prima
    if (typeof netPremium === 'number' && netPremium >= 0) {
      data.value = netPremium
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
    const updated = await this.prisma.deal.update({
      where: { id },
      data: { stageId: dto.stageId, position: dto.position },
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

    if (dto.stageId === this.WON_STAGE_ID) {
      const c = updated.contact as any
      const cf = updated.customFields as any
      const contactName = c ? `${c.firstName}${c.lastName ? ` ${c.lastName}` : ''}` : updated.title
      this.notifications
        .notifyDealWon({
          dealId: id,
          orgId: organizationId,
          contactName,
          phone: c?.phone ?? '',
          plan: cf?.insuranceData?.plan ?? undefined,
          netPremium: cf?.insuranceData?.netPremium ?? (typeof cf?.prima === 'number' ? cf.prima : undefined),
          vendorName: updated.assignedTo?.name ?? 'Sin asignar',
          closedAt: new Date(),
        })
        .catch(err => this.logger.error(`Deal-won notification error: ${err}`))
    }

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
