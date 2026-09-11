import { Module } from '@nestjs/common'
import { InspeccionesController } from './inspecciones.controller'
import { InspeccionesService } from './inspecciones.service'
import { NotificationsModule } from '../notifications/notifications.module'

@Module({
  imports: [NotificationsModule],
  controllers: [InspeccionesController],
  providers: [InspeccionesService],
  exports: [InspeccionesService],
})
export class InspeccionesModule {}
