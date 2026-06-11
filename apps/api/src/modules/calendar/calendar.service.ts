import { Injectable, Logger, NotFoundException, ForbiddenException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { NotificationsService } from '../notifications/notifications.service'
import { CreateCalendarEventDto } from './dto/create-calendar-event.dto'

@Injectable()
export class CalendarService {
  private readonly logger = new Logger(CalendarService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  private readonly include = {
    createdBy: { select: { id: true, name: true } },
    participants: {
      include: { user: { select: { id: true, name: true, email: true, phone: true } } },
    },
  }

  async getEvents(orgId: string, year: number, month: number) {
    const start = new Date(year, month - 1, 1)
    const end = new Date(year, month, 0, 23, 59, 59, 999)
    return this.prisma.calendarEvent.findMany({
      where: { organizationId: orgId, startAt: { gte: start, lte: end } },
      include: this.include,
      orderBy: { startAt: 'asc' },
    })
  }

  async createEvent(dto: CreateCalendarEventDto, orgId: string, createdById: string, role: string) {
    if (!['SUPER_ADMIN', 'OWNER', 'MANAGER'].includes(role)) {
      throw new ForbiddenException('Solo managers y superiores pueden crear eventos')
    }

    const event = await this.prisma.calendarEvent.create({
      data: {
        title: dto.title,
        description: dto.description,
        startAt: new Date(dto.startAt),
        endAt: dto.endAt ? new Date(dto.endAt) : undefined,
        givenBy: dto.givenBy,
        modality: dto.modality ?? 'PRESENCIAL',
        meetingLink: dto.meetingLink,
        organizationId: orgId,
        createdById,
        participants: {
          create: (dto.participantIds ?? []).map((userId) => ({ userId })),
        },
      },
      include: this.include,
    })

    this.notifications
      .scheduleCalendarEventReminder(event.id, orgId, event.startAt)
      .catch((err) => this.logger.error(`Error scheduling calendar reminder: ${err}`))

    return event
  }

  async deleteEvent(id: string, orgId: string, role: string) {
    if (!['SUPER_ADMIN', 'OWNER', 'MANAGER'].includes(role)) {
      throw new ForbiddenException('Sin permiso')
    }
    const event = await this.prisma.calendarEvent.findFirst({ where: { id, organizationId: orgId } })
    if (!event) throw new NotFoundException('Evento no encontrado')

    await this.prisma.calendarEvent.delete({ where: { id } })

    this.notifications
      .cancelCalendarEventReminder(id)
      .catch((err) => this.logger.error(`Error cancelling calendar reminder: ${err}`))

    return { id, deleted: true }
  }
}
