import { Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'

/**
 * Avisos dentro del CRM: lo que muestra la campanita.
 *
 * Separado del correo a propósito. El correo sirve cuando la persona no está en
 * el CRM; esto sirve cuando sí está, y no obliga a salir a revisar la bandeja
 * para enterarse de algo que pasó aquí dentro.
 */
@Injectable()
export class NotificacionesService {
  private readonly logger = new Logger(NotificacionesService.name)

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Crea un aviso para una persona.
   *
   * Nunca lanza: un aviso que falla no debe tumbar la acción que lo originó. Si
   * no se pudo avisar de una tarea, la tarea igual se creó, que es lo que
   * importa.
   */
  async crear(datos: {
    usuarioId: string
    organizationId: string
    tipo: string
    titulo: string
    detalle?: string | null
    enlace?: string | null
    /** Quien lo provoca. Si es la misma persona, no se avisa. */
    provocadoPor?: string | null
  }) {
    // Nadie necesita que le avisen de lo que acaba de hacer.
    if (datos.provocadoPor && datos.provocadoPor === datos.usuarioId) return null

    try {
      return await this.prisma.notificacion.create({
        data: {
          usuarioId: datos.usuarioId,
          organizationId: datos.organizationId,
          tipo: datos.tipo,
          titulo: datos.titulo,
          detalle: datos.detalle ?? null,
          enlace: datos.enlace ?? null,
        },
      })
    } catch (e) {
      this.logger.error(`[notificaciones] no se pudo crear: ${e}`)
      return null
    }
  }

  /** Avisa a varias personas de lo mismo, sin repetir a quien lo provocó. */
  async crearParaVarios(
    usuarioIds: (string | null | undefined)[],
    datos: Omit<Parameters<NotificacionesService['crear']>[0], 'usuarioId'>,
  ) {
    const unicos = [...new Set(usuarioIds.filter((id): id is string => !!id))]
    await Promise.all(unicos.map((usuarioId) => this.crear({ ...datos, usuarioId })))
  }

  /** Los avisos de una persona, primero los no leídos. */
  async listar(usuarioId: string, soloNoLeidas = false) {
    const avisos = await this.prisma.notificacion.findMany({
      where: { usuarioId, ...(soloNoLeidas ? { leida: false } : {}) },
      orderBy: [{ leida: 'asc' }, { createdAt: 'desc' }],
      // Con un tope: la campanita es para lo reciente, no un archivo histórico.
      take: 40,
    })
    const noLeidas = await this.prisma.notificacion.count({
      where: { usuarioId, leida: false },
    })
    return { avisos, noLeidas }
  }

  async marcarLeida(id: string, usuarioId: string) {
    // El usuarioId va en el where: nadie puede marcar como leído el aviso de
    // otra persona.
    await this.prisma.notificacion.updateMany({
      where: { id, usuarioId },
      data: { leida: true },
    })
    return { ok: true }
  }

  async marcarTodasLeidas(usuarioId: string) {
    const r = await this.prisma.notificacion.updateMany({
      where: { usuarioId, leida: false },
      data: { leida: true },
    })
    return { marcadas: r.count }
  }
}
