import { Module } from '@nestjs/common'
import { WebhooksController } from './webhooks.controller'
import { WebhooksService } from './webhooks.service'
import { LeadsModule } from '../leads/leads.module'
import { WhatsappModule } from '../whatsapp/whatsapp.module'
import { WhatsappChatModule } from '../whatsapp-chat/whatsapp-chat.module'

@Module({
  imports: [LeadsModule, WhatsappModule, WhatsappChatModule],
  controllers: [WebhooksController],
  providers: [WebhooksService],
})
export class WebhooksModule {}
