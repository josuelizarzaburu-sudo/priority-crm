import { BullModule } from '@nestjs/bull'
import { Module } from '@nestjs/common'
import { NotificationsModule } from '../notifications/notifications.module'
import { CorreosAutomaticosController } from './correos-automaticos.controller'
import {
  COLA_CORREOS,
  CorreosAutomaticosProcessor,
  CorreosAutomaticosScheduler,
} from './correos-automaticos.processor'
import { CorreosAutomaticosService } from './correos-automaticos.service'

@Module({
  imports: [BullModule.registerQueue({ name: COLA_CORREOS }), NotificationsModule],
  controllers: [CorreosAutomaticosController],
  providers: [CorreosAutomaticosService, CorreosAutomaticosProcessor, CorreosAutomaticosScheduler],
  exports: [CorreosAutomaticosService],
})
export class CorreosAutomaticosModule {}
