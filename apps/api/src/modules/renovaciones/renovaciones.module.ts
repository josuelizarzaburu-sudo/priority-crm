import { BullModule } from '@nestjs/bull'
import { Module } from '@nestjs/common'
import { RenovacionesController } from './renovaciones.controller'
import { RenovacionesService } from './renovaciones.service'
import {
  COLA_RENOVACIONES,
  RenovacionesProcessor,
  RenovacionesScheduler,
} from './renovaciones.processor'
import { NotificationsModule } from '../notifications/notifications.module'

@Module({
  imports: [BullModule.registerQueue({ name: COLA_RENOVACIONES }), NotificationsModule],
  controllers: [RenovacionesController],
  providers: [RenovacionesService, RenovacionesProcessor, RenovacionesScheduler],
  exports: [RenovacionesService],
})
export class RenovacionesModule {}
