import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import Anthropic from '@anthropic-ai/sdk'
import { LeadsService } from '../leads/leads.service'
import { ChatMessageDto } from './dto/chat.dto'

const SYSTEM_PROMPT = `Eres el asistente virtual de Priority Asesores de Seguros, un broker de seguros en Quito, Ecuador. Tu nombre es Priority Assistant.

PRODUCTOS QUE OFRECES:
1. SEGUROS DE SALUD:
   - El seguro que te premia (Vitality/Saludsa): te devuelve hasta el 20% de vuelta de lo pagado en tu plan anual, Apple Watch gratis, premios en Juan Valdez y Multicines
   - Seguros para Familia: una póliza para todos, hasta 40% descuento por integrante (Humana), maternidad y pediatría
   - Adulto Mayor +60: enfermedades crónicas, especialistas sin esperas, dental y psicología, cobertura hasta $500.000
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
- Categoría de interés: Vitality | Familia | Adulto Mayor +60 | Individual | Tradicional

Para AUTO:
- Número de cédula
- Placa del vehículo
- Marca y modelo del auto

Además del interés y esos datos específicos, usa el campo "detalles" (texto libre) para anotar CUALQUIER otra información relevante que el cliente comparta durante la conversación y que no tenga un campo propio — por ejemplo: cuántas personas incluiría en una póliza familiar, las edades de los integrantes, presupuesto mensual que menciona, alguna aseguradora de preferencia, condiciones médicas que comente, o cualquier otro dato útil para el asesor que lo va a contactar. Cada vez que dispares capture_lead, incluye en "detalles" un resumen actualizado de TODO lo relevante que sepas hasta ese momento (no solo lo último que dijo).

FORMATO DE RESPUESTA — CRÍTICO:
Tu respuesta completa debe ser ÚNICAMENTE un objeto JSON válido. NUNCA agregues texto conversacional antes o después del JSON, ni lo envuelvas en \`\`\`json ni ningún otro texto. El campo "response" es donde va tu mensaje conversacional para el usuario — todo el saludo, la pregunta, la explicación, va AHÍ DENTRO, no fuera del JSON.

Sin datos de contacto todavía:
{"response": "tu mensaje", "action": null}

En cuanto tengas nombre+correo+celular (aunque no sepas el resto todavía):
{"response": "tu mensaje", "action": "capture_lead", "lead": {"name": "...", "phone": "...", "email": "...", "interest": "No especificado", "cedula": null, "placa": null, "marca_modelo": null, "detalles": null}}

Cuando ya sepas más detalle (dispara de nuevo con todo lo que sepas hasta ahora, incluyendo detalles actualizado):
{"response": "tu mensaje", "action": "capture_lead", "lead": {"name": "...", "phone": "...", "email": "...", "interest": "Familia", "cedula": null, "placa": null, "marca_modelo": null, "detalles": "Póliza familiar para 5 personas. Edades: 10, 15, 20, 25, 50 años."}}

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
    detalles?: string
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

    // No confiamos únicamente en que el modelo marque bien "action": guardamos
    // el lead si el modelo incluyó nombre+teléfono, sin importar qué action puso.
    let leadToSave: { name: string; phone: string; email?: string; interest?: string; cedula?: string; placa?: string; marca_modelo?: string; detalles?: string } | null =
      parsed.lead?.name && parsed.lead?.phone ? parsed.lead : null

    // Red de seguridad: si el modelo no incluyó el lead (le pasó ya dos veces),
    // buscamos nombre+teléfono+correo directamente en los mensajes del usuario por patrón.
    if (!leadToSave) {
      const fallback = this.extractLeadFallback(messages)
      if (fallback) {
        leadToSave = fallback
        this.logger.warn(`session=${sessionId ?? 'sin-session'} el modelo no incluyó lead, usando fallback por regex: ${JSON.stringify(fallback)}`)
      }
    }

    if (leadToSave) {
      try {
        const result = await this.leadsService.upsertLeadFromChat(leadToSave, sessionId)
        this.logger.log(`session=${sessionId ?? 'sin-session'} lead guardado: ${JSON.stringify(result)}`)
      } catch (err) {
        this.logger.error(`Failed to capture lead from chat session ${sessionId}: ${err}`)
      }
    }

    return { response: parsed.response, action: parsed.action }
  }

  /**
   * Red de seguridad independiente del modelo: busca un teléfono ecuatoriano y,
   * si están, correo y nombre, directamente en los mensajes del usuario. Se usa
   * solo cuando el modelo no incluyó el objeto "lead" en su respuesta JSON.
   */
  private extractLeadFallback(messages: ChatMessageDto[]): { name: string; phone: string; email?: string } | null {
    const phoneRe = /(\+?593\d{9}|0\d{9})/
    const emailRe = /[\w.+-]+@[\w-]+\.[a-zA-Z]{2,}/

    for (const m of messages) {
      if (m.role !== 'user') continue
      const phoneMatch = m.content.match(phoneRe)
      if (!phoneMatch) continue
      const emailMatch = m.content.match(emailRe)
      const name = m.content
        .replace(phoneRe, '')
        .replace(emailRe, '')
        .replace(/[,;]/g, ' ')
        .replace(/\s{2,}/g, ' ')
        .trim()
      if (name.length < 2 || name.length > 60) continue
      return { name, phone: phoneMatch[0], email: emailMatch?.[0] }
    }
    return null
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
