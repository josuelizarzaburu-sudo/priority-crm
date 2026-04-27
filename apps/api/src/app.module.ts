import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { ThrottlerModule } from '@nestjs/throttler'
import { BullModule } from '@nestjs/bull'
import { CacheModule } from '@nestjs/cache-manager'
import { PrismaModule } from './prisma/prisma.module'
import { AuthModule } from './modules/auth/auth.module'
import { UsersModule } from './modules/users/users.module'
import { ContactsModule } from './modules/contacts/contacts.module'
import { PipelineModule } from './modules/pipeline/pipeline.module'
import { CommunicationsModule } from './modules/communications/communications.module'
import { AiModule } from './modules/ai/ai.module'
import { AutomationsModule } from './modules/automations/automations.module'
import { WebhooksModule } from './modules/webhooks/webhooks.module'
import { LeadsModule } from './modules/leads/leads.module'

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, cache: true }),

    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),

    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        redis: { host: 'localhost', port: 6379, password: config.get('REDIS_PASSWORD') },
      }),
    }),

    CacheModule.registerAsync({
      isGlobal: true,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        store: 'ioredis',
        host: 'localhost',
        port: 6379,
        password: config.get('REDIS_PASSWORD'),
        ttl: 300,
      }),
    }),

    PrismaModule,
    AuthModule,
    UsersModule,
    ContactsModule,
    PipelineModule,
    CommunicationsModule,
    AiModule,
    AutomationsModule,
    WebhooksModule,
    LeadsModule,
  ],
})
export class AppModule {}
