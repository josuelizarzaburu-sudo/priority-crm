import { Process, Processor } from '@nestjs/bull'
import { Logger } from '@nestjs/common'
import { Job } from 'bull'

@Processor('automations')
export class AutomationsProcessor {
  private readonly logger = new Logger(AutomationsProcessor.name)

  @Process('execute')
  async executeAutomation(job: Job<{ automation: any; payload: any }>) {
    const { automation, payload } = job.data
    this.logger.log(`Executing automation: ${automation.name}`)

    for (const action of automation.actions ?? []) {
      await this.executeAction(action, payload)
    }
  }

  private async executeAction(action: any, payload: any) {
    switch (action.type) {
      case 'SEND_EMAIL':
        this.logger.log(`Action: send email to ${payload.contact?.email}`)
        break
      case 'SEND_WHATSAPP':
        this.logger.log(`Action: send WhatsApp to ${payload.contact?.phone}`)
        break
      case 'MOVE_DEAL':
        this.logger.log(`Action: move deal to stage ${action.config.stageId}`)
        break
      case 'CREATE_TASK':
        this.logger.log(`Action: create task "${action.config.title}"`)
        break
      case 'NOTIFY_USER':
        this.logger.log(`Action: notify user ${action.config.userId}`)
        break
      default:
        this.logger.warn(`Unknown action type: ${action.type}`)
    }
  }
}
