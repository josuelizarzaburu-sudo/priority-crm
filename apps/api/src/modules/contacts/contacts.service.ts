import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { CreateContactDto } from './dto/create-contact.dto'
import { UpdateContactDto } from './dto/update-contact.dto'
import { ContactsQueryDto } from './dto/contacts-query.dto'
import { LogInteractionDto } from './dto/log-interaction.dto'

const CALL_RESULT_LABEL: Record<string, string> = {
  answered: 'Contestó',
  no_answer: 'No contestó',
  voicemail: 'Buzón de voz',
}

@Injectable()
export class ContactsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(organizationId: string, query: ContactsQueryDto, userId: string, role: string) {
    const { search, page = 1, limit = 20, status, assignedTo } = query
    const skip = (page - 1) * limit

    const where: any = { organizationId }
    if (role === 'MEMBER') where.assignedToId = userId
    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search } },
        { company: { contains: search, mode: 'insensitive' } },
      ]
    }
    if (status) where.status = status
    if (assignedTo && role !== 'MEMBER') where.assignedToId = assignedTo

    const [data, total] = await Promise.all([
      this.prisma.contact.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { assignedTo: { select: { id: true, name: true, email: true } }, tags: true },
      }),
      this.prisma.contact.count({ where }),
    ])

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) }
  }

  async findOne(id: string, organizationId: string, userId?: string, role?: string) {
    const contact = await this.prisma.contact.findFirst({
      where: { id, organizationId },
      include: {
        assignedTo: { select: { id: true, name: true, email: true } },
        tags: true,
        deals: { include: { stage: true } },
      },
    })
    if (!contact) throw new NotFoundException('Contact not found')
    if (role === 'MEMBER' && contact.assignedToId !== userId) {
      throw new ForbiddenException('Access denied')
    }
    return contact
  }

  async create(dto: CreateContactDto, organizationId: string, createdById: string) {
    return this.prisma.contact.create({
      data: { ...dto, customFields: dto.customFields as any, organizationId, createdById },
      include: { assignedTo: { select: { id: true, name: true } } },
    })
  }

  async update(id: string, dto: UpdateContactDto, organizationId: string) {
    await this.findOne(id, organizationId)
    return this.prisma.contact.update({ where: { id }, data: dto as any })
  }

  async remove(id: string, organizationId: string) {
    await this.findOne(id, organizationId)
    return this.prisma.contact.delete({ where: { id } })
  }

  async getTimeline(id: string, organizationId: string, userId?: string, role?: string) {
    await this.findOne(id, organizationId, userId, role)
    const [activities, messages, deals] = await Promise.all([
      this.prisma.activity.findMany({
        where: { contactId: id },
        orderBy: { createdAt: 'desc' },
        take: 100,
        include: { user: { select: { id: true, name: true } } },
      }),
      this.prisma.message.findMany({
        where: { conversation: { contactId: id } },
        orderBy: { createdAt: 'desc' },
        take: 50,
        include: { conversation: { select: { channel: true } } },
      }),
      this.prisma.deal.findMany({
        where: { contactId: id },
        include: { stage: true },
      }),
    ])
    return { activities, messages, deals }
  }

  async logInteraction(
    id: string,
    dto: LogInteractionDto,
    organizationId: string,
    userId: string,
    role?: string,
  ) {
    await this.findOne(id, organizationId, userId, role)

    let type: string
    let description: string

    if (dto.type === 'CALL') {
      type = 'CALL'
      const resultLabel = CALL_RESULT_LABEL[dto.callResult ?? ''] ?? dto.callResult ?? ''
      description = dto.description || `Llamada${resultLabel ? ` — ${resultLabel}` : ''}`
    } else if (dto.type === 'WHATSAPP') {
      type = 'MESSAGE_SENT'
      description = dto.description || 'WhatsApp enviado'
    } else if (dto.type === 'EMAIL') {
      type = 'EMAIL'
      description = dto.description || 'Email enviado'
    } else {
      type = 'NOTE'
      description = dto.description || 'Nota interna'
    }

    return this.prisma.activity.create({
      data: {
        type: type as any,
        description,
        metadata: { channel: dto.type, ...(dto.callResult ? { callResult: dto.callResult } : {}) },
        contactId: id,
        organizationId,
        userId,
      },
      include: { user: { select: { id: true, name: true } } },
    })
  }
}
