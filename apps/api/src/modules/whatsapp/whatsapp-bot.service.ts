import { Injectable, Logger, Inject } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type Redis from 'ioredis'
import { LeadsService } from '../leads/leads.service'
import { InsuranceType, LeadSource } from '../leads/dto/ingest-lead.dto'

export const WHATSAPP_REDIS = 'WHATSAPP_REDIS'

type BotStep = 'nombre' | 'tipo' | 'ciudad' | 'completado'

interface BotSession {
  step: BotStep
  firstName?: string
  lastName?: string
  city?: string
}

const SESSION_TTL_SECONDS = 86400 // 24 h

// ─── Keyword sets ─────────────────────────────────────────────────────────────

const SALUD_KEYWORDS = ['salud', 'seguro', 'médico', 'medico', 'vitality', 'saludsa', 'plan', 'póliza', 'poliza']

const FAQ: Array<{ keywords: string[]; response: string }> = [
  {
    keywords: ['precio', 'costo', 'cuánto', 'cuanto', 'vale', 'pagar'],
    response:
      'Los planes de SALUDSA Vitality empiezan desde $24/mes. Un asesor te dará una cotización exacta según tu edad y necesidades 📋',
  },
  {
    keywords: ['beneficio', 'cubre', 'cobertura', 'incluye', 'qué tiene', 'que tiene'],
    response:
      'SALUDSA Vitality cubre hospitalización, cirugías, ambulatorio, y además te premia con devolución de hasta 20% de tus cuotas por mantenerte activo 💪',
  },
  {
    keywords: ['vitality', 'punto', 'premio', 'recompensa', 'apple watch', 'garmin', 'ejercicio'],
    response:
      'Con Vitality acumulas puntos por ejercitarte, y puedes ganar desde un café semanal hasta un Apple Watch o Garmin 🏃 Además recibes devolución de hasta 20% al año',
  },
  {
    keywords: ['contacto', 'hablar', 'asesor', 'llamar', 'teléfono', 'telefono', 'agente'],
    response:
      'Un asesor te contactará en menos de 24 horas. ¿Me confirmas tu nombre y ciudad para asignarte el asesor más cercano?',
  },
]

const DEFAULT_RESPONSE =
  'Entiendo tu consulta 😊 Para darte información más específica, un asesor de Priority Health te contactará pronto. ¿Me das tu nombre y ciudad?'

// ─── Service ─────────────────────────────────────────────────────────────────

@Injectable()
export class WhatsappBotService {
  private readonly logger = new Logger(WhatsappBotService.name)

  constructor(
    @Inject(WHATSAPP_REDIS) private readonly redis: Redis,
    private readonly config: ConfigService,
    private readonly leadsService: LeadsService,
  ) {}

  async processMessage(phone: string, text: string): Promise<void> {
    const session = await this.getSession(phone)
    const lower = text.toLowerCase()

    if (!session) {
      await this.handleInicio(phone)
      return
    }

    switch (session.step) {
      case 'nombre':
        await this.handleNombre(phone, session, text, lower)
        break
      case 'tipo':
        await this.handleTipo(phone, session, lower)
        break
      case 'ciudad':
        await this.handleCiudad(phone, session, text)
        break
      case 'completado':
        await this.handleCompletado(phone, lower)
        break
    }
  }

  // ─── Steps ──────────────────────────────────────────────────────────────────

  private async handleInicio(phone: string): Promise<void> {
    await this.saveSession(phone, { step: 'nombre' })
    await this.sendMessage(
      phone,
      'Hola! Soy el asistente de Priority Health 👋 Te ayudo con información sobre SALUDSA Vitality.\n\nPara darte la mejor atención, ¿me puedes decir tu nombre completo?',
    )
  }

  private async handleNombre(
    phone: string,
    session: BotSession,
    text: string,
    lower: string,
  ): Promise<void> {
    // If input looks like a question, answer FAQ and re-ask for name
    const faq = this.matchFAQ(lower)
    if (faq && lower.includes('?')) {
      await this.sendMessage(phone, faq + '\n\n¿Me podrías decir tu nombre completo para darte una mejor atención?')
      return
    }

    const { firstName, lastName } = this.parseName(text)
    session.firstName = firstName
    session.lastName = lastName
    session.step = 'tipo'
    await this.saveSession(phone, session)

    await this.sendMessage(
      phone,
      `Mucho gusto ${firstName}! ¿Te interesa un seguro de SALUD o tienes otra consulta?`,
    )
  }

  private async handleTipo(phone: string, session: BotSession, lower: string): Promise<void> {
    if (this.containsAny(lower, SALUD_KEYWORDS)) {
      session.step = 'ciudad'
      await this.saveSession(phone, session)
      await this.sendMessage(
        phone,
        '¡Perfecto! SALUDSA Vitality es el seguro que te premia por estar sano 💚\n\nTiene 4 niveles:\n• Bronze — 5% devolución\n• Silver — 10%\n• Gold — 15%\n• Platinum — 20%\n\n¿En qué ciudad estás?',
      )
      return
    }

    const faq = this.matchFAQ(lower)
    await this.sendMessage(phone, faq ?? DEFAULT_RESPONSE)
    // Stay in 'tipo' step waiting for a clearer intent
  }

  private async handleCiudad(phone: string, session: BotSession, text: string): Promise<void> {
    session.city = text.trim()
    session.step = 'completado'
    await this.saveSession(phone, session)

    await this.sendMessage(
      phone,
      `¡Listo! Un asesor de Priority Health en ${session.city} te contactará pronto con una cotización personalizada 🎯`,
    )

    await this.createLead(phone, session)
  }

  private async handleCompletado(phone: string, lower: string): Promise<void> {
    const faq = this.matchFAQ(lower)
    await this.sendMessage(
      phone,
      faq ?? '¡Ya tenemos tus datos! Un asesor de Priority Health te contactará pronto. 🎯',
    )
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  private parseName(text: string): { firstName: string; lastName?: string } {
    const parts = text.trim().split(/\s+/)
    const firstName = parts[0]
    const lastName = parts.length > 1 ? parts.slice(1).join(' ') : undefined
    return { firstName, lastName }
  }

  private containsAny(lower: string, keywords: string[]): boolean {
    return keywords.some((kw) => lower.includes(kw))
  }

  private matchFAQ(lower: string): string | null {
    const match = FAQ.find((entry) => this.containsAny(lower, entry.keywords))
    return match?.response ?? null
  }

  // ─── Lead creation ────────────────────────────────────────────────────────────

  private async createLead(phone: string, session: BotSession): Promise<void> {
    if (!session.firstName) return

    try {
      await this.leadsService.ingestLead({
        firstName: session.firstName,
        lastName: session.lastName,
        phone,
        insuranceType: InsuranceType.SALUD,
        source: LeadSource.WHATSAPP,
      })
      this.logger.log(`Lead created via WhatsApp bot for ${phone}`)
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
