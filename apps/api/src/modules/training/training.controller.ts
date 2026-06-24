import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, Req } from '@nestjs/common'
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { TrainingService } from './training.service'
import { CreateTrainingVideoDto } from './dto/create-training-video.dto'
import { UpdateTrainingVideoDto } from './dto/update-training-video.dto'

@ApiTags('Training')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('training')
export class TrainingController {
  constructor(private readonly trainingService: TrainingService) {}

  @Get('videos')
  @ApiOperation({ summary: 'List training videos with the viewed status for the caller' })
  findAll(@Req() req: any) {
    return this.trainingService.findAll(req.user.organizationId, req.user.id)
  }

  @Post('videos')
  @ApiOperation({ summary: 'Create a training video — MANAGER/OWNER/SUPER_ADMIN only' })
  create(@Body() dto: CreateTrainingVideoDto, @Req() req: any) {
    return this.trainingService.create(dto, req.user.organizationId, req.user.id, req.user.role)
  }

  @Put('videos/:id')
  @ApiOperation({ summary: 'Update a training video — MANAGER/OWNER/SUPER_ADMIN only' })
  update(@Param('id') id: string, @Body() dto: UpdateTrainingVideoDto, @Req() req: any) {
    return this.trainingService.update(id, dto, req.user.organizationId, req.user.role)
  }

  @Delete('videos/:id')
  @ApiOperation({ summary: 'Delete a training video — MANAGER/OWNER/SUPER_ADMIN only' })
  remove(@Param('id') id: string, @Req() req: any) {
    return this.trainingService.remove(id, req.user.organizationId, req.user.role)
  }

  @Post('videos/:id/view')
  @ApiOperation({ summary: 'Mark a video as viewed by the caller' })
  markViewed(@Param('id') id: string, @Req() req: any) {
    return this.trainingService.markViewed(id, req.user.id, req.user.organizationId)
  }

  @Delete('videos/:id/view')
  @ApiOperation({ summary: 'Unmark a video as viewed by the caller' })
  unmarkViewed(@Param('id') id: string, @Req() req: any) {
    return this.trainingService.unmarkViewed(id, req.user.id)
  }
}
