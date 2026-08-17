import { Module } from '@nestjs/common'
import { RenovacionesController } from './renovaciones.controller'
import { RenovacionesService } from './renovaciones.service'
import { NotificationsModule } from '../notifications/notifications.module'

@Module({
  imports: [NotificationsModule],
  controllers: [RenovacionesController],
  providers: [RenovacionesService],
  exports: [RenovacionesService],
})
export class RenovacionesModule {}
