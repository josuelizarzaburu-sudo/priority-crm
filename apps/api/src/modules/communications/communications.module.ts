import { Module } from '@nestjs/common'
import { CommunicationsController } from './communications.controller'
import { CommunicationsService } from './communications.service'
import { CommunicationsGateway } from './communications.gateway'
import { WhatsappService } from './channels/whatsapp.service'
import { EmailService } from './channels/email.service'

@Module({
  controllers: [CommunicationsController],
  providers: [CommunicationsService, CommunicationsGateway, WhatsappService, EmailService],
  exports: [CommunicationsService],
})
export class CommunicationsModule {}
