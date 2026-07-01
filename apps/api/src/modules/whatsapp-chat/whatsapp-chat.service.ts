import { Injectable, Logger, NotFoundException, BadGatewayException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PrismaService } from '../../prisma/prisma.service'
import { PushService } from '../push/push.service'

@Injectable()
export class WhatsappChatService {
  private readonly logger = new Logger(WhatsappChatService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly push: PushService,
  ) {}

  async getMessages(dealId: string, organizationId: string) {
    const deal = await this.prisma.deal.findFirst({ where: { id: dealId, organizationId } })
    if (!deal) throw new NotFoundException('Deal not found')

    return this.prisma.whatsappMessage.findMany({
      where: { dealId },
      orderBy: { createdAt: 'asc' },
      include: { sentBy: { select: { id: true, name: true } } },
    })
  }

  async markRead(dealId: string, organizationId: string) {
    await this.prisma.deal.findFirstOrThrow({ where: { id: dealId, organizationId } })
    await this.prisma.whatsappMessage.updateMany({
      where: { dealId, direction: 'INBOUND', read: false },
      data: { read: true },
    })
    return { ok: true }
  }

  async sendText(dealId: string, text: string, userId: string, organizationId: string) {
    const deal = await this.prisma.deal.findFirst({
      where: { id: dealId, organizationId },
      include: { contact: { select: { phone: true } } },
    })
    if (!deal) throw new NotFoundException('Deal not found')
    const phone = deal.contact?.phone
    if (!phone) throw new NotFoundException('Deal has no contact phone')

    const waMessageId = await this.sendWhatsappText(phone, text)
    if (!waMessageId) throw new BadGatewayException('WhatsApp API did not return a message ID')

    return this.prisma.whatsappMessage.create({
      data: {
        dealId,
        direction: 'OUTBOUND',
        messageType: 'TEXT',
        content: text,
        sentByUserId: userId,
        whatsappMessageId: waMessageId,
        status: 'SENT',
        read: true,
      },
      include: { sentBy: { select: { id: true, name: true } } },
    })
  }

  async sendDocument(
    dealId: string,
    fileBuffer: Buffer,
    mimeType: string,
    fileName: string,
    caption: string,
    userId: string,
    organizationId: string,
  ) {
    const deal = await this.prisma.deal.findFirst({
      where: { id: dealId, organizationId },
      include: { contact: { select: { phone: true } } },
    })
    if (!deal) throw new NotFoundException('Deal not found')
    const phone = deal.contact?.phone
    if (!phone) throw new NotFoundException('Deal has no contact phone')

    const { mediaId, proxyUrl } = await this.uploadMedia(fileBuffer, mimeType, fileName)
    const waMessageId = await this.sendWhatsappDocument(phone, mediaId, fileName, caption)
    if (!waMessageId) throw new BadGatewayException('WhatsApp API did not return a message ID')

    return this.prisma.whatsappMessage.create({
      data: {
        dealId,
        direction: 'OUTBOUND',
        messageType: mimeType.startsWith('image/') ? 'IMAGE' : 'DOCUMENT',
        content: caption,
        mediaUrl: proxyUrl ?? undefined,
        mediaFileName: fileName,
        sentByUserId: userId,
        whatsappMessageId: waMessageId,
        status: 'SENT',
        read: true,
      },
      include: { sentBy: { select: { id: true, name: true } } },
    })
  }

  async saveInbound(params: {
    dealId: string
    content: string
    messageType: 'TEXT' | 'DOCUMENT' | 'IMAGE'
    mediaUrl?: string
    mediaFileName?: string
    whatsappMessageId?: string
  }) {
    const msg = await this.prisma.whatsappMessage.create({
      data: {
        dealId: params.dealId,
        direction: 'INBOUND',
        messageType: params.messageType,
        content: params.content,
        mediaUrl: params.mediaUrl,
        mediaFileName: params.mediaFileName,
        whatsappMessageId: params.whatsappMessageId,
        status: 'DELIVERED',
        read: false,
      },
    })

    const deal = await this.prisma.deal.findFirst({
      where: { id: params.dealId },
      select: {
        assignedToId: true,
        title: true,
        contact: { select: { firstName: true, lastName: true } },
      },
    })
    if (deal?.assignedToId) {
      const contactName = deal.contact
        ? `${deal.contact.firstName}${deal.contact.lastName ? ` ${deal.contact.lastName}` : ''}`
        : deal.title
      const preview = params.messageType === 'TEXT'
        ? params.content.slice(0, 100)
        : `📎 ${params.mediaFileName ?? 'archivo'}`
      this.push
        .sendToUser(deal.assignedToId, {
          title: '💬 Nuevo mensaje de WhatsApp',
          body: `${contactName}: ${preview}`,
          url: `/pipeline`,
        })
        .catch((err) => this.logger.error('Push error', err))
    }

    return msg
  }

