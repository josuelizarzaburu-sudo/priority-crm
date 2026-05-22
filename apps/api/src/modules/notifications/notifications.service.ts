import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { InjectQueue } from '@nestjs/bull'
import { Queue } from 'bull'
import * as nodemailer from 'nodemailer'
import { UserRole } from '@prisma/client'
import { PrismaService } from '../../prisma/prisma.service'

const PROFILE_INFO: Record<string, { label: string; pitch: string }> = {
  A: {
    label: 'Deportista con seguro',
    pitch: 'ya tiene seguro, mostrar cómo Vitality le premia por ejercitarse',
  },
  B: {
    label: 'Deportista sin seguro',
    pitch: 'proteger su estilo de vida activo + premios por su deporte',
  },
  C: {
    label: 'Sin deporte con seguro',
    pitch: 'motivar cambio de hábitos, premios por empezar a ejercitarse',
  },
  D: {
    label: 'Sin deporte sin seguro',
    pitch: 'cambio de vida completo, Vitality como motivador',
  },
}

export interface LeadNotificationData {
  dealId: string
  orgId: string
  contactName: string
  phone: string
  email?: string
  profileType: string
  source: string
  arrivalTime: Date
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name)
  private transporter: nodemailer.Transporter | null = null

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    @InjectQueue('notifications') private readonly queue: Queue,
  ) {
    const host = config.get<string>('SMTP_HOST')
    if (host) {
      this.transporter = nodemailer.createTransport({
        host,
        port: config.get<number>('SMTP_PORT', 587),
        secure: false,
        auth: {
          user: config.get('SMTP_USER'),
          pass: config.get('SMTP_PASS'),
        },
      })
    } else {
      this.logger.warn('SMTP_HOST not set — emails will be logged to console')
    }
  }

  private async sendEmail(to: string, subject: string, html: string): Promise<void> {
    if (!this.transporter) {
      this.logger.log(
        `[EMAIL] To: ${to}\nSubject: ${subject}\n--- (set SMTP_HOST to send real emails)`,
      )
      return
    }
    try {
      const from = this.config.get('SMTP_FROM', 'Priority CRM <noreply@priority.com>')
      await this.transporter.sendMail({ from, to, subject, html })
      this.logger.log(`Email sent → ${to} | ${subject}`)
    } catch (err) {
      this.logger.error(`Email failed → ${to}: ${err}`)
    }
  }

  private formatTime(date: Date): string {
    return date.toLocaleString('es-MX', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  private escape(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  }

  private buildHtml(data: LeadNotificationData, withPitch: boolean): string {
    const profile = PROFILE_INFO[data.profileType] ?? {
      label: data.profileType,
      pitch: '',
    }
    const appUrl = this.config.get('APP_URL', 'https://crm.priority.com')
    const name = this.escape(data.contactName)
    const phone = this.escape(data.phone)
    const email = this.escape(data.email ?? '—')
    const source = this.escape(data.source)
    const time = this.formatTime(data.arrivalTime)

    const rows: [string, string][] = [
      ['Nombre', name],
      ['Teléfono', phone],
      ['Email', email],
      ['Perfil', `${data.profileType} — ${profile.label}`],
      ['Fuente', source],
      ['Hora de llegada', time],
    ]

    const rowsHtml = rows
      .map(
        ([k, v]) => `
      <tr>
        <td style="padding:10px 24px;color:#6b7585;font-size:13px;width:38%;border-bottom:1px solid #f3f4f6;">${k}</td>
        <td style="padding:10px 24px;color:#25324b;font-size:13px;font-weight:600;border-bottom:1px solid #f3f4f6;">${v}</td>
      </tr>`,
      )
      .join('')

    const pitchHtml = withPitch
      ? `<tr>
          <td colspan="2" style="padding:16px 24px;background:#fef9f0;border-top:2px solid #d3ac76;">
            <strong style="color:#25324b;font-size:13px;">🎯 Pitch recomendado — Perfil ${data.profileType}:</strong>
            <p style="margin:8px 0 0;color:#4a5568;font-size:13px;">${this.escape(profile.pitch)}</p>
          </td>
        </tr>`
      : ''

    return `<!DOCTYPE html>
<html>
<body style="margin:0;padding:24px;background:#f4f5f7;font-family:sans-serif;">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
    <div style="background:#25324b;padding:20px 24px;">
      <h2 style="margin:0;color:#fff;font-size:17px;font-weight:700;">Priority CRM</h2>
    </div>
    <table style="width:100%;border-collapse:collapse;">
      ${rowsHtml}
      ${pitchHtml}
    </table>
    <div style="padding:20px 24px;text-align:center;background:#f8f9fa;">
      <a href="${appUrl}" style="display:inline-block;background:#25324b;color:#fff;padding:10px 28px;border-radius:8px;text-decoration:none;font-size:13px;font-weight:600;">
        Abrir CRM
      </a>
    </div>
  </div>
</body>
</html>`
  }

  async notifyNewLead(data: LeadNotificationData): Promise<void> {
    const recipients = await this.prisma.user.findMany({
      where: {
        organizationId: data.orgId,
        role: { in: [UserRole.ADMIN, UserRole.MANAGER] },
      },
      select: { email: true },
    })

    const subject = `🎯 Nuevo lead — ${data.contactName}`
    const html = this.buildHtml(data, false)
    for (const r of recipients) {
      await this.sendEmail(r.email, subject, html)
    }

    await this.queue.add('unassigned-reminder', data, {
      delay: 2 * 60 * 1000,
      attempts: 1,
      removeOnComplete: true,
    })
    this.logger.log(`Unassigned-reminder queued for deal ${data.dealId} (+2 min)`)
  }

  async notifyDealAssigned(
    agentEmail: string,
    data: LeadNotificationData,
  ): Promise<void> {
    const subject = `🎯 Nuevo lead asignado — ${data.contactName}`
    const html = this.buildHtml(data, true)
    await this.sendEmail(agentEmail, subject, html)
  }

  async sendUnassignedReminder(data: LeadNotificationData): Promise<void> {
    const deal = await this.prisma.deal.findUnique({
      where: { id: data.dealId },
      select: { assignedToId: true },
    })
    if (!deal || deal.assignedToId) return

    const recipients = await this.prisma.user.findMany({
      where: {
        organizationId: data.orgId,
        role: { in: [UserRole.ADMIN, UserRole.MANAGER] },
      },
      select: { email: true },
    })

    const subject = `⚠️ Lead sin asignar — ${data.contactName}`
    const html = this.buildHtml(data, false)
    for (const r of recipients) {
      await this.sendEmail(r.email, subject, html)
    }
    this.logger.log(`Unassigned reminder sent for deal ${data.dealId}`)
  }
}
