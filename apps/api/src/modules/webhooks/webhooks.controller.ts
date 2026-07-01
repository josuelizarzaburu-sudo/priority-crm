import { Controller, Post, Get, Body, Logger, Res, Req } from '@nestjs/common'
import { ApiTags, ApiOperation } from '@nestjs/swagger'
import { WebhooksService } from './webhooks.service'
import { LeadsService } from '../leads/leads.service'
import { WhatsappBotService, RedisUnavailableError } from '../whatsapp/whatsapp-bot.service'
import { WhatsappChatService } from '../whatsapp-chat/whatsapp-chat.service'
import { IngestLeadDto, LeadSource } from '../leads/dto/ingest-lead.dto'

const SUPPORTED_MEDIA_TYPES = new Set(['image', 'document', 'video', 'audio'])

@ApiTags('Webhooks')
@Controller('webhooks')
export class WebhooksController {
  private readonly logger = new Logger(WebhooksController.name)

  constructor(
    private readonly webhooksService: WebhooksService,
    private readonly leadsService: LeadsService,
    private readonly whatsappBot: WhatsappBotService,
    private readonly whatsappChatService: WhatsappChatService,
  ) {}

  @Get('whatsapp')
  verifyWhatsapp(@Req() req: any, @Res() res: any) {
    const mode = req.query['hub.mode']
    const token = req.query['hub.verify_token']
    const challenge = req.query['hub.challenge']

    console.log('Webhook verification:', { mode, token, challenge })
    console.log('Expected token:', process.env.META_WHATSAPP_WEBHOOK_SECRET)

    if (mode === 'subscribe' && token === process.env.META_WHATSAPP_WEBHOOK_SECRET) {
      return res.status(200).send(challenge)
    }
    return res.status(403).send('Forbidden')
  }

  @Post('whatsapp')
  @ApiOperation({ summary: 'Receive WhatsApp messages from Meta Cloud API' })
  async handleWhatsapp(@Body() body: any) {
    // Acknowledge immediately — Meta requires a 200 within 20 s
    this.processWhatsappAsync(body).catch((err) =>
      this.logger.error('WhatsApp async processing error', err),
    )
    return { status: 'ok' }
  }

  private async processWhatsappAsync(body: any): Promise<void> {
    console.log('Webhook received:', JSON.stringify(body))

    const entry = body?.entry?.[0]?.changes?.[0]?.value
    if (!entry?.messages?.length) {
      console.log('No messages in payload — entry:', JSON.stringify(entry))
      return
    }

    const msg = entry.messages[0]
    const phone: string = msg.from
    const waId: string = msg.id

    // Bug #6: use allSettled so a Redis error doesn't swallow the dealId result
    const [sessionResult, dealResult] = await Promise.allSettled([
      this.whatsappBot.getSessionStep(phone),
      this.whatsappChatService.findDealByPhone(phone),
    ])

    const redisDown =
      sessionResult.status === 'rejected' &&
      sessionResult.reason instanceof RedisUnavailableError

    const sessionStep = sessionResult.status === 'fulfilled' ? sessionResult.value : null
    const dealId = dealResult.status === 'fulfilled' ? dealResult.value : null

    console.log('Processing message from:', phone, '| type:', msg.type, '| sessionStep:', sessionStep, '| dealId:', dealId, '| redisDown:', redisDown)

    // Bug #6: when Redis is down we can't tell whether the bot is mid-flow;
    // route to bot to avoid dropping a message the bot should be handling
    if (redisDown) {
      if (msg.type === 'text') {
        await this.whatsappBot.processMessage(phone, msg.text?.body ?? '')
      }
      return
    }

    const botDone = sessionStep === 'completado' || sessionStep === 'auto_completado'

    if (msg.type === 'text') {
      const text: string = msg.text?.body ?? ''

      // Active bot session (not done) → let bot handle
      if (!botDone && sessionStep !== null) {
        await this.whatsappBot.processMessage(phone, text)
        return
      }

      // No session and no deal → new lead, start bot
      if (sessionStep === null && !dealId) {
        await this.whatsappBot.processMessage(phone, text)
        return
      }

      if (dealId) {
        // Bot done OR has deal without active session → save for vendor, no auto-reply
        await this.whatsappChatService.saveInbound({
          dealId,
          content: text,
          messageType: 'TEXT',
          whatsappMessageId: waId,
        })
      } else {
        // Bug #1: botDone=true but no deal (e.g. lead creation failed) → clear
        // the stale session and restart the bot so the customer gets a response
        await this.whatsappBot.clearSession(phone)
        await this.whatsappBot.processMessage(phone, text)
      }
    } else {
      // Bug #4: ignore unsupported types before trying to treat them as media
      if (!SUPPORTED_MEDIA_TYPES.has(msg.type)) {
        console.log(`Ignoring unsupported message type: ${msg.type}`)
        return
      }

      // Non-text media: save to chat inbox if deal exists
      const mediaType = msg.type === 'image' ? 'IMAGE' : 'DOCUMENT'
      const media = msg.image ?? msg.document ?? msg.video ?? msg.audio
      // Bug #3: store proxy URL so the frontend fetches via authenticated endpoint
      const mediaUrl = media?.id ? `/whatsapp-chat/media/${media.id}` : undefined
      const mediaFileName = msg.document?.filename ?? `${msg.type}_${waId}`
      const caption = msg.image?.caption ?? msg.document?.caption ?? ''

      if (dealId) {
        await this.whatsappChatService.saveInbound({
          dealId,
          content: caption,
          messageType: mediaType as 'IMAGE' | 'DOCUMENT',
          mediaUrl,
          mediaFileName,
          whatsappMessageId: waId,
        })
      } else {
        console.log('Non-text message from unknown contact, no deal found — ignoring')
      }
    }
  }

  @Post('email/inbound')
  handleEmailInbound(@Body() body: any) {
    return this.webhooksService.handleEmailInbound(body)
  }

  @Post('lead')
  @ApiOperation({ summary: 'Ingest lead from external source' })
  handleLeadWebhook(@Body() body: IngestLeadDto & { source?: LeadSource }) {
    return this.leadsService.ingestLead({
      ...body,
      source: body.source ?? LeadSource.WHATSAPP,
    })
  }
}
