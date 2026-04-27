import { Controller, Post, Get, Body, Query } from '@nestjs/common'
import { ApiTags, ApiOperation } from '@nestjs/swagger'
import { WebhooksService } from './webhooks.service'
import { LeadsService } from '../leads/leads.service'
import { IngestLeadDto, LeadSource } from '../leads/dto/ingest-lead.dto'

@ApiTags('Webhooks')
@Controller('webhooks')
export class WebhooksController {
  constructor(
    private readonly webhooksService: WebhooksService,
    private readonly leadsService: LeadsService,
  ) {}

  @Get('whatsapp')
  verifyWhatsapp(@Query('hub.challenge') challenge: string) {
    return challenge
  }

  @Post('whatsapp')
  handleWhatsapp(@Body() body: any) {
    return this.webhooksService.handleWhatsappInbound(body)
  }

  @Post('email/inbound')
  handleEmailInbound(@Body() body: any) {
    return this.webhooksService.handleEmailInbound(body)
  }

  @Post('lead')
  @ApiOperation({ summary: 'Ingest lead from WhatsApp bot or call center system' })
  handleLeadWebhook(@Body() body: IngestLeadDto & { source?: LeadSource }) {
    return this.leadsService.ingestLead({
      ...body,
      source: body.source ?? LeadSource.WHATSAPP,
    })
  }
}
