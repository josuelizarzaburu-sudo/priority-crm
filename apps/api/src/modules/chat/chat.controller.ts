import { Controller, Post, Body, UseGuards } from '@nestjs/common'
import { ApiTags, ApiOperation } from '@nestjs/swagger'
import { Throttle, ThrottlerGuard } from '@nestjs/throttler'
import { ChatService } from './chat.service'
import { ChatDto } from './dto/chat.dto'

@ApiTags('Chat')
@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 20, ttl: 3600000 } })
  @ApiOperation({ summary: 'Chat con el asistente de IA del widget del sitio web' })
  chat(@Body() dto: ChatDto) {
    return this.chatService.handleMessage(dto.messages, dto.sessionId)
  }
}
