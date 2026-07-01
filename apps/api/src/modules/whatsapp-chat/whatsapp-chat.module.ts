import { Module } from '@nestjs/common'
import { WhatsappChatService } from './whatsapp-chat.service'
import { WhatsappChatController } from './whatsapp-chat.controller'
import { PushModule } from '../push/push.module'

@Module({
  imports: [PushModule],
  controllers: [WhatsappChatController],
  providers: [WhatsappChatService],
  exports: [WhatsappChatService],
})
export class WhatsappChatModule {}
