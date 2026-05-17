import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import Anthropic from '@anthropic-ai/sdk'
import { LeadsService } from '../leads/leads.service'
import { InsuranceType, LeadSource } from '../leads/dto/ingest-lead.dto'

type BotStep = 'asking_name' | 'asking_insurance' | 'asking_city' | 'completed'

interface BotSession {
  step: BotStep
  firstName?: string
  lastName?: string
  insuranceType?: InsuranceType
  city?: string
  history: Array<{ role: 'user' | 'assistant'; content: string }>
}

@Injectable()
export class WhatsappBotService {
  private readonly logger = new Logger(WhatsappBotService.name)
  private readonly sessions = new Map<string, BotSession>()
  private readonly anthropic: Anthropic

  constructor(
    private readonly config: ConfigService,
    private readonly leadsService: LeadsService,
  ) {
    this.anthropic = new Anthropic({ apiKey: config.get('ANTHROPIC_API_KEY') })
  }

  async processMessage(phone: string, text: string): Promise<void> {
    let session = this.sessions.get(phone)

    if (!session) {
      await this.startConversation(phone)
      return
    }

    session.history.push({ role: 'user', content: text })

    switch (session.step) {
      case 'asking_name':
        await this.handleNameStep(phone, session)
        break
      case 'asking_insurance':
        await this.handleInsuranceStep(phone, session)
        break
      case 'asking_city':
        await this.handleCityStep(phone, session)
        break
      case 'completed':
        await this.sendMessage(
          phone,
          '¡Un asesor de Priority ya tiene tus datos y te contactará muy pronto! 🎯',
        )
        break
    }
  }

  private async startConversation(phone: string): Promise<void> {
    const greeting =
      'Hola! Soy el asistente de Priority Health 👋 ¿En qué puedo ayudarte hoy?\n\nPara comenzar, ¿me podrías decir tu nombre completo?'

    this.sessions.set(phone, {
      step: 'asking_name',
      history: [{ role: 'assistant', content: greeting }],
    })

    await this.sendMessage(phone, greeting)
  }

  private async handleNameStep(phone: string, session: BotSession): Promise<void> {
    const result = await this.askClaude<{ response: string; firstName: string; lastName: string | null }>(
      session.history,
      `El usuario está respondiendo con su nombre. Extrae el primer nombre y apellido.
Responde de forma amigable confirmando el nombre y pregunta qué tipo de seguro le interesa: SALUD (seguro médico) o AUTO (seguro de auto).
Devuelve SOLO JSON válido con esta estructura exacta:
{ "response": "tu mensaje aquí", "firstName": "nombre", "lastName": "apellido o null si no dio" }`,
    )

    if (result?.firstName) {
      session.firstName = result.firstName
      session.lastName = result.lastName ?? undefined
      session.step = 'asking_insurance'
    }

    const msg = result?.response ?? '¿Me puedes decir tu nombre, por favor?'
    session.history.push({ role: 'assistant', content: msg })
    await this.sendMessage(phone, msg)
  }

  private async handleInsuranceStep(phone: string, session: BotSession): Promise<void> {
    const result = await this.askClaude<{ response: string; insuranceType: 'SALUD' | 'AUTO' | null }>(
      session.history,
      `El usuario está indicando qué tipo de seguro le interesa.
Detecta si mencionó SALUD (salud, médico, health, médica) o AUTO (auto, carro, coche, vehiculo, car).
Si no quedó claro, pide que aclare entre SALUD o AUTO.
Si sí quedó claro, confirma la elección y pregunta en qué ciudad vive.
Devuelve SOLO JSON válido:
{ "response": "tu mensaje aquí", "insuranceType": "SALUD" | "AUTO" | null }`,
    )

    if (result?.insuranceType) {
      session.insuranceType = result.insuranceType as InsuranceType
      session.step = 'asking_city'
    }

    const msg = result?.response ?? '¿Te interesa seguro de SALUD o AUTO?'
    session.history.push({ role: 'assistant', content: msg })
    await this.sendMessage(phone, msg)
  }

  private async handleCityStep(phone: string, session: BotSession): Promise<void> {
    const result = await this.askClaude<{ response: string; city: string | null }>(
      session.history,
      `El usuario está indicando su ciudad.
Extrae el nombre de la ciudad que mencionó.
Si no quedó claro, pide que indique su ciudad.
Si sí quedó claro, genera un mensaje de cierre cálido diciendo que un asesor de Priority lo contactará pronto.
Devuelve SOLO JSON válido:
{ "response": "tu mensaje de cierre aquí", "city": "nombre de ciudad o null" }`,
    )

    const msg = result?.response ?? '¡Gracias! Un asesor de Priority te contactará pronto 🎯'
    session.history.push({ role: 'assistant', content: msg })
    await this.sendMessage(phone, msg)

    if (result?.city) {
      session.city = result.city
      session.step = 'completed'
      await this.createLead(phone, session)
    }
  }

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
      this.logger.log(`Lead created from WhatsApp bot for ${phone}`)
    } catch (err) {
      this.logger.error(`Failed to create lead for ${phone}`, err)
    }
  }

  private async askClaude<T>(
    history: Array<{ role: 'user' | 'assistant'; content: string }>,
    instruction: string,
  ): Promise<T | null> {
    try {
      const { content } = await this.anthropic.messages.create({
        model: this.config.get('ANTHROPIC_MODEL', 'claude-sonnet-4-6'),
        max_tokens: 400,
        system: `Eres el asistente virtual de Priority Health, una empresa de seguros en México.
Tu objetivo es calificar prospectos de forma amigable y natural.
Habla siempre en español, sé cálido y profesional.
IMPORTANTE: Solo responde con JSON válido, sin texto adicional antes o después.`,
        messages: history.map((m) => ({ role: m.role, content: m.content })).concat([
          { role: 'user', content: instruction },
        ]),
      })

      const raw = (content[0] as { text: string }).text.trim()
      const jsonMatch = raw.match(/\{[\s\S]*\}/)
      if (!jsonMatch) return null
      return JSON.parse(jsonMatch[0]) as T
    } catch (err) {
      this.logger.error('Claude call failed', err)
      return null
    }
  }

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
