import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import Anthropic from '@anthropic-ai/sdk'
import { KbLoader } from './kb.loader'
import { construirSystemPrompt } from './prompt'
import { pareceUnPrecio, RESPUESTA_SIN_PRECIO } from './filtro-precios'

export interface MensajeChat {
  role: 'user' | 'assistant'
  content: string
}

export interface RespuestaHelp {
  respuesta: string
  /** Archivos que se le pasaron al modelo, para mostrar y depurar. */
  fuentes: string[]
}

@Injectable()
export class PriorityHelpService {
  private readonly logger = new Logger(PriorityHelpService.name)
  private readonly anthropic: Anthropic

  constructor(
    private readonly config: ConfigService,
    private readonly kb: KbLoader,
  ) {
    this.anthropic = new Anthropic({
      apiKey: this.config.get<string>('ANTHROPIC_API_KEY'),
    })
  }

  private get modelo(): string {
    return this.config.get<string>('ANTHROPIC_MODEL', 'claude-sonnet-4-6')
  }

  async responder(mensajes: MensajeChat[]): Promise<RespuestaHelp> {
    const ultima = [...mensajes].reverse().find((m) => m.role === 'user')
    const consulta = ultima?.content ?? ''

    // Se buscan documentos usando tambien algo de contexto previo, para que
    // "y con maternidad?" siga apuntando al plan del que se venia hablando.
    const contexto = mensajes
      .slice(-4)
      .map((m) => m.content)
      .join(' ')

    const relevantes = this.kb.buscar(contexto || consulta)

    const documentos = relevantes
      .map((d) => `--- INICIO ${d.archivo} ---\n${d.contenido}\n--- FIN ${d.archivo} ---`)
      .join('\n\n')

    const system = construirSystemPrompt(documentos, this.kb.indice())

    try {
      const res = await this.anthropic.messages.create({
        model: this.modelo,
        max_tokens: 2000,
        system,
        messages: mensajes.map((m) => ({ role: m.role, content: m.content })),
      })

      const texto = res.content
        .filter((b): b is Anthropic.TextBlock => b.type === 'text')
        .map((b) => b.text)
        .join('\n')
        .trim()

      return {
        respuesta: this.revisarPrecios(texto),
        fuentes: relevantes.map((d) => d.archivo),
      }
    } catch (e) {
      this.logger.error('Fallo al consultar el modelo', e as Error)
      return {
        respuesta:
          'No pude procesar la consulta en este momento. Intenta de nuevo en un minuto.',
        fuentes: [],
      }
    }
  }

  private revisarPrecios(texto: string): string {
    if (pareceUnPrecio(texto)) {
      this.logger.warn('Respuesta bloqueada: posible precio en la salida')
      return RESPUESTA_SIN_PRECIO
    }
    return texto
  }
}
