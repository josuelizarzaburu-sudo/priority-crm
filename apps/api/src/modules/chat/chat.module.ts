import { Module } from '@nestjs/common'
import { ChatController } from './chat.controller'
import { ChatService } from './chat.service'
import { LeadsModule } from '../leads/leads.module'

@Module({
  imports: [LeadsModule],
  controllers: [ChatController],
  providers: [ChatService],
})
export class ChatModule {}
