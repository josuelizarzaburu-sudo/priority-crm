import { Module } from '@nestjs/common'
import { TareasController } from './tareas.controller'
import { TareasService } from './tareas.service'
import { NotificationsModule } from '../notifications/notifications.module'

@Module({
  imports: [NotificationsModule],
  controllers: [TareasController],
  providers: [TareasService],
  exports: [TareasService],
})
export class TareasModule {}
