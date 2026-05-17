import { Controller, Post, Get, Body, Logger, Res, Req } from '@nestjs/common'
import { ApiTags, ApiOperation } from '@nestjs/swagger'
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
