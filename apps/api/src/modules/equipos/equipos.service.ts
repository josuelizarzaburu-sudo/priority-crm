import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'

/**
 * Quien administra los equipos.
 *
 * Lista blanca a proposito (misma leccion que en comisiones): un rol nuevo entra
 * sin permisos hasta que se lo agregue aqui de forma explicita. En particular, un
 * JEFE_EQUIPO NO puede crear equipos ni moverse gente: eso lo hace el super admin.
 */
const PUEDEN_ADMINISTRAR_EQUIPOS = ['SUPER_ADMIN', 'OWNER']

@Injectable()
export class EquiposService {
  constructor(private readonly prisma: PrismaService) {}

  private exigirAdmin(role: string) {
    if (!PUEDEN_ADMINISTRAR_EQUIPOS.includes(role)) {
      throw new ForbiddenException('No tienes permiso para administrar equipos')
    }
  }

  /**
   * Ids de los miembros de un equipo, sin incluir al jefe.
   *
   * Se usa para acotar las consultas del jefe. Devuelve [] si no tiene equipo.
   */
  async miembrosDelJefe(jefeId: string, organizationId: string): Promise<string[]> {
    const equipo = await this.prisma.equipo.findFirst({
      where: { jefeId, organizationId, activo: true },
      select: { id: true },
    })
    if (!equipo) return []

    const miembros = await this.prisma.user.findMany({
      where: { equipoId: equipo.id, organizationId },
      select: { id: true },
    })
    return miembros.map((m) => m.id)
  }

  async findAll(organizationId: string, role: string) {
    this.exigirAdmin(role)
    return this.prisma.equipo.findMany({
      where: { organizationId },
      orderBy: { nombre: 'asc' },
      include: {
        jefe: { select: { id: true, name: true, email: true, role: true } },
        miembros: {
          select: { id: true, name: true, email: true, role: true },
          orderBy: { name: 'asc' },
        },
      },
    })
  }

  async create(
    dto: { nombre: string; jefeId: string },
    organizationId: string,
    role: string,
  ) {
    this.exigirAdmin(role)

    const jefe = await this.prisma.user.findFirst({
      where: { id: dto.jefeId, organizationId },
      select: { id: true, role: true },
    })
    if (!jefe) throw new NotFoundException('El usuario indicado como jefe no existe')

    // Un mismo usuario no puede liderar dos equipos: si pudiera, "su equipo"
    // dejaria de ser una sola cosa y los filtros se volverian ambiguos.
    const yaLidera = await this.prisma.equipo.findFirst({
      where: { jefeId: dto.jefeId, organizationId, activo: true },
      select: { id: true, nombre: true },
    })
    if (yaLidera) {
      throw new BadRequestException(`Esa persona ya es jefe del equipo "${yaLidera.nombre}"`)
    }

    return this.prisma.equipo.create({
      data: { nombre: dto.nombre.trim(), jefeId: dto.jefeId, organizationId },
      include: { jefe: { select: { id: true, name: true, email: true, role: true } }, miembros: true },
    })
  }

  async update(
    id: string,
    dto: { nombre?: string; jefeId?: string; activo?: boolean },
    organizationId: string,
    role: string,
  ) {
    this.exigirAdmin(role)

    const equipo = await this.prisma.equipo.findFirst({ where: { id, organizationId } })
    if (!equipo) throw new NotFoundException('Equipo no encontrado')

    if (dto.jefeId && dto.jefeId !== equipo.jefeId) {
      const nuevoJefe = await this.prisma.user.findFirst({
        where: { id: dto.jefeId, organizationId },
        select: { id: true },
      })
      if (!nuevoJefe) throw new NotFoundException('El usuario indicado como jefe no existe')

      const yaLidera = await this.prisma.equipo.findFirst({
        where: { jefeId: dto.jefeId, organizationId, activo: true, NOT: { id } },
        select: { nombre: true },
      })
      if (yaLidera) {
        throw new BadRequestException(`Esa persona ya es jefe del equipo "${yaLidera.nombre}"`)
      }
    }

    return this.prisma.equipo.update({
      where: { id },
      data: {
        ...(dto.nombre !== undefined ? { nombre: dto.nombre.trim() } : {}),
        ...(dto.jefeId !== undefined ? { jefeId: dto.jefeId } : {}),
        ...(dto.activo !== undefined ? { activo: dto.activo } : {}),
      },
      include: { jefe: { select: { id: true, name: true, email: true, role: true } }, miembros: true },
    })
  }

  /**
   * Mueve a una persona de equipo (o la deja sin equipo con equipoId = null).
   *
   * No se borran ni se reasignan sus negocios: siguen siendo suyos. Lo unico que
   * cambia es que pasan a contar en el tablero de otro jefe.
   */
  async asignarMiembro(
    userId: string,
    equipoId: string | null,
    organizationId: string,
    role: string,
  ) {
    this.exigirAdmin(role)

    const usuario = await this.prisma.user.findFirst({
      where: { id: userId, organizationId },
      select: { id: true },
    })
    if (!usuario) throw new NotFoundException('Usuario no encontrado')

    if (equipoId) {
      const equipo = await this.prisma.equipo.findFirst({
        where: { id: equipoId, organizationId },
        select: { id: true, jefeId: true },
      })
      if (!equipo) throw new NotFoundException('Equipo no encontrado')
      // El jefe no se agrega como miembro de su propio equipo: ya esta incluido
      // por ser jefe, y tenerlo en los dos lados duplicaria sus numeros.
      if (equipo.jefeId === userId) {
        throw new BadRequestException('El jefe ya pertenece a su equipo, no hace falta agregarlo como miembro')
      }
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: { equipoId },
      select: { id: true, name: true, email: true, role: true, equipoId: true },
    })
  }

  async remove(id: string, organizationId: string, role: string) {
    this.exigirAdmin(role)
    const equipo = await this.prisma.equipo.findFirst({ where: { id, organizationId } })
    if (!equipo) throw new NotFoundException('Equipo no encontrado')

    // Se desactiva en vez de borrar. Borrar dejaria a los miembros sin equipo de
    // golpe y perderia el historial de a quien reportaban.
    return this.prisma.equipo.update({ where: { id }, data: { activo: false } })
  }
}
