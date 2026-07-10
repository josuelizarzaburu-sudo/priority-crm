import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import Anthropic from '@anthropic-ai/sdk'
import { LeadsService } from '../leads/leads.service'
import { InsuranceType, LeadSource } from '../leads/dto/ingest-lead.dto'
import { ChatMessageDto } from './dto/chat.dto'

const SYSTEM_PROMPT = `Eres el asistente virtual de Priority Asesores de Seguros, un broker de seguros en Quito, Ecuador. Tu nombre es Priority Assistant.

PRODUCTOS QUE OFRECES:
1. SEGUROS DE SALUD:
   - El seguro que te premia (Vitality/Saludsa): hasta 20% reembolso, Apple Watch gratis, premios en Juan Valdez y Multicines
   - Seguros para Familia: una póliza para todos, hasta 40% descuento por integrante (Humana), maternidad y pediatría
   - Adultos Jóvenes +60: enfermedades crónicas, especialistas sin esperas, dental y psicología, cobertura hasta $500.000
   - Seguros Individuales: desde $25/mes, libre elección médicos, reembolsos 3-5 días, cobertura internacional
   - Salud Tradicional: BMI, Humana, Ecuasanitas, Bupa

2. SEGURO DE AUTO: Comparamos AIG, Zurich, Atlántida, Sweaden y Latina. Para cotizar necesitas: cédula, celular, placa del vehículo, marca y modelo.

3. PRÓXIMAMENTE: Hogar, Viajes, Dental, Vida

CONCEPTOS CLAVE:
- Red cerrada: clínicas afiliadas, prima económica, copagos bajos
- Red abierta: libre elección, topes más altos, reembolso 3-5 días

TU COMPORTAMIENTO:
- Saluda cálidamente y pregunta qué necesita
- Máximo 1-2 preguntas a la vez
- Lenguaje simple, español ecuatoriano natural
- Sé conciso — máximo 3-4 líneas por respuesta

DATOS A RECOPILAR SEGÚN TIPO:

Para SALUD (cualquier categoría):
- Nombre completo
- Número de celular
- Categoría de interés: Vitality | Familia | Adultos +60 | Individual | Tradicional

Para AUTO:
- Nombre completo
- Número de cédula
- Número de celular
- Placa del vehículo
- Marca y modelo del auto

Cuando tengas nombre y teléfono del cliente, crea el lead INMEDIATAMENTE — no esperes más confirmaciones. El interés se puede especificar con lo que ya sabes de la conversación.

FORMATO DE RESPUESTA — CRÍTICO:
Tu respuesta completa debe ser ÚNICAMENTE un objeto JSON válido. NUNCA agregues texto conversacional antes o después del JSON, ni lo envuelvas en \`\`\`json ni ningún otro texto. El campo "response" es donde va tu mensaje conversacional para el usuario — todo el saludo, la pregunta, la explicación, va AHÍ DENTRO, no fuera del JSON.

Sin lead listo:
{"response": "tu mensaje", "action": null}

Con lead de SALUD listo:
{"response": "tu mensaje", "action": "capture_lead", "lead": {"name": "...", "phone": "...", "interest": "SALUD - Familia | Vitality | Adultos +60 | Individual | Tradicional", "cedula": null, "placa": null, "marca_modelo": null}}

Con lead de AUTO listo:
{"response": "tu mensaje", "action": "capture_lead", "lead": {"name": "...", "phone": "...", "interest": "AUTO", "cedula": "...", "placa": "...", "marca_modelo": "..."}}

Si el cliente quiere continuar por WhatsApp:
{"response": "tu mensaje", "action": "whatsapp"}`

interface ParsedChatReply {
  response: string
  action: 'capture_lead' | 'whatsapp' | null
  lead?: {
    name: string
    phone: string
    interest?: string
    cedula?: string
    placa?: string
    marca_modelo?: string
  }
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
    const cleaned = rawText.trim()
    // Busca el objeto JSON dentro del texto (aunque el modelo agregue texto o ```fences``` alrededor)
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
    const jsonText = jsonMatch ? jsonMatch[0] : cleaned

    try {
      const parsed = JSON.parse(jsonText)
      const action = parsed.action === 'capture_lead' || parsed.action === 'whatsapp' ? parsed.action : null
      return {
        response: typeof parsed.response === 'string' ? parsed.response : cleaned,
        action,
        lead: parsed.lead,
      }
    } catch {
      this.logger.warn(`Chat reply was not valid JSON, falling back to raw text`)
      return { response: cleaned, action: null }
    }
  }

  private async captureLead(
    lead: { name: string; phone: string; interest?: string; cedula?: string; placa?: string; marca_modelo?: string },
    sessionId?: string,
  ) {
    const [firstName, ...rest] = lead.name.trim().split(/\s+/)
    const lastName = rest.length ? rest.join(' ') : undefined

    const isAuto = /auto/i.test(lead.interest ?? '')
    const insuranceType = isAuto ? InsuranceType.AUTO : InsuranceType.SALUD

    const notesParts = [
      lead.interest,
      lead.cedula ? `Cédula: ${lead.cedula}` : null,
      lead.placa ? `Placa: ${lead.placa}` : null,
      lead.marca_modelo ? `Vehículo: ${lead.marca_modelo}` : null,
      sessionId ? `Sesión: ${sessionId}` : null,
    ].filter(Boolean)

    const autoData = isAuto ? {
      placa: lead.placa ?? undefined,
      marca: lead.marca_modelo?.split(' ')[0] ?? undefined,
      modelo: lead.marca_modelo?.split(' ').slice(1).join(' ') ?? undefined,
      cedulaRuc: lead.cedula ?? undefined,
      nombrePropietario: lead.name,
    } : undefined

    const result = await this.leadsService.ingestLead({
      firstName,
      lastName,
      phone: lead.phone,
      insuranceType,
      source: LeadSource.CHAT_WEB,
      notes: notesParts.join(' | ') || undefined,
      autoData,
    })

    this.logger.log(`Lead captured from chat: ${JSON.stringify(result)}`)
  }
}
