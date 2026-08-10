import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import Anthropic from '@anthropic-ai/sdk'
import { PrismaService } from '../../prisma/prisma.service'
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
    private readonly prisma: PrismaService,
  ) {
    this.anthropic = new Anthropic({
      apiKey: this.config.get<string>('ANTHROPIC_API_KEY'),
    })
  }

  private get modelo(): string {
    return this.config.get<string>('ANTHROPIC_MODEL', 'claude-sonnet-4-6')
  }

  async responder(
    mensajes: MensajeChat[],
    userId?: string,
  ): Promise<RespuestaHelp> {
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

      const filtroPrecio = pareceUnPrecio(texto)
      const respuesta = filtroPrecio ? RESPUESTA_SIN_PRECIO : texto
      const fuentes = relevantes.map((d) => d.archivo)

      await this.registrar({
        userId,
        pregunta: consulta,
        respuesta,
        fuentes,
        sinRespuesta: admitioNoSaber(respuesta),
        filtroPrecio,
      })

      return { respuesta, fuentes }
    } catch (e) {
      this.logger.error('Fallo al consultar el modelo', e as Error)
      return {
        respuesta:
          'No pude procesar la consulta en este momento. Intenta de nuevo en un minuto.',
        fuentes: [],
      }
    }
  }

  /**
   * Consultas donde el bot admitio no tener el dato.
   *
   * Es la lista de trabajo: cada una senala material que falta subir. Sirve
   * para decidir que documento conseguir de la aseguradora, en vez de
   * adivinar donde estan los huecos.
   */
  async huecos(dias = 30) {
    const desde = new Date()
    desde.setDate(desde.getDate() - dias)

    try {
      return await (this.prisma as any).priorityHelpConsulta.findMany({
        where: { sinRespuesta: true, createdAt: { gte: desde } },
        orderBy: { createdAt: 'desc' },
        take: 200,
        select: {
          id: true,
          pregunta: true,
          fuentes: true,
          createdAt: true,
          user: { select: { name: true } },
        },
      })
    } catch (e) {
      this.logger.warn(`No se pudieron leer los huecos: ${(e as Error).message}`)
      return []
    }
  }

  /**
   * Guarda la consulta para saber que pregunta el equipo.
   *
   * Nunca tumba la respuesta: si falla el guardado, el asesor igual recibe
   * lo que pidio. El historial es para mejorar el bot, no un requisito
   * para que funcione.
   */
  private async registrar(datos: {
    userId?: string
    pregunta: string
    respuesta: string
    fuentes: string[]
    sinRespuesta: boolean
    filtroPrecio: boolean
  }) {
    if (!datos.userId) return
    try {
      await (this.prisma as any).priorityHelpConsulta.create({
        data: {
          userId: datos.userId,
          pregunta: datos.pregunta,
          respuesta: datos.respuesta,
          fuentes: datos.fuentes,
          sinRespuesta: datos.sinRespuesta,
          filtroPrecio: datos.filtroPrecio,
        },
      })
    } catch (e) {
      this.logger.warn(`No se pudo guardar la consulta: ${(e as Error).message}`)
    }
  }
}

/**
 * Detecta que el bot admitio no tener el dato.
 *
 * Estas son las consultas mas valiosas del historial: cada una senala un
 * documento que falta subir. Es deteccion por frases, asi que puede fallar
 * en algun caso; sirve para priorizar, no como conteo exacto.
 */
function admitioNoSaber(respuesta: string): boolean {
  const señales = [
    /no lo tengo/i,
    /no tengo (ese|esa|el|la|información|informacion|ese dato)/i,
    /confírmalo con la aseguradora/i,
    /confirmalo con la aseguradora/i,
    /no (esta|está) en (el|los) (material|documento)/i,
    /no aparece en (el|los|mis) documento/i,
  ]
  return señales.some((r) => r.test(respuesta))
}
