import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import Anthropic from '@anthropic-ai/sdk'
import { LeadsService } from '../leads/leads.service'
import { InsuranceType, LeadSource } from '../leads/dto/ingest-lead.dto'
import { ChatMessageDto } from './dto/chat.dto'

const SYSTEM_PROMPT = `Eres el asistente virtual de Priority Asesores de Seguros, un broker de seguros en Quito, Ecuador. Tu nombre es Priority Assistant.

PRODUCTOS QUE OFRECES:
1. SEGUROS DE SALUD:
   - El seguro que te premia (Vitality/Saludsa): te devuelve hasta 20% del costo anual en efectivo por hacer ejercicio, Apple Watch o Garmin gratis, premios semanales en Juan Valdez y Multicines
   - Seguros para Familia: una póliza cubre a toda la familia, hasta 40% descuento por integrante (Humana), maternidad y pediatría incluidos
   - Adultos Jóvenes +60: cobertura enfermedades crónicas, especialistas sin esperas, dental y psicología incluidos, cobertura hasta $500.000
   - Seguros Individuales: desde $25/mes, libre elección médicos, reembolsos 3-5 días, cobertura internacional opcional
   - Salud Tradicional: BMI, Humana, Ecuasanitas, Bupa — cobertura clásica sin programa de wellness

2. SEGURO DE AUTO: Comparamos entre AIG, Zurich, Atlántida, Sweaden y Latina. Cotización en minutos, respuesta el mismo día.

3. PRÓXIMAMENTE: Hogar, Viajes, Dental, Vida

CONCEPTOS CLAVE:
- Red cerrada: atención en clínicas afiliadas, prima más económica, copagos bajos, ideal para uso frecuente
- Red abierta: libre elección de médicos y hospitales, topes más altos, reembolso en 3-5 días, ideal si prefieres libertad

TU COMPORTAMIENTO:
- Saluda de forma cálida y natural, pregunta qué necesita el cliente
- Haz máximo 1-2 preguntas a la vez, no abrumes
- Explica los productos con lenguaje simple, sin tecnicismos
- Cuando el cliente muestre interés en cotizar, pide su NOMBRE y TELÉFONO
- Una vez que tengas nombre y teléfono, devuelve action: "capture_lead" en tu respuesta JSON interna
- Sé conciso — respuestas de máximo 3-4 líneas
- Habla en español ecuatoriano natural, sin ser robótico
- Si preguntan por precios exactos, di que dependen de edad y coberturas y ofrece cotizar
- No inventes coberturas ni precios específicos que no conoces

CUANDO TENGAS NOMBRE Y TELÉFONO DEL CLIENTE:
Responde con: {"response": "tu mensaje", "action": "capture_lead", "lead": {"name": "...", "phone": "...", "interest": "tipo de seguro mencionado"}}

De lo contrario responde con: {"response": "tu mensaje", "action": null}`

interface ParsedChatReply {
  response: string
  action: 'capture_lead' | 'whatsapp' | null
  lead?: { name: string; phone: string; interest?: string }
}

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name)
  private readonly anthropic: Anthropic

  constructor(
    private readonly config: ConfigService,
    private readonly leadsService: LeadsService,
  ) {
    this.anthropic = new Anthropic({ apiKey: config.get('ANTHROPIC_API_KEY') })
  }

  private get model() {
    return this.config.get('ANTHROPIC_MODEL', 'claude-sonnet-4-6')
  }

  async handleMessage(messages: ChatMessageDto[], sessionId?: string) {
    const completion = await this.anthropic.messages.create({
      model: this.model,
      max_tokens: 500,
      system: SYSTEM_PROMPT,
      messages: messages.map(m => ({ role: m.role, content: m.content })),
    })

    const rawText = completion.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map(block => block.text)
      .join('')

    const parsed = this.parseReply(rawText)

    if (parsed.action === 'capture_lead' && parsed.lead?.name && parsed.lead?.phone) {
      try {
        await this.captureLead(parsed.lead, sessionId)
      } catch (err) {
        this.logger.error(`Failed to capture lead from chat session ${sessionId}: ${err}`)
      }
    }

    return { response: parsed.response, action: parsed.action }
  }

  private parseReply(rawText: string): ParsedChatReply {
    const jsonText = rawText
      .trim()
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/```\s*$/i, '')

    try {
      const parsed = JSON.parse(jsonText)
      const action = parsed.action === 'capture_lead' || parsed.action === 'whatsapp' ? parsed.action : null
      return {
        response: typeof parsed.response === 'string' ? parsed.response : rawText,
        action,
        lead: parsed.lead,
      }
    } catch {
      this.logger.warn(`Chat reply was not valid JSON, falling back to raw text`)
      return { response: rawText, action: null }
    }
  }

  private async captureLead(lead: { name: string; phone: string; interest?: string }, sessionId?: string) {
    const [firstName, ...rest] = lead.name.trim().split(/\s+/)
    const lastName = rest.length ? rest.join(' ') : undefined
    const insuranceType = /auto|carro|veh[ií]culo/i.test(lead.interest ?? '')
      ? InsuranceType.AUTO
      : InsuranceType.SALUD

    const result = await this.leadsService.ingestLead({
      firstName,
      lastName,
      phone: lead.phone,
      insuranceType,
      source: LeadSource.CHAT_WEB,
      notes: [lead.interest, sessionId ? `Sesión de chat: ${sessionId}` : undefined]
        .filter(Boolean)
        .join(' | ') || undefined,
    })

    this.logger.log(`Lead captured from chat widget: ${JSON.stringify(result)}`)
  }
}
