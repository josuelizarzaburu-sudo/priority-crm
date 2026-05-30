import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { InjectQueue } from '@nestjs/bull'
import { Queue } from 'bull'
import { Resend } from 'resend'
import { UserRole } from '@prisma/client'
import { PrismaService } from '../../prisma/prisma.service'

const FROM = 'Priority CRM <leads@priorityhealth.ec>'

const PROFILE_INFO: Record<string, { label: string; pitch: string; waDescription: string }> = {
  A: {
    label: 'Deportista con seguro',
    pitch: 'ya tiene seguro, mostrar cómo Vitality le premia por ejercitarse',
    waDescription: 'Ya tiene seguro y hace deporte — mostrar cómo Vitality le premia',
  },
  B: {
    label: 'Deportista sin seguro',
    pitch: 'proteger su estilo de vida activo + premios por su deporte',
    waDescription: 'Tiene seguro pero no hace deporte — motivar cambio de hábitos',
  },
  C: {
    label: 'Sin deporte con seguro',
    pitch: 'motivar cambio de hábitos, premios por empezar a ejercitarse',
    waDescription: 'Hace deporte pero sin seguro — proteger su estilo de vida activo',
  },
  D: {
    label: 'Sin deporte sin seguro',
    pitch: 'cambio de vida completo, Vitality como motivador',
    waDescription: 'Sin deporte ni seguro — cambio de vida completo con Vitality',
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

export interface FollowUpReminderData {
  dealId: string
  orgId: string
  contactName: string
  phone: string
  followUpAt: string // ISO string
  agentId: string
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name)
  private resend: Resend | null = null

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    @InjectQueue('notifications') private readonly queue: Queue,
  ) {
    const apiKey = config.get<string>('RESEND_API_KEY')
    if (apiKey) {
      this.resend = new Resend(apiKey)
      this.logger.log('Resend configured')
    } else {
      this.logger.warn('RESEND_API_KEY not set — emails will be logged to console')
    }
  }

  private async sendEmail(to: string, subject: string, html: string): Promise<void> {
    if (!this.resend) {
      this.logger.log(`[EMAIL] To: ${to} | Subject: ${subject}\n--- (set RESEND_API_KEY to send real emails)`)
      return
    }
    try {
      const { data, error } = await this.resend.emails.send({ from: FROM, to: [to], subject, html })
      if (error) {
        console.log('Resend error →', to, error)
        this.logger.error(`Email failed → ${to}: ${JSON.stringify(error)}`)
      } else {
        console.log('Resend OK →', to, data?.id)
        this.logger.log(`Email sent → ${to} | ${subject}`)
      }
    } catch (err) {
      console.log('Resend exception →', to, err)
      this.logger.error(`Email exception → ${to}: ${err}`)
    }
  }

  private async sendWhatsapp(to: string, body: string): Promise<void> {
    const token = this.config.get<string>('META_WHATSAPP_TOKEN')
    const phoneId = this.config.get<string>('META_WHATSAPP_PHONE_ID')
    if (!token || !phoneId) return
    try {
      const res = await fetch(`https://graph.facebook.com/v19.0/${phoneId}/messages`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ messaging_product: 'whatsapp', to, type: 'text', text: { body } }),
      })
      if (!res.ok) {
        this.logger.error(`WA send failed to ${to}: ${await res.text()}`)
      } else {
        this.logger.log(`WA sent to ${to}`)
      }
    } catch (err) {
      this.logger.error(`WA send error to ${to}: ${err}`)
    }
  }

  private formatTime(date: Date): string {
    return date.toLocaleString('es-EC', {
      timeZone: 'America/Guayaquil',
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
    const profile = PROFILE_INFO[data.profileType] ?? { label: data.profileType, pitch: '' }
    const appUrl = this.config.get('APP_URL', 'https://crm.priority.com')

    const rows: [string, string][] = [
      ['Nombre', this.escape(data.contactName)],
      ['Teléfono', this.escape(data.phone)],
      ['Email', this.escape(data.email ?? '—')],
      ['Perfil', `${data.profileType} — ${profile.label}`],
      ['Fuente', this.escape(data.source)],
      ['Hora de llegada', this.formatTime(data.arrivalTime)],
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

  private buildFollowUpHtml(data: FollowUpReminderData, timeStr: string): string {
    const appUrl = this.config.get('APP_URL', 'https://crm.priority.com')
    const rows: [string, string][] = [
      ['Cliente', this.escape(data.contactName)],
      ['Teléfono', this.escape(data.phone)],
      ['Hora programada', this.escape(timeStr)],
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

    return `<!DOCTYPE html>
<html>
<body style="margin:0;padding:24px;background:#f4f5f7;font-family:sans-serif;">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
    <div style="background:#25324b;padding:20px 24px;">
      <h2 style="margin:0;color:#fff;font-size:17px;font-weight:700;">📅 Recordatorio de seguimiento</h2>
    </div>
    <table style="width:100%;border-collapse:collapse;">
      ${rowsHtml}
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
    console.log('NotificationsService.notifyNewLead called', { dealId: data.dealId, contact: data.contactName })
    console.log('Resend configured:', !!this.resend)

    const recipients = await this.prisma.user.findMany({
      where: {
        organizationId: data.orgId,
        role: { in: [UserRole.SUPER_ADMIN, UserRole.OWNER, UserRole.MANAGER] },
      },
      select: { email: true },
    })

    console.log(`Recipients (${recipients.length}):`, recipients.map(r => r.email))

    const subject = `🎯 Nuevo lead — ${data.contactName}`
    const html = this.buildHtml(data, false)
    for (const r of recipients) {
      console.log('Sending email to:', r.email)
      await this.sendEmail(r.email, subject, html)
    }

    await this.queue.add('unassigned-reminder', data, {
      delay: 2 * 60 * 1000,
      attempts: 1,
      removeOnComplete: true,
    })
    this.logger.log(`Unassigned-reminder queued for deal ${data.dealId} (+2 min)`)
  }

  async notifyDealAssigned(agent: { email: string; phone?: string | null }, data: LeadNotificationData): Promise<void> {
    const subject = `🎯 Nuevo lead asignado — ${data.contactName}`
    const html = this.buildHtml(data, true)
    await this.sendEmail(agent.email, subject, html)

    if (agent.phone) {
      const profile = PROFILE_INFO[data.profileType]
      const waMsg =
        `🎯 Nuevo lead asignado — Priority CRM\n` +
        `👤 Cliente: ${data.contactName}\n` +
        `📱 Teléfono: ${data.phone}\n` +
        `📧 Email: ${data.email ?? '—'}\n` +
        `🏷️ Perfil: ${profile?.waDescription ?? data.profileType}\n` +
        `Entra al CRM para gestionar este lead.\n` +
        `👉 crm.priorityhealth.ec`
      await this.sendWhatsapp(agent.phone, waMsg)
    }
  }

  async scheduleFollowUpReminders(data: FollowUpReminderData): Promise<void> {
    const followUpDate = new Date(data.followUpAt)
    const now = Date.now()

    const job24hId = `follow-up-24h-${data.dealId}`
    const job2hId = `follow-up-2h-${data.dealId}`

    // Remove existing jobs for this deal before rescheduling
    const [existing24h, existing2h] = await Promise.all([
      this.queue.getJob(job24hId),
      this.queue.getJob(job2hId),
    ])
    if (existing24h) await existing24h.remove()
    if (existing2h) await existing2h.remove()

    const delay24h = followUpDate.getTime() - 24 * 60 * 60 * 1000 - now
    const delay2h = followUpDate.getTime() - 2 * 60 * 60 * 1000 - now

    if (delay24h > 0) {
      await this.queue.add('follow-up-reminder', { ...data, reminderType: '24h' }, {
        delay: delay24h,
        attempts: 1,
        removeOnComplete: true,
        jobId: job24hId,
      })
      this.logger.log(`Follow-up 24h reminder scheduled for deal ${data.dealId}`)
    }

    if (delay2h > 0) {
      await this.queue.add('follow-up-reminder', { ...data, reminderType: '2h' }, {
        delay: delay2h,
        attempts: 1,
        removeOnComplete: true,
        jobId: job2hId,
      })
      this.logger.log(`Follow-up 2h reminder scheduled for deal ${data.dealId}`)
    }
  }

  async sendFollowUpReminder(data: FollowUpReminderData & { reminderType: '24h' | '2h' }): Promise<void> {
    const followUpDate = new Date(data.followUpAt)
    const timeStr = this.formatTime(followUpDate)

    const waMsg =
      data.reminderType === '24h'
        ? `📅 Recordatorio — Priority CRM\nMañana tienes una llamada programada:\n👤 Cliente: ${data.contactName}\n📱 Teléfono: ${data.phone}\n🕐 Hora: ${timeStr}\nPrepárate con anticipación 💪\n👉 crm.priorityhealth.ec`
        : `⏰ En 2 horas tienes que llamar — Priority CRM\n👤 Cliente: ${data.contactName}\n📱 Teléfono: ${data.phone}\n🕐 Hora: ${timeStr}\n¡No lo dejes pasar!\n👉 crm.priorityhealth.ec`

    const subject =
      data.reminderType === '24h'
        ? `📅 Recordatorio de llamada mañana — ${data.contactName}`
        : `⏰ Llamada en 2 horas — ${data.contactName}`

    const html = this.buildFollowUpHtml(data, timeStr)

    const [deal, managers] = await Promise.all([
      this.prisma.deal.findUnique({
        where: { id: data.dealId },
        include: { assignedTo: { select: { email: true, phone: true } } },
      }),
      this.prisma.user.findMany({
        where: {
          organizationId: data.orgId,
          role: { in: [UserRole.SUPER_ADMIN, UserRole.OWNER, UserRole.MANAGER] },
        },
        select: { email: true, phone: true },
      }),
    ])

    if (!deal) return

    // Notify vendor (WhatsApp + email)
    if (deal.assignedTo) {
      if (deal.assignedTo.phone) await this.sendWhatsapp(deal.assignedTo.phone, waMsg)
      await this.sendEmail(deal.assignedTo.email, subject, html)
    }

    // Notify managers (WhatsApp + email)
    for (const m of managers) {
      if (m.phone) await this.sendWhatsapp(m.phone, waMsg)
      await this.sendEmail(m.email, subject, html)
    }

    this.logger.log(`Follow-up ${data.reminderType} reminder sent for deal ${data.dealId}`)
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
        role: { in: [UserRole.SUPER_ADMIN, UserRole.OWNER, UserRole.MANAGER] },
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
