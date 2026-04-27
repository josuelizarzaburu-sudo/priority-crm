import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { CreateContactDto } from './dto/create-contact.dto'
import { UpdateContactDto } from './dto/update-contact.dto'
import { ContactsQueryDto } from './dto/contacts-query.dto'

@Injectable()
export class ContactsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(organizationId: string, query: ContactsQueryDto) {
    const { search, page = 1, limit = 20, status, assignedTo } = query
    const skip = (page - 1) * limit

    const where: any = { organizationId }
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
    if (assignedTo) where.assignedToId = assignedTo

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

  async findOne(id: string, organizationId: string) {
    const contact = await this.prisma.contact.findFirst({
      where: { id, organizationId },
      include: {
        assignedTo: { select: { id: true, name: true, email: true } },
        tags: true,
        deals: { include: { stage: true } },
        activities: { orderBy: { createdAt: 'desc' }, take: 20 },
      },
    })
    if (!contact) throw new NotFoundException('Contact not found')
    return contact
  }

  async create(dto: CreateContactDto, organizationId: string, createdById: string) {
    return this.prisma.contact.create({
      data: { ...dto, organizationId, createdById },
      include: { assignedTo: { select: { id: true, name: true } } },
    })
  }

  async update(id: string, dto: UpdateContactDto, organizationId: string) {
    await this.findOne(id, organizationId)
    return this.prisma.contact.update({ where: { id }, data: dto })
  }

  async remove(id: string, organizationId: string) {
    await this.findOne(id, organizationId)
    return this.prisma.contact.delete({ where: { id } })
  }

  async getTimeline(id: string, organizationId: string) {
    await this.findOne(id, organizationId)
    const [activities, messages, deals] = await Promise.all([
      this.prisma.activity.findMany({
        where: { contactId: id },
        orderBy: { createdAt: 'desc' },
        take: 50,
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
}
