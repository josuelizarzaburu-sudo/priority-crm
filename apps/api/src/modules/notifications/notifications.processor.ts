import { Process, Processor } from '@nestjs/bull'
import { Logger } from '@nestjs/common'
import { Job } from 'bull'
import { NotificationsService, LeadNotificationData } from './notifications.service'

@Processor('notifications')
export class NotificationsProcessor {
  private readonly logger = new Logger(NotificationsProcessor.name)

  constructor(private readonly notificationsService: NotificationsService) {}

  @Process('unassigned-reminder')
  async handleUnassignedReminder(job: Job<LeadNotificationData>): Promise<void> {
    this.logger.log(`Checking unassigned status for deal ${job.data.dealId}`)
    await this.notificationsService.sendUnassignedReminder(job.data)
  }
}
