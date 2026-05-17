import { Module } from '@nestjs/common'
import { WebhooksController } from './webhooks.controller'
import { WebhooksService } from './webhooks.service'
import { LeadsModule } from '../leads/leads.module'
import { WhatsappModule } from '../whatsapp/whatsapp.module'

@Module({
  imports: [LeadsModule, WhatsappModule],
  controllers: [WebhooksController],
  providers: [WebhooksService],
})
export class WebhooksModule {}
