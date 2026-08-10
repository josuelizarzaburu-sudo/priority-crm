import { Injectable, ConflictException, ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common'
import * as bcrypt from 'bcryptjs'
import { PrismaService } from '../../prisma/prisma.service'
import { CreateTeamMemberDto } from './dto/create-team-member.dto'

/**
 * Roles asignables desde la pantalla de Usuarios.
 *
 * Lista blanca: un rol nuevo no se puede asignar hasta agregarlo aqui.
 */
const ROLES_VALIDOS = [
  'SUPER_ADMIN', 'OWNER', 'MANAGER', 'JEFE_EQUIPO',
  'SALES_REP', 'OPERACIONES', 'JEFE_OPERACIONES',
]

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  findById(id: string) {
    return this.prisma.user.findUnique({ where: { id } })
  }

  findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } })
  }

  create(data: { name: string; email: string; password: string; organizationName?: string }) {
    return this.prisma.$transaction(async (tx: any) => {
      const org = await tx.organization.create({
        data: { name: data.organizationName ?? `${data.name}'s Organization` },
      })
      return tx.user.create({
        data: {
          name: data.name,
          email: data.email,
          password: data.password,
          organizationId: org.id,
          role: 'SUPER_ADMIN',
        },
      })
    })
  }

  findByOrganization(organizationId: string) {
    return this.prisma.user.findMany({
      where: { organizationId },
      select: { id: true, name: true, email: true, phone: true, role: true, avatar: true, createdAt: true, puedeCotizarPorOtros: true, puedeVender: true },
      orderBy: { createdAt: 'asc' },
    })
  }

  async updateProfile(userId: string, data: { name?: string; phone?: string }): Promise<object> {
    if (data.phone && !/^\+\d{7,15}$/.test(data.phone)) {
      throw new BadRequestException('Formato de teléfono inválido. Usa +593XXXXXXXXX')
    }
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { ...(data.name ? { name: data.name } : {}), ...(data.phone !== undefined ? { phone: data.phone } : {}) },
      select: { id: true, name: true, email: true, phone: true, role: true, avatar: true },
    })
    return updated
  }

  async updateMemberPhone(targetId: string, phone: string | null, organizationId: string, callerRole: string): Promise<object> {
    if (callerRole !== 'SUPER_ADMIN') {
      throw new ForbiddenException('Solo SUPER_ADMIN puede editar el teléfono de otros usuarios')
    }
    if (phone && !/^\+\d{7,15}$/.test(phone)) {
      throw new BadRequestException('Formato de teléfono inválido. Usa +593XXXXXXXXX')
    }
    const user = await this.prisma.user.findFirst({ where: { id: targetId, organizationId } })
    if (!user) throw new NotFoundException('Usuario no encontrado')

    return this.prisma.user.update({
      where: { id: targetId },
      data: { phone: phone ?? null },
      select: { id: true, name: true, email: true, phone: true, role: true, avatar: true },
    })
  }

  /**
   * Restablece la contraseña de otro usuario.
   *
   * Va en su propio metodo y no dentro de updateMember a proposito: mezclar la
   * contraseña con la edicion normal hace facil enviarla sin querer en un guardado
   * cualquiera. Aqui es una accion explicita y separada.
   *
   * No se pide la contraseña anterior porque el caso de uso es justamente que la
   * persona la perdio. Por eso el permiso esta limitado a SUPER_ADMIN.
   */
  async resetPassword(
    targetId: string,
    nuevaPassword: string,
    organizationId: string,
    callerRole: string,
  ): Promise<{ ok: true }> {
    if (callerRole !== 'SUPER_ADMIN') {
      throw new ForbiddenException('Solo SUPER_ADMIN puede restablecer contraseñas')
    }
    if (!nuevaPassword || nuevaPassword.length < 8) {
      throw new BadRequestException('La contraseña debe tener al menos 8 caracteres')
    }

    const user = await this.prisma.user.findFirst({ where: { id: targetId, organizationId } })
    if (!user) throw new NotFoundException('Usuario no encontrado')

    const hashed = await bcrypt.hash(nuevaPassword, 12)
    await this.prisma.user.update({ where: { id: targetId }, data: { password: hashed } })

    // Se devuelve solo una confirmacion: la contraseña no vuelve nunca en una
    // respuesta, ni siquiera hasheada.
    return { ok: true }
  }

  async createTeamMember(dto: CreateTeamMemberDto, organizationId: string, callerRole: string) {
    if (callerRole !== 'SUPER_ADMIN') {
      throw new ForbiddenException('Solo SUPER_ADMIN puede crear usuarios')
    }

    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } })
    if (existing) throw new ConflictException('Email already in use')

    const hashed = await bcrypt.hash(dto.password, 12)
    return this.prisma.user.create({
      data: {
        name: dto.name,
        email: dto.email,
        password: hashed,
        role: dto.role as any,
        organizationId,
        ...(dto.phone ? { phone: dto.phone } : {}),
      },
      select: { id: true, name: true, email: true, phone: true, role: true, avatar: true, createdAt: true },
    })
  }

  async updateMember(
    targetId: string,
    data: {
      name?: string
      phone?: string | null
      puedeCotizarPorOtros?: boolean
      puedeVender?: boolean
      role?: string
    },
    organizationId: string,
    callerRole: string,
    callerId?: string,
  ): Promise<object> {
    if (callerRole !== 'SUPER_ADMIN') {
      throw new ForbiddenException('Solo SUPER_ADMIN puede editar usuarios')
    }
    if (data.phone && !/^\+\d{7,15}$/.test(data.phone)) {
      throw new BadRequestException('Formato de teléfono inválido. Usa +593XXXXXXXXX')
    }
    const user = await this.prisma.user.findFirst({ where: { id: targetId, organizationId } })
    if (!user) throw new NotFoundException('Usuario no encontrado')

    if (data.role && data.role !== user.role) {
      if (!ROLES_VALIDOS.includes(data.role)) {
        throw new BadRequestException('Rol no válido')
      }
      // No puedes quitarte a ti mismo el super admin: perderias el acceso a esta
      // misma pantalla y no habria como revertirlo.
      if (callerId && targetId === callerId && user.role === 'SUPER_ADMIN') {
        throw new BadRequestException('No puedes cambiar tu propio rol de super admin')
      }
      // Tiene que quedar al menos un super admin, o nadie podria volver a
      // administrar usuarios.
      if (user.role === 'SUPER_ADMIN') {
        const otros = await this.prisma.user.count({
          where: { organizationId, role: 'SUPER_ADMIN', NOT: { id: targetId } },
        })
        if (otros === 0) throw new BadRequestException('Debe quedar al menos un super admin')
      }
      // Si deja de ser jefe no puede seguir liderando un equipo: quedaria un
      // equipo cuyo jefe ya no ve el tablero.
      if (user.role === 'JEFE_EQUIPO' && data.role !== 'JEFE_EQUIPO') {
        const lidera = await this.prisma.equipo.findFirst({
          where: { jefeId: targetId, organizationId, activo: true },
          select: { nombre: true },
        })
        if (lidera) {
          throw new BadRequestException(
            `Sigue siendo jefe del equipo "${lidera.nombre}". Cambia primero el jefe de ese equipo.`,
          )
        }
      }
    }

    return this.prisma.user.update({
      where: { id: targetId },
      data: {
        ...(data.name ? { name: data.name } : {}),
        ...(data.phone !== undefined ? { phone: data.phone ?? null } : {}),
        ...(data.puedeCotizarPorOtros !== undefined
          ? { puedeCotizarPorOtros: data.puedeCotizarPorOtros }
          : {}),
        ...(data.puedeVender !== undefined ? { puedeVender: data.puedeVender } : {}),
        ...(data.role ? { role: data.role as any } : {}),
      },
      select: { id: true, name: true, email: true, phone: true, role: true, avatar: true, createdAt: true, puedeCotizarPorOtros: true, puedeVender: true },
    })
  }

  async removeTeamMember(targetId: string, organizationId: string, callerId: string, callerRole: string) {
    if (callerRole !== 'SUPER_ADMIN') {
      throw new ForbiddenException('Solo SUPER_ADMIN puede eliminar usuarios')
    }
    if (targetId === callerId) throw new ForbiddenException('You cannot remove yourself')

    const user = await this.prisma.user.findFirst({ where: { id: targetId, organizationId } })
    if (!user) throw new NotFoundException('User not found')

    await this.prisma.user.delete({ where: { id: targetId } })
    return { success: true }
  }
}
