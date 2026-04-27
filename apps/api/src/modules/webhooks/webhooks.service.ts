import { Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name)

  constructor(private readonly prisma: PrismaService) {}

  async handleWhatsappInbound(body: any) {
    try {
      const entry = body.entry?.[0]?.changes?.[0]?.value
      if (!entry?.messages?.length) return { status: 'no-message' }

      const msg = entry.messages[0]
      const from = msg.from
      const text = msg.text?.body ?? ''
      const waId = msg.id

      const contact = await this.prisma.contact.findFirst({ where: { phone: from } })

      let conversation = await this.prisma.conversation.findFirst({
        where: { channel: 'WHATSAPP', contact: { phone: from } },
      })

      if (!conversation) {
        conversation = await this.prisma.conversation.create({
          data: {
            channel: 'WHATSAPP',
            contactId: contact?.id,
            organizationId: contact?.organizationId ?? '',
            externalId: from,
          },
        })
      }

      await this.prisma.message.create({
        data: {
          conversationId: conversation.id,
          content: text,
          direction: 'INBOUND',
          type: 'TEXT',
          externalId: waId,
        },
      })

      return { status: 'ok' }
    } catch (err) {
      this.logger.error('WhatsApp webhook error', err)
      return { status: 'error' }
    }
  }

  async handleEmailInbound(body: any) {
    this.logger.log(`Inbound email from: ${body.from}`)
    return { status: 'ok' }
  }
}
