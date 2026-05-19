import { Injectable, Logger, Inject } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type Redis from 'ioredis'
import { LeadsService } from '../leads/leads.service'
import { InsuranceType, LeadSource } from '../leads/dto/ingest-lead.dto'

export const WHATSAPP_REDIS = 'WHATSAPP_REDIS'

type BotStep = 'sport' | 'insured' | 'nombre' | 'completado'

interface BotSession {
  step: BotStep
  sport?: boolean
  insured?: boolean
  firstName?: string
  lastName?: string
}

const SESSION_TTL_SECONDS = 86400 // 24 h

const MSG_BIENVENIDA =
  'Hola! Soy el asistente de Priority Health 👋 Pensando siempre en tu bienestar. Te haré 2 preguntas rápidas.'

const MSG_SPORT =
  '¿Practicas deporte o actividad física regularmente?\n1️⃣ Sí, me ejercito\n2️⃣ No hago ejercicio'

const MSG_INSURED =
  '¿Tienes seguro de salud actualmente?\n1️⃣ Sí, tengo seguro\n2️⃣ No tengo seguro'

const MSG_NOMBRE = '¡Perfecto! ¿Me puedes dar tu nombre completo?'

const MSG_COMPLETADO = 'Ya tenemos tus datos. Un asesor te contactará pronto 🎯'

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class WhatsappBotService {
  private readonly logger = new Logger(WhatsappBotService.name)

  constructor(
    @Inject(WHATSAPP_REDIS) private readonly redis: Redis,
    private readonly config: ConfigService,
    private readonly leadsService: LeadsService,
  ) {}

  private isRestart(text: string): boolean {
    const t = text.trim().toLowerCase()
    return ['hola', 'inicio', 'start', 'reiniciar', 'reset'].includes(t)
  }

  async processMessage(phone: string, text: string): Promise<void> {
    if (this.isRestart(text)) {
      await this.redis.del(this.sessionKey(phone))
      await this.handleInicio(phone)
      return
    }

    const session = await this.getSession(phone)

    if (!session) {
      await this.handleInicio(phone)
      return
    }

    switch (session.step) {
      case 'sport':
        await this.handleSport(phone, session, text)
        break
      case 'insured':
        await this.handleInsured(phone, session, text)
        break
      case 'nombre':
        await this.handleNombre(phone, session, text)
        break
      case 'completado':
        await this.sendMessage(phone, MSG_COMPLETADO)
        break
    }
  }

  // ─── Steps ────────────────────────────────────────────────────────────────────

  private async handleInicio(phone: string): Promise<void> {
    await this.saveSession(phone, { step: 'sport' })
    await this.sendMessage(phone, MSG_BIENVENIDA)
    await this.sendMessage(phone, MSG_SPORT)
  }

  private async handleSport(phone: string, session: BotSession, text: string): Promise<void> {
    const answer = this.parseYesNo(text)
    if (answer === null) {
      await this.sendMessage(phone, MSG_SPORT)
      return
    }

    session.sport = answer
    session.step = 'insured'
    await this.saveSession(phone, session)
    await this.sendMessage(phone, MSG_INSURED)
  }

  private async handleInsured(phone: string, session: BotSession, text: string): Promise<void> {
    const answer = this.parseYesNo(text)
    if (answer === null) {
      await this.sendMessage(phone, MSG_INSURED)
      return
    }

    session.insured = answer
    session.step = 'nombre'
    await this.saveSession(phone, session)
    await this.sendMessage(phone, MSG_NOMBRE)
  }

  private async handleNombre(phone: string, session: BotSession, text: string): Promise<void> {
    const { firstName, lastName } = this.parseName(text)
    session.firstName = firstName
    session.lastName = lastName
    session.step = 'completado'
    await this.saveSession(phone, session)

    await this.createLead(phone, session)
    await this.sendMessage(
      phone,
      `¡Gracias ${firstName}! Un asesor de Priority Health se pondrá en contacto contigo lo más pronto posible 🎯`,
    )
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  // Returns true for "1/sí/si", false for "2/no", null if unrecognized
  private parseYesNo(text: string): boolean | null {
    const t = text.trim().toLowerCase()
    if (t === '1' || t === 'sí' || t === 'si' || t === 'yes' || t === '1️⃣') return true
    if (t === '2' || t === 'no' || t === '2️⃣') return false
    return null
  }

  private parseName(text: string): { firstName: string; lastName?: string } {
    const parts = text.trim().split(/\s+/)
    const firstName = parts[0]
    const lastName = parts.length > 1 ? parts.slice(1).join(' ') : undefined
    return { firstName, lastName }
  }

  private calcProfileType(sport: boolean, insured: boolean): string {
    if (sport && insured) return 'A'
    if (sport && !insured) return 'B'
    if (!sport && insured) return 'C'
    return 'D'
  }

  // ─── Lead creation ────────────────────────────────────────────────────────────

  private async createLead(phone: string, session: BotSession): Promise<void> {
    if (!session.firstName) return

    const sport = session.sport ?? false
    const insured = session.insured ?? false

    try {
      await this.leadsService.ingestLead({
        firstName: session.firstName,
        lastName: session.lastName,
        phone,
        insuranceType: InsuranceType.SALUD,
        source: LeadSource.WHATSAPP,
        sport,
        insured,
        profileType: this.calcProfileType(sport, insured),
      })
      this.logger.log(`Lead created via WhatsApp bot for ${phone} — profile ${this.calcProfileType(sport, insured)}`)
    } catch (err) {
      this.logger.error(`Failed to create lead for ${phone}`, err)
    }
  }

  // ─── Redis ────────────────────────────────────────────────────────────────────

  private sessionKey(phone: string) {
    return `whatsapp:session:${phone}`
  }

  private async getSession(phone: string): Promise<BotSession | null> {
    try {
      const raw = await this.redis.get(this.sessionKey(phone))
      return raw ? (JSON.parse(raw) as BotSession) : null
    } catch (err) {
      this.logger.error(`Redis GET error for ${phone}`, err)
      return null
    }
  }

  private async saveSession(phone: string, session: BotSession): Promise<void> {
    try {
      await this.redis.set(this.sessionKey(phone), JSON.stringify(session), 'EX', SESSION_TTL_SECONDS)
    } catch (err) {
      this.logger.error(`Redis SET error for ${phone}`, err)
    }
  }

  // ─── WhatsApp send ────────────────────────────────────────────────────────────

  async sendMessage(to: string, body: string): Promise<void> {
    const token = this.config.get('META_WHATSAPP_TOKEN')
    const phoneId = this.config.get('META_WHATSAPP_PHONE_ID')

    if (!token || !phoneId) {
      this.logger.warn('META_WHATSAPP_TOKEN or META_WHATSAPP_PHONE_ID not set — skipping send')
      return
    }

    try {
      const response = await fetch(`https://graph.facebook.com/v19.0/${phoneId}/messages`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to,
          type: 'text',
          text: { body },
        }),
      })

      if (!response.ok) {
        this.logger.error(`WhatsApp send failed: ${await response.text()}`)
      }
    } catch (err) {
      this.logger.error('WhatsApp send error', err)
    }
  }
}
