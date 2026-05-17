import { Module } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import Redis from 'ioredis'
import { WhatsappBotService, WHATSAPP_REDIS } from './whatsapp-bot.service'
import { LeadsModule } from '../leads/leads.module'

@Module({
  imports: [LeadsModule],
  providers: [
    {
      provide: WHATSAPP_REDIS,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        new Redis(config.get('REDIS_URL', 'redis://localhost:6379'), {
          password: config.get('REDIS_PASSWORD') || undefined,
          lazyConnect: true,
        }),
    },
    WhatsappBotService,
  ],
  exports: [WhatsappBotService],
})
export class WhatsappModule {}