  async findDealByPhone(phone: string): Promise<string | null> {
    const orgId = this.config.get<string>('META_ORGANIZATION_ID')
    const contact = await this.prisma.contact.findFirst({
      where: { phone, ...(orgId ? { organizationId: orgId } : {}) },
      include: {
        deals: {
          where: { status: 'OPEN', ...(orgId ? { organizationId: orgId } : {}) },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    })
    if (!orgId) this.logger.warn('META_ORGANIZATION_ID not set — findDealByPhone is not org-scoped')
    return contact?.deals?.[0]?.id ?? null
  }

  async getUnreadCounts(dealIds: string[]): Promise<Record<string, number>> {
    if (dealIds.length === 0) return {}
    const rows = await this.prisma.whatsappMessage.groupBy({
      by: ['dealId'],
      where: { dealId: { in: dealIds }, direction: 'INBOUND', read: false },
      _count: { id: true },
    })
    const result: Record<string, number> = {}
    for (const row of rows) result[row.dealId] = row._count.id
    return result
  }

  // ── Meta API helpers ───────────────────────────────────────────────────────

  private token() { return this.config.get<string>('META_WHATSAPP_TOKEN') }
  private phoneId() { return this.config.get<string>('META_WHATSAPP_PHONE_ID') }

  private async sendWhatsappText(to: string, body: string): Promise<string | null> {
    const token = this.token()
    const phoneId = this.phoneId()
    if (!token || !phoneId) { this.logger.warn('WhatsApp not configured'); return null }
    try {
      const res = await fetch(`https://graph.facebook.com/v19.0/${phoneId}/messages`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ messaging_product: 'whatsapp', to, type: 'text', text: { body } }),
      })
      const json: any = await res.json()
      return json?.messages?.[0]?.id ?? null
    } catch (err) {
      this.logger.error('sendWhatsappText error', err)
      return null
    }
  }

  async downloadMedia(mediaId: string): Promise<{ data: Buffer; contentType: string }> {
    const token = this.token()
    if (!token) throw new NotFoundException('WhatsApp not configured')
    // Step 1: resolve the actual download URL from Meta
    const metaRes = await fetch(`https://graph.facebook.com/v19.0/${mediaId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!metaRes.ok) throw new NotFoundException(`Media ${mediaId} not found`)
    const { url, mime_type } = (await metaRes.json()) as { url?: string; mime_type?: string }
    if (!url) throw new NotFoundException('Meta did not return a download URL')
    // Step 2: download the binary
    const fileRes = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
    if (!fileRes.ok) throw new NotFoundException('Media download failed')
    const data = Buffer.from(await fileRes.arrayBuffer())
    return { data, contentType: mime_type ?? 'application/octet-stream' }
  }

  private async uploadMedia(
    fileBuffer: Buffer,
    mimeType: string,
    fileName: string,
  ): Promise<{ mediaId: string | null; proxyUrl: string | null }> {
    const token = this.token()
    const phoneId = this.phoneId()
    if (!token || !phoneId) return { mediaId: null, proxyUrl: null }
    try {
      const form = new FormData()
      form.append('messaging_product', 'whatsapp')
      form.append('file', new Blob([fileBuffer], { type: mimeType }), fileName)
      const res = await fetch(`https://graph.facebook.com/v19.0/${phoneId}/media`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      })
      const json: any = await res.json()
      const id: string | null = json?.id ?? null
      return { mediaId: id, proxyUrl: id ? `/whatsapp-chat/media/${id}` : null }
    } catch (err) {
      this.logger.error('uploadMedia error', err)
      return { mediaId: null, proxyUrl: null }
    }
  }

  private async sendWhatsappDocument(
    to: string,
    mediaId: string | null,
    fileName: string,
    caption: string,
  ): Promise<string | null> {
    const token = this.token()
    const phoneId = this.phoneId()
    if (!token || !phoneId || !mediaId) return null
    try {
      const res = await fetch(`https://graph.facebook.com/v19.0/${phoneId}/messages`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to,
          type: 'document',
          document: { id: mediaId, filename: fileName, caption },
        }),
      })
      const json: any = await res.json()
      return json?.messages?.[0]?.id ?? null
    } catch (err) {
      this.logger.error('sendWhatsappDocument error', err)
      return null
    }
  }
}
