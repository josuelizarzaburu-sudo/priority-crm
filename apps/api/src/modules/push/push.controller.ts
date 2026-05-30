import { Controller, Post, Delete, Body, Req, UseGuards, Get } from '@nestjs/common'
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { PushService } from './push.service'
import { SubscribeDto } from './dto/subscribe.dto'
import { ConfigService } from '@nestjs/config'

@ApiTags('Push')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('push')
export class PushController {
  constructor(
    private readonly pushService: PushService,
    private readonly config: ConfigService,
  ) {}

  @Get('vapid-public-key')
  @ApiOperation({ summary: 'Get VAPID public key for push subscription' })
  getPublicKey() {
    return { publicKey: this.config.get<string>('VAPID_PUBLIC_KEY') ?? null }
  }

  @Post('subscribe')
  @ApiOperation({ summary: 'Register push subscription for current user' })
  subscribe(@Body() dto: SubscribeDto, @Req() req: any) {
    return this.pushService.subscribe(req.user.id, dto)
  }

  @Delete('unsubscribe')
  @ApiOperation({ summary: 'Remove push subscription' })
  unsubscribe(@Body() body: { endpoint: string }, @Req() req: any) {
    return this.pushService.unsubscribe(req.user.id, body.endpoint)
  }
}
