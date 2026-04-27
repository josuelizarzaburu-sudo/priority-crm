import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import * as nodemailer from 'nodemailer'

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name)
  private transporter: nodemailer.Transporter

  constructor(private readonly config: ConfigService) {
    this.transporter = nodemailer.createTransport({
      host: config.get('SMTP_HOST'),
      port: config.get<number>('SMTP_PORT', 587),
      secure: false,
      auth: {
        user: config.get('SMTP_USER'),
        pass: config.get('SMTP_PASS'),
      },
    })
  }

  async sendEmail(params: { to: string; subject: string; text?: string; html?: string }) {
    try {
      await this.transporter.sendMail({
        from: this.config.get('SMTP_FROM'),
        ...params,
      })
    } catch (err) {
      this.logger.error(`Email send error: ${err}`)
      throw err
    }
  }
}
