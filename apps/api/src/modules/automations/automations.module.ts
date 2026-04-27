import { Module } from '@nestjs/common'
import { BullModule } from '@nestjs/bull'
import { AutomationsController } from './automations.controller'
import { AutomationsService } from './automations.service'
import { AutomationsProcessor } from './automations.processor'

@Module({
  imports: [BullModule.registerQueue({ name: 'automations' })],
  controllers: [AutomationsController],
  providers: [AutomationsService, AutomationsProcessor],
  exports: [AutomationsService],
})
export class AutomationsModule {}
