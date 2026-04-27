import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { CreateDealDto } from './dto/create-deal.dto'
import { UpdateDealDto } from './dto/update-deal.dto'
import { MoveDealDto } from './dto/move-deal.dto'
import { AssignDealDto } from './dto/assign-deal.dto'
import { PipelineGateway } from './pipeline.gateway'

@Injectable()
export class PipelineService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: PipelineGateway,
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
    if (role === 'MEMBER') where.assignedToId = userId
    return this.prisma.deal.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        stage: true,
        contact: { select: { id: true, firstName: true, lastName: true } },
        assignedTo: { select: { id: true, name: true } },
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
    if (role === 'MEMBER') throw new ForbiddenException('Agents cannot view unassigned deals')
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
    if (role === 'MEMBER') throw new ForbiddenException('Agents cannot assign deals')
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
        assignedTo: { select: { id: true, name: true, email: true } },
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
    return updated
  }

  async getDeal(id: string, organizationId: string) {
    const deal = await this.prisma.deal.findFirst({
      where: { id, organizationId },
      include: {
        stage: true,
        contact: true,
        assignedTo: { select: { id: true, name: true, email: true } },
        activities: { orderBy: { createdAt: 'desc' }, take: 20 },
      },
    })
    if (!deal) throw new NotFoundException('Deal not found')
    return deal
  }

  async createDeal(dto: CreateDealDto, organizationId: string, createdById: string) {
    const lastDeal = await this.prisma.deal.findFirst({
      where: { stageId: dto.stageId },
      orderBy: { position: 'desc' },
    })
    const position = (lastDeal?.position ?? 0) + 1000

    return this.prisma.deal.create({
      data: { ...dto, organizationId, createdById, position },
      include: { stage: true, contact: { select: { id: true, firstName: true, lastName: true } } },
    })
  }

  async updateDeal(id: string, dto: UpdateDealDto, organizationId: string) {
    await this.getDeal(id, organizationId)
    return this.prisma.deal.update({ where: { id }, data: dto })
  }

  async moveDeal(id: string, dto: MoveDealDto, organizationId: string, userId: string) {
    const deal = await this.getDeal(id, organizationId)
    const updated = await this.prisma.deal.update({
      where: { id },
      data: { stageId: dto.stageId, position: dto.position },
      include: { stage: true },
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
    return updated
  }

  async deleteDeal(id: string, organizationId: string) {
    await this.getDeal(id, organizationId)
    return this.prisma.deal.delete({ where: { id } })
  }
}
