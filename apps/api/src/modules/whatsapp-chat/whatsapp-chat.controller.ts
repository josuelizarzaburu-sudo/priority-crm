import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseGuards,
  Req,
  Res,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  StreamableFile,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { memoryStorage } from 'multer'
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { WhatsappChatService } from './whatsapp-chat.service'

@ApiTags('WhatsApp Chat')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('whatsapp-chat')
export class WhatsappChatController {
  constructor(private readonly service: WhatsappChatService) {}

  @Get('deals/:dealId/messages')
  @ApiOperation({ summary: 'Get WhatsApp message history for a deal' })
  getMessages(@Param('dealId') dealId: string, @Req() req: any) {
    return this.service.getMessages(dealId, req.user.organizationId)
  }

  @Post('deals/:dealId/mark-read')
  markRead(@Param('dealId') dealId: string, @Req() req: any) {
    return this.service.markRead(dealId, req.user.organizationId)
  }

  @Post('deals/:dealId/send-text')
  @ApiOperation({ summary: 'Send a text message to the deal contact via WhatsApp' })
  sendText(
    @Param('dealId') dealId: string,
    @Body() body: { text: string },
    @Req() req: any,
  ) {
    return this.service.sendText(dealId, body.text, req.user.id, req.user.organizationId)
  }

  @Post('deals/:dealId/send-document')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 16 * 1024 * 1024 } }))
  @ApiOperation({ summary: 'Send a document/image to the deal contact via WhatsApp' })
  async sendDocument(
    @Param('dealId') dealId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: { caption?: string },
    @Req() req: any,
  ) {
    if (!file) throw new BadRequestException('No file provided')
    return this.service.sendDocument(
      dealId,
      file.buffer,
      file.mimetype,
      file.originalname,
      body.caption ?? '',
      req.user.id,
      req.user.organizationId,
    )
  }

  @Post('unread-counts')
  @ApiOperation({ summary: 'Get unread WhatsApp message counts for given deal IDs' })
  async getUnreadCounts(@Body() body: { dealIds: string[] }) {
    return this.service.getUnreadCounts(body.dealIds ?? [])
  }

  @Get('media/:mediaId')
  @ApiOperation({ summary: 'Proxy Meta media download (requires JWT)' })
  async proxyMedia(
    @Param('mediaId') mediaId: string,
    @Res({ passthrough: true }) res: any,
  ) {
    const { data, contentType } = await this.service.downloadMedia(mediaId)
    res.set('Content-Type', contentType)
    res.set('Content-Disposition', 'inline')
    return new StreamableFile(data)
  }
}
