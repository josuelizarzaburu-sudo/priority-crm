import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { InjectQueue } from '@nestjs/bull'
import { Queue } from 'bull'
import { Resend } from 'resend'
import { UserRole } from '@prisma/client'
import { PrismaService } from '../../prisma/prisma.service'
import { PushService } from '../push/push.service'

const FROM = 'Priority CRM <leads@priorityhealth.ec>'

const PROFILE_INFO: Record<string, { label: string; pitch: string }> = {
  A: {
    label: 'Deportista con seguro',
    pitch: 'Ya tiene seguro y entrena. Mostrarle cómo Vitality convierte su disciplina en cashback y premios, sin pagar extra.',
  },
  B: {
    label: 'Con seguro, sin deporte',
    pitch: 'Tiene seguro pero no se ejercita. Vitality empieza desde cero (caminar, chequeo anual, hábitos) y convierte su seguro en inversión con cashback.',
  },
  C: {
    label: 'Deportista sin seguro',
    pitch: 'Entrena pero no tiene seguro. Proteger su estilo de vida activo con respaldo médico, y su deporte le suma cashback y premios.',
  },
  D: {
    label: 'Sin seguro, sin deporte',
    pitch: 'Sin seguro ni hábito. Protección desde el día uno y Vitality lo acompaña con metas pequeñas y premios desde la semana uno.',
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

export interface DealWonData {
  dealId: string
  orgId: string
  contactName: string
  phone: string
  plan?: string
  netPremium?: number
  vendorName: string
  closedAt: Date
}

export interface FutureOpportunityJobData {
  dealId: string
  oppId: string
  orgId: string
  contactName: string
  phone: string
  email?: string
  insuranceType: string
  note: string
  contactDate: string
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name)
  private resend: Resend | null = null

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly push: PushService,
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

  private getAppUrl(): string {
    return this.config.get<string>('APP_URL') || 'https://crm.priorityhealth.ec'
  }

  private buildHtml(data: LeadNotificationData, withPitch: boolean): string {
    const profile = PROFILE_INFO[data.profileType] ?? { label: data.profileType, pitch: '' }
    const appUrl = this.getAppUrl()

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
    const appUrl = this.getAppUrl()
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
      select: { id: true, email: true },
    })

    console.log(`Recipients (${recipients.length}):`, recipients.map(r => r.email))

    const subject = `🎯 Nuevo lead — ${data.contactName}`
    const html = this.buildHtml(data, false)
    for (const r of recipients) {
      console.log('Sending email to:', r.email)
      await this.sendEmail(r.email, subject, html)
    }
    await this.push.sendToUsers(
      recipients.map(r => r.id),
      { title: `🎯 Nuevo lead — ${data.contactName}`, body: `Tel: ${data.phone} · Fuente: ${data.source}`, url: '/pipeline' },
    )

    await this.queue.add('unassigned-reminder', data, {
      delay: 2 * 60 * 1000,
      attempts: 1,
      removeOnComplete: true,
    })
    this.logger.log(`Unassigned-reminder queued for deal ${data.dealId} (+2 min)`)
  }

  async notifyDealAssigned(agent: { id: string; email: string; phone?: string | null }, data: LeadNotificationData): Promise<void> {
    const subject = `🎯 Nuevo lead asignado — ${data.contactName}`
    const html = this.buildHtml(data, true)
    await this.sendEmail(agent.email, subject, html)
    await this.push.sendToUser(agent.id, {
      title: `🎯 Nuevo lead asignado — ${data.contactName}`,
      body: `Tel: ${data.phone}${data.email ? ` · ${data.email}` : ''}`,
      url: '/pipeline',
    })

    if (agent.phone) {
      const profile = PROFILE_INFO[data.profileType]
      const waMsg =
        `🎯 Nuevo lead asignado — Priority CRM\n` +
        `👤 Cliente: ${data.contactName}\n` +
        `📱 Teléfono: ${data.phone}\n` +
        `📧 Email: ${data.email ?? '—'}\n` +
        `🏷️ Perfil: ${data.profileType} — ${profile?.label ?? data.profileType}\n` +
        `Entra al CRM para gestionar este lead.\n` +
        `👉 ${this.getAppUrl()}`
      await this.sendWhatsapp(agent.phone, waMsg)
    }
  }

  async scheduleFollowUpReminders(data: FollowUpReminderData): Promise<void> {
    try {
      const followUpDate = new Date(data.followUpAt)
      const now = Date.now()
      const msUntil = followUpDate.getTime() - now

      const H2   =  2 * 60 * 60 * 1000
      const M10  = 10 * 60 * 1000

      const job2hId  = `follow-up-2h-${data.dealId}`
      const job10mId = `follow-up-10m-${data.dealId}`

      // Always remove existing jobs before rescheduling
      const [existing2h, existing10m] = await Promise.all([
        this.queue.getJob(job2hId),
        this.queue.getJob(job10mId),
      ])
      if (existing2h)  await existing2h.remove()
      if (existing10m) await existing10m.remove()

      console.log(`[FollowUp] deal=${data.dealId} msUntil=${msUntil} (${(msUntil / 3600000).toFixed(2)}h)`)

      if (msUntil <= 0) {
        console.log(`[FollowUp] Date already passed — no jobs created`)
        return
      }

      if (msUntil < M10) {
        // Less than 10 min away — send immediately, no job needed
        console.log(`[FollowUp] < 10min away — sending notification immediately (no BullMQ job)`)
        await this.sendFollowUpReminder({ ...data, reminderType: '10m' })
        return
      }

      if (msUntil < H2) {
        // Between 10 min and 2 h — only the 10 min job
        const delay10m = msUntil - M10
        console.log(`[FollowUp] Between 10min-2h — creating 10m job, delay=${delay10m}ms`)
        await this.queue.add('follow-up-reminder', { ...data, reminderType: '10m' }, {
          delay: delay10m,
          attempts: 1,
          removeOnComplete: true,
          jobId: job10mId,
        })
        return
      }

      // More than 2 h away — create both jobs
      const delay2h  = msUntil - H2
      const delay10m = msUntil - M10
      console.log(`[FollowUp] > 2h away — creating 2h job (delay=${delay2h}ms) AND 10m job (delay=${delay10m}ms)`)
      await this.queue.add('follow-up-reminder', { ...data, reminderType: '2h' }, {
        delay: delay2h,
        attempts: 1,
        removeOnComplete: true,
        jobId: job2hId,
      })
      await this.queue.add('follow-up-reminder', { ...data, reminderType: '10m' }, {
        delay: delay10m,
        attempts: 1,
        removeOnComplete: true,
        jobId: job10mId,
      })
    } catch (err) {
      // Redis/BullMQ unavailable — follow-up is saved in DB; reminders will not fire
      this.logger.warn(`scheduleFollowUpReminders skipped (Redis unavailable): ${err instanceof Error ? err.message : err}`)
    }
  }

  async sendFollowUpReminder(data: FollowUpReminderData & { reminderType: '2h' | '10m' }): Promise<void> {
    const followUpDate = new Date(data.followUpAt)
    const timeStr = this.formatTime(followUpDate)

    const waMsg =
      data.reminderType === '2h'
        ? `📅 Recordatorio — Priority CRM\nEn 2 horas tienes una llamada programada:\n👤 Cliente: ${data.contactName}\n📱 Teléfono: ${data.phone}\n🕐 Hora: ${timeStr}\nPrepárate con anticipación 💪\n👉 ${this.getAppUrl()}`
        : `⏰ En 10 minutos tienes que llamar — Priority CRM\n👤 Cliente: ${data.contactName}\n📱 Teléfono: ${data.phone}\n🕐 Hora: ${timeStr}\n¡No lo dejes pasar!\n👉 ${this.getAppUrl()}`

    const subject =
      data.reminderType === '2h'
        ? `📅 Recordatorio de llamada en 2 horas — ${data.contactName}`
        : `⏰ Llamada en 10 minutos — ${data.contactName}`

    const html = this.buildFollowUpHtml(data, timeStr)

    const [deal, managers] = await Promise.all([
      this.prisma.deal.findUnique({
        where: { id: data.dealId },
        include: { assignedTo: { select: { id: true, email: true, phone: true } } },
      }),
      this.prisma.user.findMany({
        where: {
          organizationId: data.orgId,
          role: { in: [UserRole.SUPER_ADMIN, UserRole.OWNER, UserRole.MANAGER] },
        },
        select: { id: true, email: true, phone: true },
      }),
    ])

    if (!deal) return

    const pushPayload = {
      title: subject,
      body: `Cliente: ${data.contactName} · Tel: ${data.phone} · ${timeStr}`,
      url: '/pipeline',
    }

    // Notify vendor (WhatsApp + email + push)
    if (deal.assignedTo) {
      if (deal.assignedTo.phone) await this.sendWhatsapp(deal.assignedTo.phone, waMsg)
      await this.sendEmail(deal.assignedTo.email, subject, html)
      await this.push.sendToUser(deal.assignedTo.id, pushPayload)
    }

    // Notify managers (WhatsApp + email + push)
    for (const m of managers) {
      if (m.phone) await this.sendWhatsapp(m.phone, waMsg)
      await this.sendEmail(m.email, subject, html)
      await this.push.sendToUser(m.id, pushPayload)
    }

    this.logger.log(`Follow-up ${data.reminderType} reminder sent for deal ${data.dealId}`)
  }

  private buildDealWonHtml(data: DealWonData): string {
    const appUrl = this.getAppUrl()
    const dateStr = this.formatTime(data.closedAt)

    const rows: [string, string][] = [
      ['Cliente', this.escape(data.contactName)],
      ['Teléfono', this.escape(data.phone)],
      ['Vendedor', this.escape(data.vendorName)],
      ['Plan', this.escape(data.plan ?? '—')],
      ['Prima neta', data.netPremium ? `$${data.netPremium.toLocaleString('es-EC')}` : '—'],
      ['Fecha de cierre', dateStr],
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
      <h2 style="margin:0;color:#d3ac76;font-size:17px;font-weight:700;">🏆 ¡Deal ganado! — Priority CRM</h2>
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

  async notifyDealWon(data: DealWonData): Promise<void> {
    const recipients = await this.prisma.user.findMany({
      where: {
        organizationId: data.orgId,
        role: { in: [UserRole.SUPER_ADMIN, UserRole.OWNER, UserRole.MANAGER] },
      },
      select: { id: true, email: true, phone: true },
    })

    const subject = `🏆 ¡Deal ganado! — ${data.contactName}`
    const html = this.buildDealWonHtml(data)
    const waMsg =
      `🏆 ¡Deal ganado! — Priority CRM\n` +
      `👤 Cliente: ${data.contactName}\n` +
      `📱 Teléfono: ${data.phone}\n` +
      `💼 Vendedor: ${data.vendorName}\n` +
      `📋 Plan: ${data.plan ?? '—'}\n` +
      `💰 Prima neta: ${data.netPremium ? `$${data.netPremium}` : '—'}\n` +
      `👉 ${this.getAppUrl()}`

    for (const r of recipients) {
      await this.sendEmail(r.email, subject, html)
      if (r.phone) await this.sendWhatsapp(r.phone, waMsg)
    }

    await this.push.sendToUsers(
      recipients.map(r => r.id),
      {
        title: `🏆 ¡Deal ganado!`,
        body: `${data.vendorName} cerró el deal con ${data.contactName}`,
        url: '/pipeline',
      },
    )

    this.logger.log(`Deal-won notifications sent for deal ${data.dealId} — ${recipients.length} recipients`)
  }

  async scheduleCalendarEventReminder(eventId: string, orgId: string, startAt: Date): Promise<void> {
    try {
      const jobId = `calendar-event-${eventId}`
      const existing = await this.queue.getJob(jobId)
      if (existing) await existing.remove()

      const delay = startAt.getTime() - Date.now() - 24 * 60 * 60 * 1000
      if (delay <= 0) {
        this.logger.warn(`Calendar event ${eventId} — less than 24h away, not scheduling`)
        return
      }

      await this.queue.add('calendar-event-reminder', { eventId, orgId }, {
        delay,
        attempts: 2,
        removeOnComplete: true,
        jobId,
      })
      this.logger.log(`Calendar event reminder scheduled: ${jobId}`)
    } catch (err) {
      this.logger.warn(`scheduleCalendarEventReminder skipped: ${err instanceof Error ? err.message : err}`)
    }
  }

  async cancelCalendarEventReminder(eventId: string): Promise<void> {
    try {
      const job = await this.queue.getJob(`calendar-event-${eventId}`)
      if (job) await job.remove()
    } catch (err) {
      this.logger.warn(`cancelCalendarEventReminder skipped: ${err instanceof Error ? err.message : err}`)
    }
  }

  private buildCalendarReminderHtml(event: any, startStr: string, endStr: string): string {
    const appUrl = this.getAppUrl()
    const rows: [string, string][] = [
      ['Evento', this.escape(event.title)],
      ['Hora inicio', startStr],
      ['Hora fin', endStr],
      ['Dictado por', this.escape(event.givenBy || '—')],
      ['Modalidad', event.modality === 'VIRTUAL' ? 'Virtual' : 'Presencial'],
      ...(event.modality === 'VIRTUAL' && event.meetingLink
        ? [['Link', `<a href="${this.escape(event.meetingLink)}">${this.escape(event.meetingLink)}</a>`] as [string, string]]
        : []),
      ['Motivo', this.escape(event.description || '—')],
    ]
    const rowsHtml = rows.map(([k, v]) => `
      <tr>
        <td style="padding:10px 24px;color:#6b7585;font-size:13px;width:38%;border-bottom:1px solid #f3f4f6;">${k}</td>
        <td style="padding:10px 24px;color:#25324b;font-size:13px;font-weight:600;border-bottom:1px solid #f3f4f6;">${v}</td>
      </tr>`).join('')
    return `<!DOCTYPE html>
<html>
<body style="margin:0;padding:24px;background:#f4f5f7;font-family:sans-serif;">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
    <div style="background:#25324b;padding:20px 24px;">
      <h2 style="margin:0;color:#d3ac76;font-size:17px;font-weight:700;">📅 Recordatorio de evento — Priority CRM</h2>
    </div>
    <p style="padding:16px 24px 0;margin:0;color:#4a5568;font-size:13px;">
      Mañana tienes programado: <strong>${this.escape(event.title)}</strong>
    </p>
    <table style="width:100%;border-collapse:collapse;margin-top:8px;">${rowsHtml}</table>
    <div style="padding:20px 24px;text-align:center;background:#f8f9fa;">
      <a href="${appUrl}/calendar" style="display:inline-block;background:#25324b;color:#fff;padding:10px 28px;border-radius:8px;text-decoration:none;font-size:13px;font-weight:600;">
        Ver calendario
      </a>
    </div>
  </div>
</body>
</html>`
  }

  async sendCalendarEventReminder(eventId: string): Promise<void> {
    const event = await this.prisma.calendarEvent.findUnique({
      where: { id: eventId },
      include: {
        participants: {
          include: { user: { select: { id: true, name: true, email: true, phone: true } } },
        },
      },
    })
    if (!event || event.participants.length === 0) return

    const startStr = this.formatTime(event.startAt)
    const endStr = event.endAt ? this.formatTime(event.endAt) : '—'
    const linkLine = event.modality === 'VIRTUAL' && event.meetingLink
      ? `\n🔗 Link: ${event.meetingLink}`
      : ''

    const waMsg =
      `📅 Recordatorio — Priority CRM\n\n` +
      `Mañana tienes: ${event.title}\n` +
      `🕐 Hora: ${startStr} — ${endStr}\n` +
      `👤 Dictado por: ${event.givenBy || '—'}\n` +
      `📍 Modalidad: ${event.modality === 'VIRTUAL' ? 'Virtual' : 'Presencial'}` +
      linkLine + '\n' +
      `📝 Motivo: ${event.description || '—'}\n\n` +
      `👉 ${this.getAppUrl()}`

    const subject = `📅 Mañana: ${event.title} a las ${startStr}`
    const html = this.buildCalendarReminderHtml(event, startStr, endStr)

    for (const p of event.participants) {
      const u = p.user as any
      if (u.phone) await this.sendWhatsapp(u.phone, waMsg)
      await this.sendEmail(u.email, subject, html)
      await this.push.sendToUser(u.id, {
        title: `📅 Mañana: ${event.title}`,
        body: `A las ${startStr}`,
        url: '/calendar',
      })
    }

    this.logger.log(`Calendar reminders sent for event ${eventId} — ${event.participants.length} recipients`)
  }

  async scheduleFutureOpportunity(data: FutureOpportunityJobData): Promise<void> {
    try {
      const jobId = `future-opp-${data.dealId}-${data.oppId}`
      const existing = await this.queue.getJob(jobId)
      if (existing) await existing.remove()

      // contactDate is "YYYY-MM-DDTHH:MM" from datetime-local — treat as Ecuador time (UTC-5)
      const isoNoTz = data.contactDate.replace(/Z$/, '').replace(/[+-]\d{2}:\d{2}$/, '').slice(0, 16)
      const fireAt = new Date(`${isoNoTz}:00-05:00`)
      const delay = fireAt.getTime() - Date.now()
      if (delay <= 0) {
        this.logger.warn(`Future opportunity ${jobId} — contact date already passed, not scheduling`)
        return
      }

      await this.queue.add('future-opportunity', data, {
        delay,
        attempts: 2,
        removeOnComplete: true,
        jobId,
      })
      this.logger.log(`Future opportunity scheduled: ${jobId} (~${Math.round(delay / 3_600_000)}h from now)`)
    } catch (err) {
      this.logger.warn(`scheduleFutureOpportunity skipped (Redis unavailable): ${err instanceof Error ? err.message : err}`)
    }
  }

  async cancelFutureOpportunity(dealId: string, oppId: string): Promise<void> {
    try {
      const jobId = `future-opp-${dealId}-${oppId}`
      const job = await this.queue.getJob(jobId)
      if (job) {
        await job.remove()
        this.logger.log(`Future opportunity job cancelled: ${jobId}`)
      }
    } catch (err) {
      this.logger.warn(`cancelFutureOpportunity skipped: ${err instanceof Error ? err.message : err}`)
    }
  }

  private buildFutureOpportunityHtml(contactName: string, insuranceLabel: string, phone: string, note: string): string {
    const appUrl = this.getAppUrl()
    const rows: [string, string][] = [
      ['Cliente', this.escape(contactName)],
      ['Teléfono', this.escape(phone)],
      ['Oportunidad', `Seguro de ${this.escape(insuranceLabel)}`],
      ['Nota', this.escape(note || '—')],
    ]
    const rowsHtml = rows
      .map(([k, v]) => `
      <tr>
        <td style="padding:10px 24px;color:#6b7585;font-size:13px;width:38%;border-bottom:1px solid #f3f4f6;">${k}</td>
        <td style="padding:10px 24px;color:#25324b;font-size:13px;font-weight:600;border-bottom:1px solid #f3f4f6;">${v}</td>
      </tr>`)
      .join('')

    return `<!DOCTYPE html>
<html>
<body style="margin:0;padding:24px;background:#f4f5f7;font-family:sans-serif;">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
    <div style="background:#25324b;padding:20px 24px;">
      <h2 style="margin:0;color:#d3ac76;font-size:17px;font-weight:700;">📞 Oportunidad futura — Priority CRM</h2>
    </div>
    <p style="padding:16px 24px 0;margin:0;color:#4a5568;font-size:13px;">
      Hoy es el día de contactar a <strong>${this.escape(contactName)}</strong>.
      Se creó un nuevo lead automáticamente en el CRM.
    </p>
    <table style="width:100%;border-collapse:collapse;margin-top:8px;">
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

  async executeFutureOpportunity(data: FutureOpportunityJobData): Promise<void> {
    const INSURANCE_LABELS: Record<string, string> = {
      AUTO: 'Auto', VIDA: 'Vida', PATRIMONIO: 'Patrimonio', SALUD: 'Salud',
    }
    const insuranceLabel = INSURANCE_LABELS[data.insuranceType] ?? data.insuranceType

    const [deal, managers] = await Promise.all([
      this.prisma.deal.findUnique({
        where: { id: data.dealId },
        include: {
          contact: { select: { id: true, firstName: true, lastName: true, phone: true, email: true } },
          assignedTo: { select: { id: true, name: true, email: true, phone: true } },
        },
      }),
      this.prisma.user.findMany({
        where: {
          organizationId: data.orgId,
          role: { in: [UserRole.SUPER_ADMIN, UserRole.OWNER, UserRole.MANAGER] },
        },
        select: { id: true, email: true, phone: true },
      }),
    ])

    if (!deal) {
      this.logger.warn(`executeFutureOpportunity: deal ${data.dealId} not found`)
      return
    }

    // Guard: opportunity may have been removed after job was scheduled
    const opps = (deal.customFields as any)?.futureOpportunities ?? []
    if (!opps.some((o: any) => o.id === data.oppId)) {
      this.logger.log(`Future opportunity ${data.oppId} already removed, skipping execution`)
      return
    }

    const contactPhone = (deal.contact as any)?.phone ?? data.phone

    const waMsg =
      `📞 Oportunidad futura — Priority CRM\n\n` +
      `Hoy es el día de contactar a ${data.contactName}\n` +
      `📋 Oportunidad: Seguro de ${insuranceLabel}\n` +
      `📝 Nota: ${data.note || '—'}\n` +
      `📱 Teléfono: ${contactPhone}\n\n` +
      `Se creó un nuevo lead automáticamente.\n` +
      `👉 ${this.getAppUrl()}`

    const subject = `📞 Oportunidad futura — Seguro de ${insuranceLabel} · ${data.contactName}`
    const html = this.buildFutureOpportunityHtml(data.contactName, insuranceLabel, contactPhone, data.note)

    // Notify vendor
    if (deal.assignedTo) {
      if (deal.assignedTo.phone) await this.sendWhatsapp(deal.assignedTo.phone, waMsg)
      await this.sendEmail(deal.assignedTo.email, subject, html)
    }

    // Notify managers
    for (const m of managers) {
      if (m.phone) await this.sendWhatsapp(m.phone, waMsg)
      await this.sendEmail(m.email, subject, html)
    }

    // Create new lead deal in the first pipeline stage
    const leadStage = await this.prisma.pipelineStage.findFirst({
      where: { organizationId: data.orgId },
      orderBy: { position: 'asc' },
    })

    if (!leadStage) {
      this.logger.warn(`No pipeline stages found for org ${data.orgId}, skipping lead creation`)
      return
    }

    const originalContact = deal.contact as any
    let newContactId: string | undefined

    if (originalContact) {
      const newContact = await this.prisma.contact.create({
        data: {
          firstName: originalContact.firstName,
          lastName: originalContact.lastName ?? undefined,
          phone: originalContact.phone ?? undefined,
          email: originalContact.email ?? undefined,
          source: 'CRM',
          organizationId: data.orgId,
          createdById: deal.createdById,
        },
      })
      newContactId = newContact.id
    }

    const lastDeal = await this.prisma.deal.findFirst({
      where: { stageId: leadStage.id },
      orderBy: { position: 'desc' },
    })

    await this.prisma.deal.create({
      data: {
        title: `${data.contactName} — ${insuranceLabel} (Oportunidad Futura)`,
        stageId: leadStage.id,
        organizationId: data.orgId,
        createdById: deal.createdById,
        assignedToId: deal.assignedToId ?? undefined,
        contactId: newContactId,
        position: (lastDeal?.position ?? 0) + 1000,
        notes: `Oportunidad futura — Seguro de ${insuranceLabel}: ${data.note}`,
        customFields: {
          source: 'CRM',
          insuranceType: data.insuranceType,
          fromFutureOpportunity: true,
          originalDealId: data.dealId,
        },
      },
    })

    this.logger.log(`New lead created from future opportunity ${data.oppId} (deal ${data.dealId})`)
  }

  async sendUnassignedReminder(data: LeadNotificationData): Promise<void> {
    const deal = await this.prisma.deal.findUnique({
      where: { id: data.dealId },
      select: { assignedToId: true },
    })
    if (!deal || deal.assignedToId) return

    const unassignedRecipients = await this.prisma.user.findMany({
      where: {
        organizationId: data.orgId,
        role: { in: [UserRole.SUPER_ADMIN, UserRole.OWNER, UserRole.MANAGER] },
      },
      select: { id: true, email: true },
    })

    const subject = `⚠️ Lead sin asignar — ${data.contactName}`
    const html = this.buildHtml(data, false)
    for (const r of unassignedRecipients) {
      await this.sendEmail(r.email, subject, html)
    }
    await this.push.sendToUsers(
      unassignedRecipients.map(r => r.id),
      { title: `⚠️ Lead sin asignar`, body: `${data.contactName} · Tel: ${data.phone}`, url: '/pipeline' },
    )
    this.logger.log(`Unassigned reminder sent for deal ${data.dealId}`)
  }
}
