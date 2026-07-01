import { Module } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { WhatsappChatService } from './whatsapp-chat.service'
import { WhatsappChatController } from './whatsapp-chat.controller'
import { RolesGuard } from '../auth/guards/roles.guard'
import { PushModule } from '../push/push.module'

@Module({
  imports: [PushModule],
  controllers: [WhatsappChatController],
  providers: [WhatsappChatService, RolesGuard, Reflector],
  exports: [WhatsappChatService],
})
export class WhatsappChatModule {}
