import { Module } from '@nestjs/common'
import { ConsentimientosController } from './consentimientos.controller'
import { ConsentimientosService } from './consentimientos.service'
import { NotificationsModule } from '../notifications/notifications.module'

@Module({
  imports: [NotificationsModule],
  controllers: [ConsentimientosController],
  providers: [ConsentimientosService],
  exports: [ConsentimientosService],
})
export class ConsentimientosModule {}
