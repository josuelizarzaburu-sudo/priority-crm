import { Module } from '@nestjs/common'
import { BullModule } from '@nestjs/bull'
import { NotificationsService } from './notifications.service'
import { NotificationsProcessor } from './notifications.processor'
import { PushModule } from '../push/push.module'

@Module({
  imports: [BullModule.registerQueue({ name: 'notifications' }), PushModule],
  providers: [NotificationsService, NotificationsProcessor],
  exports: [NotificationsService],
})
export class NotificationsModule {}
