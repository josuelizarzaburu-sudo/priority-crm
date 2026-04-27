import { Injectable, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common'
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
          role: 'ADMIN',
        },
      })
    })
  }

  findByOrganization(organizationId: string) {
    return this.prisma.user.findMany({
      where: { organizationId },
      select: { id: true, name: true, email: true, role: true, avatar: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    })
  }

  async createTeamMember(dto: CreateTeamMemberDto, organizationId: string, callerRole: string) {
    if (callerRole !== 'ADMIN' && callerRole !== 'MANAGER') {
      throw new ForbiddenException('Only admins and managers can create team members')
    }
    if (dto.role === 'ADMIN' && callerRole !== 'ADMIN') {
      throw new ForbiddenException('Only admins can create admin users')
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
    if (callerRole !== 'ADMIN') throw new ForbiddenException('Only admins can remove users')
    if (targetId === callerId) throw new ForbiddenException('You cannot remove yourself')

    const user = await this.prisma.user.findFirst({ where: { id: targetId, organizationId } })
    if (!user) throw new NotFoundException('User not found')

    await this.prisma.user.delete({ where: { id: targetId } })
    return { success: true }
  }
}
