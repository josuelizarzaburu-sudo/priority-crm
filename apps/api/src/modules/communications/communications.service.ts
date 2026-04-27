import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'

import { SendMessageDto } from './dto/send-message.dto'
import { WhatsappService } from './channels/whatsapp.service'
import { EmailService } from './channels/email.service'
import { CommunicationsGateway } from './communications.gateway'

@Injectable()
export class CommunicationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly whatsapp: WhatsappService,
    private readonly email: EmailService,
    private readonly gateway: CommunicationsGateway,
  ) {}

  async getConversations(organizationId: string, channel?: string) {
    return this.prisma.conversation.findMany({
      where: { organizationId, ...(channel ? { channel: channel as any } : {}) },
      orderBy: { updatedAt: 'desc' },
      include: {
        contact: { select: { id: true, firstName: true, lastName: true, phone: true, email: true } },
        messages: { orderBy: { createdAt: 'desc' }, take: 1 },
        _count: { select: { messages: { where: { read: false } } } },
      },
    })
  }

  async getMessages(conversationId: string, organizationId: string) {
    const conversation = await this.prisma.conversation.findFirst({
      where: { id: conversationId, organizationId },
    })
    if (!conversation) throw new NotFoundException('Conversation not found')

    await this.prisma.message.updateMany({
      where: { conversationId, read: false },
      data: { read: true },
    })

    return this.prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
    })
  }

  async sendMessage(
    conversationId: string,
    dto: SendMessageDto,
    organizationId: string,
    userId: string,
  ) {
    const conversation = await this.prisma.conversation.findFirst({
      where: { id: conversationId, organizationId },
      include: { contact: true },
    })
    if (!conversation) throw new NotFoundException('Conversation not found')

    const message = await this.prisma.message.create({
      data: {
        conversationId,
        content: dto.content,
        direction: 'OUTBOUND',
        type: (dto.type ?? 'TEXT') as any,
        sentById: userId,
      },
    })

    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    })

    if (conversation.channel === 'WHATSAPP' && conversation.contact?.phone) {
      await this.whatsapp.sendMessage(conversation.contact.phone, dto.content)
    } else if (conversation.channel === 'EMAIL' && conversation.contact?.email) {
      await this.email.sendEmail({
        to: conversation.contact.email,
        subject: dto.subject ?? 'Message from Priority CRM',
        text: dto.content,
      })
    }

    this.gateway.broadcastMessage(organizationId, conversationId, message)
    return message
  }

  async createConversation(data: any, organizationId: string) {
    return this.prisma.conversation.create({
      data: { ...data, organizationId },
      include: { contact: { select: { id: true, firstName: true, lastName: true } } },
    })
  }
}
