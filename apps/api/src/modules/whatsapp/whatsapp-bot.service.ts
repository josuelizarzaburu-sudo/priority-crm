import { Injectable, Logger, Inject } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import Anthropic from '@anthropic-ai/sdk'
import type Redis from 'ioredis'
import { LeadsService } from '../leads/leads.service'
import { InsuranceType, LeadSource } from '../leads/dto/ingest-lead.dto'

export const WHATSAPP_REDIS = 'WHATSAPP_REDIS'

type BotStep = 'nombre' | 'seguro' | 'ciudad' | 'completado'

interface BotSession {
  step: BotStep
  firstName?: string
  lastName?: string
  insuranceType?: InsuranceType
  city?: string
}

const SESSION_TTL_SECONDS = 86400 // 24 h

@Injectable()
export class WhatsappBotService {
  private readonly logger = new Logger(WhatsappBotService.name)
  private readonly anthropic: Anthropic

  constructor(
    @Inject(WHATSAPP_REDIS) private readonly redis: Redis,
    private readonly config: ConfigService,
    private readonly leadsService: LeadsService,
  ) {
    this.anthropic = new Anthropic({ apiKey: config.get('ANTHROPIC_API_KEY') })
  }

  // ─── Public entry point ───────────────────────────────────────────────────

  async processMessage(phone: string, text: string): Promise<void> {
    const session = await this.getSession(phone)

    if (!session) {
      await this.handleInicio(phone)
      return
    }

    switch (session.step) {
      case 'nombre':
        await this.handleNombre(phone, session, text)
        break
      case 'seguro':
        await this.handleSeguro(phone, session, text)
        break
      case 'ciudad':
        await this.handleCiudad(phone, session, text)
        break
      case 'completado':
        await this.sendMessage(phone, '¡Ya tenemos tus datos! Un asesor de Priority te contactará pronto. 🎯')
        break
    }
  }

  // ─── Steps ────────────────────────────────────────────────────────────────

  private async handleInicio(phone: string): Promise<void> {
    await this.saveSession(phone, { step: 'nombre' })
    await this.sendMessage(
      phone,
      'Hola! Soy el asistente de Priority Health 👋\n\n¿Me podrías decir tu nombre completo?',
    )
  }

  private async handleNombre(phone: string, session: BotSession, text: string): Promise<void> {
    const result = await this.askClaude<{ response: string; firstName: string; lastName: string | null }>(
      `El usuario respondió con su nombre. Mensaje: "${text}"
Extrae el primer nombre y apellido.
Si no quedó claro, pide que repita su nombre.
Si sí quedó claro, confirma el nombre y pregunta qué tipo de seguro le interesa: SALUD (seguro médico) o AUTO (seguro de automóvil).
Devuelve SOLO JSON: { "response": "...", "firstName": "...", "lastName": "... o null" }`,
    )

    if (result?.firstName) {
      session.firstName = result.firstName
      session.lastName = result.lastName ?? undefined
      session.step = 'seguro'
      await this.saveSession(phone, session)
    }

    await this.sendMessage(phone, result?.response ?? '¿Me puedes decir tu nombre, por favor?')
  }

  private async handleSeguro(phone: string, session: BotSession, text: string): Promise<void> {
    const result = await this.askClaude<{ response: string; insuranceType: 'SALUD' | 'AUTO' | null }>(
      `El usuario${session.firstName ? ` (${session.firstName})` : ''} indicó qué tipo de seguro quiere. Mensaje: "${text}"
Detecta si dijo SALUD (salud, médico, médica, health) o AUTO (auto, carro, coche, vehículo).
Si no quedó claro, pide que elija entre SALUD o AUTO.
Si sí quedó claro, confirma y pregunta en qué ciudad vive.
Devuelve SOLO JSON: { "response": "...", "insuranceType": "SALUD" | "AUTO" | null }`,
    )

    if (result?.insuranceType) {
      session.insuranceType = result.insuranceType as InsuranceType
      session.step = 'ciudad'
      await this.saveSession(phone, session)
    }

    await this.sendMessage(phone, result?.response ?? '¿Te interesa seguro de SALUD o AUTO?')
  }

  private async handleCiudad(phone: string, session: BotSession, text: string): Promise<void> {
    const result = await this.askClaude<{ response: string; city: string | null }>(
      `El usuario indicó su ciudad. Mensaje: "${text}"
Extrae el nombre de la ciudad.
Si no quedó claro, pide que indique su ciudad.
Si sí quedó claro, genera un mensaje de cierre cálido: confirma que un asesor de Priority lo contactará pronto.
Devuelve SOLO JSON: { "response": "...", "city": "... o null" }`,
    )

    await this.sendMessage(phone, result?.response ?? '¡Gracias! Un asesor de Priority te contactará pronto 🎯')

    if (result?.city) {
      session.city = result.city
      session.step = 'completado'
      await this.saveSession(phone, session)
      await this.createLead(phone, session)
    }
  }

  // ─── Redis helpers ────────────────────────────────────────────────────────

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

  // ─── Lead creation ────────────────────────────────────────────────────────

  private async createLead(phone: string, session: BotSession): Promise<void> {
    if (!session.firstName || !session.insuranceType) return

    try {
      await this.leadsService.ingestLead({
        firstName: session.firstName,
        lastName: session.lastName,
        phone,
        insuranceType: session.insuranceType,
        source: LeadSource.WHATSAPP,
      })
      this.logger.log(`Lead created via WhatsApp bot for ${phone}`)
    } catch (err) {
      this.logger.error(`Failed to create lead for ${phone}`, err)
    }
  }

  // ─── Claude helper ────────────────────────────────────────────────────────

  private async askClaude<T>(instruction: string): Promise<T | null> {
    try {
      const { content } = await this.anthropic.messages.create({
        model: this.config.get('ANTHROPIC_MODEL', 'claude-sonnet-4-6'),
        max_tokens: 300,
        system: `Eres el asistente virtual de Priority Health, aseguradora mexicana.
Califica prospectos de forma amigable y natural. Habla siempre en español.
Responde ÚNICAMENTE con JSON válido, sin texto adicional.`,
        messages: [{ role: 'user', content: instruction }],
      })

      const raw = (content[0] as { text: string }).text.trim()
      const match = raw.match(/\{[\s\S]*\}/)
      return match ? (JSON.parse(match[0]) as T) : null
    } catch (err) {
      this.logger.error('Claude call failed', err)
      return null
    }
  }

  // ─── WhatsApp send ────────────────────────────────────────────────────────

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
