import { Injectable, ConflictException, ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common'
import * as bcrypt from 'bcryptjs'
import { PrismaService } from '../../prisma/prisma.service'
import { CreateTeamMemberDto } from './dto/create-team-member.dto'

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
      select: { id: true, name: true, email: true, phone: true, role: true, avatar: true, createdAt: true },
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
    if (!['SUPER_ADMIN', 'OWNER', 'MANAGER'].includes(callerRole)) {
      throw new ForbiddenException('No tienes permisos para editar el teléfono de otros usuarios')
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

  // Which roles each caller level is allowed to create
  private static readonly CREATABLE_BY: Record<string, string[]> = {
    SUPER_ADMIN: ['SUPER_ADMIN', 'OWNER', 'MANAGER', 'SALES_REP'],
    OWNER:       ['MANAGER', 'SALES_REP'],
    MANAGER:     ['SALES_REP'],
    SALES_REP:   [],
  }

  async createTeamMember(dto: CreateTeamMemberDto, organizationId: string, callerRole: string) {
    const allowed = UsersService.CREATABLE_BY[callerRole] ?? []
    if (allowed.length === 0) {
      throw new ForbiddenException('No tienes permisos para crear usuarios')
    }
    if (!allowed.includes(dto.role)) {
      throw new ForbiddenException(`Tu rol no puede crear usuarios con rol ${dto.role}`)
    }

    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } })
    if (existing) throw new ConflictException('Email already in use')

    const hashed = await bcrypt.hash(dto.password, 12)
    const user = await this.prisma.user.create({
      data: { name: dto.name, email: dto.email, password: hashed, role: dto.role as any, organizationId },
      select: { id: true, name: true, email: true, role: true, avatar: true, createdAt: true },
    })
    return user
  }

  async removeTeamMember(targetId: string, organizationId: string, callerId: string, callerRole: string) {
    if (callerRole !== 'SUPER_ADMIN' && callerRole !== 'OWNER') {
      throw new ForbiddenException('Solo SUPER_ADMIN y OWNER pueden eliminar usuarios')
    }
    if (targetId === callerId) throw new ForbiddenException('You cannot remove yourself')

    const user = await this.prisma.user.findFirst({ where: { id: targetId, organizationId } })
    if (!user) throw new NotFoundException('User not found')

    await this.prisma.user.delete({ where: { id: targetId } })
    return { success: true }
  }
}
