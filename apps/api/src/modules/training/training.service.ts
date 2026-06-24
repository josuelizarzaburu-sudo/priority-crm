import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { CreateTrainingVideoDto } from './dto/create-training-video.dto'
import { UpdateTrainingVideoDto } from './dto/update-training-video.dto'

const MANAGE_ROLES = ['SUPER_ADMIN', 'OWNER', 'MANAGER']

@Injectable()
export class TrainingService {
  constructor(private readonly prisma: PrismaService) {}

  private assertCanManage(role: string) {
    if (!MANAGE_ROLES.includes(role)) {
      throw new ForbiddenException('No tienes permiso para gestionar videos de capacitación')
    }
  }

  async findAll(organizationId: string, userId: string) {
    const videos = await this.prisma.trainingVideo.findMany({
      where: { organizationId },
      orderBy: [{ category: 'asc' }, { createdAt: 'desc' }],
      include: {
        createdBy: { select: { id: true, name: true } },
        views: { where: { userId }, select: { userId: true } },
      },
    })
    return videos.map(({ views, ...video }) => ({ ...video, viewed: views.length > 0 }))
  }

  async create(dto: CreateTrainingVideoDto, organizationId: string, createdById: string, role: string) {
    this.assertCanManage(role)
    return this.prisma.trainingVideo.create({
      data: { ...dto, organizationId, createdById },
      include: { createdBy: { select: { id: true, name: true } } },
    })
  }

  async update(id: string, dto: UpdateTrainingVideoDto, organizationId: string, role: string) {
    this.assertCanManage(role)
    const existing = await this.prisma.trainingVideo.findFirst({ where: { id, organizationId } })
    if (!existing) throw new NotFoundException('Video no encontrado')

    return this.prisma.trainingVideo.update({
      where: { id },
      data: dto,
      include: { createdBy: { select: { id: true, name: true } } },
    })
  }

  async remove(id: string, organizationId: string, role: string) {
    this.assertCanManage(role)
    const existing = await this.prisma.trainingVideo.findFirst({ where: { id, organizationId } })
    if (!existing) throw new NotFoundException('Video no encontrado')

    await this.prisma.trainingVideo.delete({ where: { id } })
    return { id, deleted: true }
  }

  async markViewed(videoId: string, userId: string, organizationId: string) {
    const video = await this.prisma.trainingVideo.findFirst({ where: { id: videoId, organizationId } })
    if (!video) throw new NotFoundException('Video no encontrado')

    await this.prisma.trainingVideoView.upsert({
      where: { videoId_userId: { videoId, userId } },
      create: { videoId, userId },
      update: {},
    })
    return { videoId, viewed: true }
  }

  async unmarkViewed(videoId: string, userId: string) {
    await this.prisma.trainingVideoView.deleteMany({ where: { videoId, userId } })
    return { videoId, viewed: false }
  }
}
