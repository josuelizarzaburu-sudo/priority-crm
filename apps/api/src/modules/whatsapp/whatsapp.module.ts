import { Module } from '@nestjs/common'
import { WhatsappBotService } from './whatsapp-bot.service'
import { LeadsModule } from '../leads/leads.module'

@Module({
  imports: [LeadsModule],
  providers: [WhatsappBotService],
  exports: [WhatsappBotService],
})
export class WhatsappModule {}
