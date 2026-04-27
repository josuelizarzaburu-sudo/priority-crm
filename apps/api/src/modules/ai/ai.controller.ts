import { Controller, Post, Body, Param, UseGuards, Req, Res } from '@nestjs/common'
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { AiService } from './ai.service'

@ApiTags('AI')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('contacts/:id/summarize')
  @ApiOperation({ summary: 'AI-generated contact summary' })
  summarize(@Param('id') id: string, @Req() req: any) {
    return this.aiService.summarizeContact(id, req.user.organizationId)
  }

  @Post('deals/:id/suggest')
  @ApiOperation({ summary: 'AI next-action suggestion for a deal' })
  suggest(@Param('id') id: string, @Req() req: any) {
    return this.aiService.suggestNextAction(id, req.user.organizationId)
  }

  @Post('draft-message')
  @ApiOperation({ summary: 'Draft a message with AI assistance' })
  draftMessage(@Body() body: any, @Req() req: any) {
    return this.aiService.draftMessage({ ...body, organizationId: req.user.organizationId })
  }

  @Post('chat')
  @ApiOperation({ summary: 'Stream AI chat response' })
  async chat(@Body() body: { messages: any[]; context?: string }, @Res() res: any) {
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')

    const stream = await this.aiService.chat(body.messages, body.context)
    for await (const chunk of stream) {
      if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
        res.write(`data: ${JSON.stringify({ text: chunk.delta.text })}\n\n`)
      }
    }
    res.write('data: [DONE]\n\n')
    res.end()
  }
}
