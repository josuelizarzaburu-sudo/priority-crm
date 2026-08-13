import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'

/**
 * Quien ve las tareas de TODO el equipo.
 *
 * Yessenia como jefa de operaciones necesita saber que tiene pendiente cada
 * ejecutiva para repartir el trabajo. Gerencia tambien, porque son quienes piden
 * las cosas.
 */
const VE_TODAS = ['SUPER_ADMIN', 'OWNER', 'MANAGER', 'JEFE_OPERACIONES']

/**
 * Quien puede asignarle una tarea a OTRA persona.
 *
 * Una ejecutiva puede anotarse tareas a si misma, pero no encargarle trabajo a
 * una companera: eso lo decide quien coordina. Sin este limite, la lista de
 * cualquiera podria llenarse de encargos que nadie superviso.
 */
const PUEDE_ASIGNAR_A_OTROS = ['SUPER_ADMIN', 'OWNER', 'MANAGER', 'JEFE_OPERACIONES']

@Injectable()
export class TareasService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Filtro segun quien consulta.
   *
   * Quien no ve todas ve dos cosas: las que le asignaron y las que ella pidio.
   * Lo segundo importa por el flujo en cascada: si Roxana pide algo y Yessenia
   * se lo pasa a Carolina, Roxana tiene que seguir viendo su pedido para saber
   * si se cumplio. Si solo viera lo asignado a ella, su pedido desapareceria.
   */
  private alcance(userId: string, role: string) {
    if (VE_TODAS.includes(role)) return {}
    return { OR: [{ asignadoId: userId }, { solicitanteId: userId }] }
  }

  async findAll(
    organizationId: string,
    userId: string,
    role: string,
    query: { asignadoId?: string; incluirCompletadas?: string },
  ) {
    // Las condiciones se acumulan en AND para que no se pisen entre si. Con
    // varios OR sueltos en el mismo nivel, el ultimo gana y se podrian filtrar
    // mal las tareas de otras personas.
    const condiciones: any[] = []

    const alcance = this.alcance(userId, role)
    if (alcance.OR) condiciones.push({ OR: alcance.OR })

    // Filtrar por persona solo tiene sentido para quien ve todas.
    if (query.asignadoId && VE_TODAS.includes(role)) {
      condiciones.push({ asignadoId: query.asignadoId })
    }

    // Por defecto se ocultan las completadas de dias anteriores: la lista es
    // para trabajar, no un historico. Las de hoy si se quedan a la vista, para
    // que se note lo que ya se avanzo.
    if (query.incluirCompletadas !== 'true') {
      const hoy = new Date()
      hoy.setHours(0, 0, 0, 0)
      condiciones.push({ OR: [{ completadaEn: null }, { completadaEn: { gte: hoy } }] })
    }

    const where: any = { organizationId, ...(condiciones.length ? { AND: condiciones } : {}) }

    return this.prisma.tarea.findMany({
      where,
      orderBy: [
        { completadaEn: 'asc' }, // pendientes primero
        { fechaLimite: 'asc' }, // luego lo mas urgente
        { prioridad: 'asc' }, // ALTA antes que MEDIA y BAJA
        { createdAt: 'desc' },
      ],
      include: {
        asignado: { select: { id: true, name: true } },
        solicitante: { select: { id: true, name: true } },
        cliente: { select: { id: true, nombres: true, apellidos: true } },
      },
    })
  }

  async create(
    dto: {
      titulo: string
      detalle?: string
      prioridad?: string
      fechaLimite?: string
      asignadoId?: string
      clienteId?: string
    },
    organizationId: string,
    userId: string,
    role: string,
  ) {
    const titulo = dto.titulo?.trim()
    if (!titulo) throw new BadRequestException('La tarea necesita un título')

    // Sin destinatario explicito, la tarea es para uno mismo.
    let asignadoId = dto.asignadoId || userId

    if (asignadoId !== userId && !PUEDE_ASIGNAR_A_OTROS.includes(role)) {
      throw new ForbiddenException('No puedes asignarle tareas a otra persona')
    }

    if (asignadoId !== userId) {
      const destino = await this.prisma.user.findFirst({
        where: { id: asignadoId, organizationId },
        select: { id: true },
      })
      if (!destino) throw new NotFoundException('La persona asignada no existe')
    }

    return this.prisma.tarea.create({
      data: {
        titulo,
        detalle: dto.detalle?.trim() || null,
        prioridad: (dto.prioridad ?? 'MEDIA') as any,
        // Se fija a medianoche UTC: es un dia de calendario, no un instante. Sin
        // esto, en Ecuador (UTC-5) se guardaria el dia anterior.
        fechaLimite: dto.fechaLimite
          ? new Date(`${dto.fechaLimite.slice(0, 10)}T00:00:00.000Z`)
          : null,
        asignadoId,
        // Quien crea la tarea queda como solicitante aunque se la asigne a otro.
        solicitanteId: userId,
        clienteId: dto.clienteId || null,
        organizationId,
      },
      include: {
        asignado: { select: { id: true, name: true } },
        solicitante: { select: { id: true, name: true } },
        cliente: { select: { id: true, nombres: true, apellidos: true } },
      },
    })
  }

  private async exigirAcceso(id: string, organizationId: string, userId: string, role: string) {
    const tarea = await this.prisma.tarea.findFirst({ where: { id, organizationId } })
    if (!tarea) throw new NotFoundException('Tarea no encontrada')
    if (
      !VE_TODAS.includes(role) &&
      tarea.asignadoId !== userId &&
      tarea.solicitanteId !== userId
    ) {
      throw new ForbiddenException('No tienes acceso a esta tarea')
    }
    return tarea
  }

  /**
   * Marca o desmarca la tarea.
   *
   * Se permite desmarcar porque marcar por error es facil y perder la tarea
   * seria peor que el error mismo.
   */
  async alternarCompletada(id: string, organizationId: string, userId: string, role: string) {
    const tarea = await this.exigirAcceso(id, organizationId, userId, role)
    const completada = tarea.completadaEn !== null
    return this.prisma.tarea.update({
      where: { id },
      data: {
        completadaEn: completada ? null : new Date(),
        completadaPor: completada ? null : userId,
      },
      include: {
        asignado: { select: { id: true, name: true } },
        solicitante: { select: { id: true, name: true } },
        cliente: { select: { id: true, nombres: true, apellidos: true } },
      },
    })
  }

  async update(
    id: string,
    dto: {
      titulo?: string
      detalle?: string
      prioridad?: string
      fechaLimite?: string | null
      asignadoId?: string
      clienteId?: string | null
    },
    organizationId: string,
    userId: string,
    role: string,
  ) {
    await this.exigirAcceso(id, organizationId, userId, role)

    // Reasignar es lo que hace Yessenia cuando le llega un pedido de gerencia:
    // solo cambia quien la hace. El solicitante NO se toca, para que quien la
    // pidio siga viendola.
    if (dto.asignadoId && !PUEDE_ASIGNAR_A_OTROS.includes(role)) {
      throw new ForbiddenException('No puedes reasignar tareas')
    }

    return this.prisma.tarea.update({
      where: { id },
      data: {
        ...(dto.titulo !== undefined ? { titulo: dto.titulo.trim() } : {}),
        ...(dto.detalle !== undefined ? { detalle: dto.detalle?.trim() || null } : {}),
        ...(dto.prioridad !== undefined ? { prioridad: dto.prioridad as any } : {}),
        ...(dto.fechaLimite !== undefined
          ? {
              fechaLimite: dto.fechaLimite
                ? new Date(`${dto.fechaLimite.slice(0, 10)}T00:00:00.000Z`)
                : null,
            }
          : {}),
        ...(dto.asignadoId ? { asignadoId: dto.asignadoId } : {}),
        ...(dto.clienteId !== undefined ? { clienteId: dto.clienteId || null } : {}),
      },
      include: {
        asignado: { select: { id: true, name: true } },
        solicitante: { select: { id: true, name: true } },
        cliente: { select: { id: true, nombres: true, apellidos: true } },
      },
    })
  }

  async remove(id: string, organizationId: string, userId: string, role: string) {
    const tarea = await this.exigirAcceso(id, organizationId, userId, role)
    // Solo la borra quien la pidio, o quien coordina. Que el asignado pueda
    // borrar un encargo que le hicieron seria una forma silenciosa de ignorarlo.
    if (tarea.solicitanteId !== userId && !PUEDE_ASIGNAR_A_OTROS.includes(role)) {
      throw new ForbiddenException('Solo quien creó la tarea puede eliminarla')
    }
    return this.prisma.tarea.delete({ where: { id } })
  }
}
