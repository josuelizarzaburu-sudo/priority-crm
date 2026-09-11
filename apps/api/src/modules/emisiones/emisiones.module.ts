import { Module } from '@nestjs/common'
import { EmisionesController } from './emisiones.controller'
import { EmisionesService } from './emisiones.service'
import { NotificationsModule } from '../notifications/notifications.module'

@Module({
  imports: [NotificationsModule],
  controllers: [EmisionesController],
  providers: [EmisionesService],
  exports: [EmisionesService],
})
export class EmisionesModule {}
