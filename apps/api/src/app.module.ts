import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler'
import { APP_GUARD } from '@nestjs/core'
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
import { PushModule } from './modules/push/push.module'
import { CalendarModule } from './modules/calendar/calendar.module'
import { TrainingModule } from './modules/training/training.module'
import { WhatsappChatModule } from './modules/whatsapp-chat/whatsapp-chat.module'
import { ChatModule } from './modules/chat/chat.module'
import { ClientesModule } from './modules/clientes/clientes.module'
import { ReclamosModule } from './modules/reclamos/reclamos.module'
import { CargaReclamosModule } from './modules/carga-reclamos/carga-reclamos.module'
import { RegistroAccesoModule } from './modules/registro-acceso/registro-acceso.module'
import { RequerimientosModule } from './modules/requerimientos/requerimientos.module'
import { RenovacionesModule } from './modules/renovaciones/renovaciones.module'
import { EquiposModule } from './modules/equipos/equipos.module'

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, cache: true }),

    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),

    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const redisUrl = config.get<string>('REDIS_URL')
        let host = 'localhost'
        let port = 6379
        let password: string | undefined = config.get('REDIS_PASSWORD') || undefined

        if (redisUrl) {
          try {
            const parsed = new URL(redisUrl)
            host = parsed.hostname
            port = parseInt(parsed.port, 10) || 6379
            if (parsed.password) password = decodeURIComponent(parsed.password)
          } catch { /* fallback to defaults above */ }
        }

        return {
          redis: {
            host,
            port,
            password,
            maxRetriesPerRequest: null,
            enableReadyCheck: false,
            retryStrategy: (times: number) => Math.min(times * 50, 2000),
          },
        }
      },
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
    PushModule,
    CalendarModule,
    TrainingModule,
    WhatsappChatModule,
    ChatModule,
    ClientesModule,
    ReclamosModule,
    CargaReclamosModule,
    RegistroAccesoModule,
    RequerimientosModule,
    RenovacionesModule,
    EquiposModule,
  ],
  providers: [
    // El ThrottlerModule estaba configurado pero NUNCA se aplicaba: sin este
    // guardia el limite no corre en ninguna ruta, o sea que se podian probar
    // contrasenias sin tope. Registrarlo aca lo activa para toda la API.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
