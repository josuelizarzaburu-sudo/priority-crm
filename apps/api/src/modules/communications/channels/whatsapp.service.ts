import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

@Injectable()
export class WhatsappService {
  private readonly logger = new Logger(WhatsappService.name)

  constructor(private readonly config: ConfigService) {}

  async sendMessage(to: string, body: string): Promise<void> {
    const provider = this.config.get('WHATSAPP_PROVIDER', 'meta')

    if (provider === 'meta') {
      await this.sendViaMetaApi(to, body)
    } else if (provider === 'twilio') {
      await this.sendViaTwilio(to, body)
    }
  }

  private async sendViaMetaApi(to: string, body: string) {
    const token = this.config.get('META_WHATSAPP_TOKEN')
    const phoneId = this.config.get('META_WHATSAPP_PHONE_ID')

    const response = await fetch(
      `https://graph.facebook.com/v19.0/${phoneId}/messages`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to,
          type: 'text',
          text: { body },
        }),
      },
    )

    if (!response.ok) {
      this.logger.error(`WhatsApp API error: ${await response.text()}`)
    }
  }

  private async sendViaTwilio(to: string, body: string) {
    const twilio = require('twilio')(
      this.config.get('TWILIO_ACCOUNT_SID'),
      this.config.get('TWILIO_AUTH_TOKEN'),
    )
    await twilio.messages.create({
      from: `whatsapp:${this.config.get('TWILIO_WHATSAPP_NUMBER')}`,
      to: `whatsapp:${to}`,
      body,
    })
  }
}
