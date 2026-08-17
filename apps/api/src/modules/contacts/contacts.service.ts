import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { EquiposService } from '../equipos/equipos.service'
import { veSoloSuEquipo } from '../equipos/equipos-scope'
import { CreateContactDto } from './dto/create-contact.dto'
import { UpdateContactDto } from './dto/update-contact.dto'
import { ContactsQueryDto } from './dto/contacts-query.dto'
import { LogInteractionDto } from './dto/log-interaction.dto'

const CALL_RESULT_LABEL: Record<string, string> = {
  answered: 'Contestó',
  no_answer: 'No contestó',
  voicemail: 'Buzón de voz',
}

/**
 * Quien puede borrar contactos. Lista blanca: un rol nuevo entra sin el permiso
 * hasta que se lo agregue aqui de forma explicita.
 */
const PUEDEN_BORRAR = ['SUPER_ADMIN', 'OWNER', 'MANAGER']

@Injectable()
export class ContactsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly equipos: EquiposService,
  ) {}

  /**
   * Ids cuyos contactos puede ver un jefe de equipo: su gente y el mismo.
   *
   * Sin equipo asignado devuelve solo su id. Es lo correcto: no hay a quien
   * supervisar todavia, y devolver todo le abriria la empresa entera por un dato
   * faltante.
   */
  private async alcanceDeEquipo(userId: string, organizationId: string) {
    const miembros = await this.equipos.miembrosDelJefe(userId, organizationId)
    return [...new Set([userId, ...miembros])]
  }

  async findAll(organizationId: string, query: ContactsQueryDto, userId: string, role: string) {
    const { search, page = 1, limit = 20, status, assignedTo } = query
    const skip = (page - 1) * limit

    const where: any = { organizationId }
    if (role === 'SALES_REP') where.assignedToId = userId
    // El jefe de equipo ve los contactos de SU gente. Antes solo se preguntaba
    // por SALES_REP, asi que al cambiarle el rol caia en la rama sin filtro y
    // veia los contactos de toda la empresa, incluidos los de otros equipos.
    else if (veSoloSuEquipo(role)) {
      where.assignedToId = { in: await this.alcanceDeEquipo(userId, organizationId) }
    }
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
    if (assignedTo && role !== 'SALES_REP') {
      // Un jefe filtrando por persona no debe poder saltarse su alcance pidiendo
      // el id de alguien de otro equipo.
      if (veSoloSuEquipo(role)) {
        const permitidos = await this.alcanceDeEquipo(userId, organizationId)
        if (permitidos.includes(assignedTo)) where.assignedToId = assignedTo
      } else {
        where.assignedToId = assignedTo
      }
    }

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
    // Mismo alcance al abrir un contacto por su id: sin esto, la lista se lo
    // ocultaria pero el acceso directo no.
    if (role && veSoloSuEquipo(role) && userId) {
      const permitidos = await this.alcanceDeEquipo(userId, organizationId)
      if (!contact.assignedToId || !permitidos.includes(contact.assignedToId)) {
        throw new ForbiddenException('Este contacto no pertenece a tu equipo')
      }
    }
    if (role === 'SALES_REP' && contact.assignedToId !== userId) {
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

  /**
   * Borrar un contacto se lleva por delante su historial. Queda para
   * administracion: un jefe de equipo puede ver y reasignar lo de su gente, pero
   * no eliminarlo.
   */
  async remove(id: string, organizationId: string, role?: string) {
    if (role && !PUEDEN_BORRAR.includes(role)) {
      throw new ForbiddenException('No tienes permiso para eliminar contactos')
    }
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

  async search(q: string, organizationId: string, userId: string, role: string) {
    const term = q.trim()
    if (term.length < 2) return { contacts: [], deals: [] }

    // El buscador respeta el mismo alcance que las listas: si no, un jefe
    // encontraria por aqui contactos y negocios de otros equipos.
    const filtroAlcance =
      role === 'SALES_REP'
        ? { assignedToId: userId }
        : veSoloSuEquipo(role)
          ? { assignedToId: { in: await this.alcanceDeEquipo(userId, organizationId) } }
          : {}

    const [contacts, deals] = await Promise.all([
      this.prisma.contact.findMany({
        where: {
          organizationId,
          ...filtroAlcance,
          OR: [
            { firstName: { contains: term, mode: 'insensitive' } },
            { lastName: { contains: term, mode: 'insensitive' } },
            { email: { contains: term, mode: 'insensitive' } },
            { phone: { contains: term } },
            { company: { contains: term, mode: 'insensitive' } },
          ],
        },
        take: 5,
        select: { id: true, firstName: true, lastName: true, email: true, phone: true, company: true },
      }),
      this.prisma.deal.findMany({
        where: {
          organizationId,
          status: 'OPEN',
          ...filtroAlcance,
          OR: [
            { title: { contains: term, mode: 'insensitive' } },
            { contact: { firstName: { contains: term, mode: 'insensitive' } } },
            { contact: { lastName: { contains: term, mode: 'insensitive' } } },
          ],
        },
        take: 5,
        include: {
          stage: { select: { name: true, color: true } },
          contact: { select: { id: true, firstName: true, lastName: true } },
        },
      }),
    ])
    return { contacts, deals }
  }

  async checkDuplicate(email: string | undefined, phone: string | undefined, organizationId: string) {
    if (!email && !phone) return { contact: null }
    const conditions: any[] = []
    if (email?.trim()) conditions.push({ email: email.trim() })
    if (phone?.trim()) conditions.push({ phone: phone.trim() })
    const contact = await this.prisma.contact.findFirst({
      where: { organizationId, OR: conditions },
      select: { id: true, firstName: true, lastName: true, email: true, phone: true, company: true },
    })
    return { contact }
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
