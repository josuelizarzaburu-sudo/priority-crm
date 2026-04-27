import { Controller, Get, Post, Body, Param, Query, UseGuards, Req } from '@nestjs/common'
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { CommunicationsService } from './communications.service'
import { SendMessageDto } from './dto/send-message.dto'

@ApiTags('Communications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('communications')
export class CommunicationsController {
  constructor(private readonly communicationsService: CommunicationsService) {}

  @Get('conversations')
  @ApiOperation({ summary: 'List all conversations' })
  getConversations(@Req() req: any, @Query('channel') channel?: string) {
    return this.communicationsService.getConversations(req.user.organizationId, channel)
  }

  @Get('conversations/:id/messages')
  getMessages(@Param('id') id: string, @Req() req: any) {
    return this.communicationsService.getMessages(id, req.user.organizationId)
  }

  @Post('conversations/:id/messages')
  @ApiOperation({ summary: 'Send a message in a conversation' })
  sendMessage(
    @Param('id') id: string,
    @Body() dto: SendMessageDto,
    @Req() req: any,
  ) {
    return this.communicationsService.sendMessage(id, dto, req.user.organizationId, req.user.id)
  }

  @Post('conversations')
  @ApiOperation({ summary: 'Start a new conversation' })
  createConversation(@Body() body: any, @Req() req: any) {
    return this.communicationsService.createConversation(body, req.user.organizationId)
  }
}
