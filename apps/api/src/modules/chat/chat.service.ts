import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import Anthropic from '@anthropic-ai/sdk'
import { LeadsService } from '../leads/leads.service'
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
- Saluda cálidamente y en tu segunda respuesta como máximo, ya debes estar pidiendo nombre, correo y celular — no expliques todos los productos en detalle antes de pedir estos datos, una mención breve (1-2 líneas) basta para que el cliente sepa que puedes ayudarlo con lo que busca.
- Prioridad #1: conseguir nombre + correo + celular lo antes posible en la conversación. Con eso YA puedes crear el lead, aunque todavía no sepas el detalle exacto de qué seguro quiere — usa "No especificado" si aún no lo sabes.
- Máximo 1-2 preguntas a la vez
- Lenguaje simple, español ecuatoriano natural
- Sé conciso — máximo 3-4 líneas por respuesta
- Una vez tengas nombre+celular, dispara capture_lead de inmediato con lo que sepas (correo si te lo dio, interés si lo sabes).
- REGLA CRÍTICA E INCONDICIONAL: desde el momento en que sepas el nombre Y el celular del cliente, TODAS tus respuestas siguientes en la conversación —sin excepción— deben incluir "action": "capture_lead" con el objeto "lead" completo (repite los mismos datos de antes si no hay nada nuevo, y agrega lo nuevo que vayas sabiendo). Esto aplica incluso si tu respuesta es solo una pregunta de seguimiento como "¿es para ti o para tu familia?" — igual mandas capture_lead en esa misma respuesta. No es una decisión que tomas cada vez ("¿hay algo nuevo que guardar?"), es un estado fijo: una vez que tienes nombre+celular, NUNCA MÁS respondes con action:null en el resto de la conversación.

DATOS A RECOPILAR — en este orden de prioridad:

Primero, para CUALQUIER tipo de seguro:
- Nombre completo
- Correo electrónico
- Número de celular
(con estos 3 ya disparas capture_lead, no esperes a saber más)

Después, según vayas conversando, completa lo que puedas:

Para SALUD:
- Categoría de interés: Vitality | Familia | Adultos +60 | Individual | Tradicional

Para AUTO:
- Número de cédula
- Placa del vehículo
- Marca y modelo del auto

FORMATO DE RESPUESTA — CRÍTICO:
Tu respuesta completa debe ser ÚNICAMENTE un objeto JSON válido. NUNCA agregues texto conversacional antes o después del JSON, ni lo envuelvas en \`\`\`json ni ningún otro texto. El campo "response" es donde va tu mensaje conversacional para el usuario — todo el saludo, la pregunta, la explicación, va AHÍ DENTRO, no fuera del JSON.

Sin datos de contacto todavía:
{"response": "tu mensaje", "action": null}

En cuanto tengas nombre+correo+celular (aunque no sepas el resto todavía):
{"response": "tu mensaje", "action": "capture_lead", "lead": {"name": "...", "phone": "...", "email": "...", "interest": "No especificado", "cedula": null, "placa": null, "marca_modelo": null}}

Cuando ya sepas más detalle (dispara de nuevo con todo lo que sepas hasta ahora):
{"response": "tu mensaje", "action": "capture_lead", "lead": {"name": "...", "phone": "...", "email": "...", "interest": "AUTO", "cedula": "...", "placa": "...", "marca_modelo": "..."}}

Si el cliente quiere continuar por WhatsApp:
{"response": "tu mensaje", "action": "whatsapp"}`

interface ParsedChatReply {
  response: string
  action: 'capture_lead' | 'whatsapp' | null
  lead?: {
    name: string
    phone: string
    email?: string
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
    this.logger.log(`session=${sessionId ?? 'sin-session'} action=${parsed.action} lead=${parsed.lead ? JSON.stringify(parsed.lead) : 'null'}`)

    if (parsed.action === 'capture_lead' && parsed.lead?.name && parsed.lead?.phone) {
      try {
        const result = await this.leadsService.upsertLeadFromChat(parsed.lead, sessionId)
        this.logger.log(`session=${sessionId ?? 'sin-session'} lead guardado: ${JSON.stringify(result)}`)
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

}
