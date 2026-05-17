import { Controller, Post, Get, Body, Query, Logger } from '@nestjs/common'
import { ApiTags, ApiOperation } from '@nestjs/swagger'
import { ConfigService } from '@nestjs/config'
import { WebhooksService } from './webhooks.service'
import { LeadsService } from '../leads/leads.service'
import { WhatsappBotService } from '../whatsapp/whatsapp-bot.service'
import { IngestLeadDto, LeadSource } from '../leads/dto/ingest-lead.dto'

@ApiTags('Webhooks')
@Controller('webhooks')
export class WebhooksController {
  private readonly logger = new Logger(WebhooksController.name)

  constructor(
    private readonly webhooksService: WebhooksService,
    private readonly leadsService: LeadsService,
    private readonly whatsappBot: WhatsappBotService,
    private readonly config: ConfigService,
  ) {}

  @Get('whatsapp')
  @ApiOperation({ summary: 'Meta webhook verification challenge' })
  verifyWhatsapp(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string,
  ) {
    const secret = this.config.get('META_WHATSAPP_WEBHOOK_SECRET')

    if (mode === 'subscribe' && token === secret) {
      this.logger.log('WhatsApp webhook verified')
      return challenge
    }

    this.logger.warn(`WhatsApp webhook verification failed — token mismatch`)
    return { status: 'forbidden' }
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
    const entry = body?.entry?.[0]?.changes?.[0]?.value
    if (!entry?.messages?.length) return

    const msg = entry.messages[0]
    // Only process inbound text messages; ignore status updates and reactions
    if (msg.type !== 'text') return

    const phone: string = msg.from
    const text: string = msg.text?.body ?? ''

    await this.whatsappBot.processMessage(phone, text)
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
