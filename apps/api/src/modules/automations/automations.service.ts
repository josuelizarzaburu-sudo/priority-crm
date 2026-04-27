import { Injectable, NotFoundException } from '@nestjs/common'
import { InjectQueue } from '@nestjs/bull'
import { Queue } from 'bull'
import { PrismaService } from '../../prisma/prisma.service'

@Injectable()
export class AutomationsService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue('automations') private readonly queue: Queue,
  ) {}

  findAll(organizationId: string) {
    return this.prisma.automation.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
    })
  }

  async findOne(id: string, organizationId: string) {
    const automation = await this.prisma.automation.findFirst({ where: { id, organizationId } })
    if (!automation) throw new NotFoundException('Automation not found')
    return automation
  }

  create(data: any, organizationId: string, createdById: string) {
    return this.prisma.automation.create({ data: { ...data, organizationId, createdById } })
  }

  async update(id: string, data: any, organizationId: string) {
    await this.findOne(id, organizationId)
    return this.prisma.automation.update({ where: { id }, data })
  }

  async toggle(id: string, organizationId: string) {
    const automation = await this.findOne(id, organizationId)
    return this.prisma.automation.update({
      where: { id },
      data: { isActive: !automation.isActive },
    })
  }

  async remove(id: string, organizationId: string) {
    await this.findOne(id, organizationId)
    return this.prisma.automation.delete({ where: { id } })
  }

  async triggerEvent(event: string, payload: any, organizationId: string) {
    const automations = await this.prisma.automation.findMany({
      where: { organizationId, isActive: true, trigger: event },
    })
    for (const automation of automations) {
      await this.queue.add('execute', { automation, payload })
    }
  }
}
