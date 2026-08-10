import { Module } from '@nestjs/common'
import { LeadsController } from './leads.controller'
import { LeadsService } from './leads.service'
import { NotificationsModule } from '../notifications/notifications.module'
import { EquiposModule } from '../equipos/equipos.module'

@Module({
  imports: [NotificationsModule, EquiposModule],
  controllers: [LeadsController],
  providers: [LeadsService],
  exports: [LeadsService],
})
export class LeadsModule {}
