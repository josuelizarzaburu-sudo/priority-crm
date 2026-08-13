import { Module } from '@nestjs/common'
import { RequerimientosController } from './requerimientos.controller'
import { RequerimientosService } from './requerimientos.service'
import { NotificationsModule } from '../notifications/notifications.module'

@Module({
  imports: [NotificationsModule],
  controllers: [RequerimientosController],
  providers: [RequerimientosService],
  exports: [RequerimientosService],
})
export class RequerimientosModule {}
