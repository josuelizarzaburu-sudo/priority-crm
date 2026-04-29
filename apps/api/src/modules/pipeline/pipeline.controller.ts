import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, Req } from '@nestjs/common'
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { PipelineService } from './pipeline.service'
import { CreateDealDto } from './dto/create-deal.dto'
import { UpdateDealDto } from './dto/update-deal.dto'
import { MoveDealDto } from './dto/move-deal.dto'
import { AssignDealDto } from './dto/assign-deal.dto'
import { LogActivityDto } from './dto/log-activity.dto'
import { CloseDealDto } from './dto/close-deal.dto'

@ApiTags('Pipeline')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('pipeline')
export class PipelineController {
  constructor(private readonly pipelineService: PipelineService) {}

  @Get('stages')
  @ApiOperation({ summary: 'Get pipeline stages with deals' })
  getStages(@Req() req: any) {
    return this.pipelineService.getStagesWithDeals(req.user.organizationId)
  }

  @Get('my-deals')
  @ApiOperation({ summary: 'Get deals assigned to the calling user' })
  getMyDeals(@Req() req: any) {
    return this.pipelineService.getMyDeals(req.user.id, req.user.organizationId)
  }

  @Get('unassigned')
  @ApiOperation({ summary: 'Get unassigned deals — MANAGER/ADMIN only' })
  getUnassigned(@Req() req: any) {
    return this.pipelineService.getUnassignedDeals(req.user.organizationId, req.user.role)
  }

  @Get('deals')
  getDeals(@Req() req: any) {
    return this.pipelineService.getDeals(req.user.organizationId, req.user.id, req.user.role)
  }

  @Get('deals/:id')
  getDeal(@Param('id') id: string, @Req() req: any) {
    return this.pipelineService.getDeal(id, req.user.organizationId)
  }

  @Post('deals')
  createDeal(@Body() dto: CreateDealDto, @Req() req: any) {
    return this.pipelineService.createDeal(dto, req.user.organizationId, req.user.id)
  }

  @Put('deals/:id')
  updateDeal(@Param('id') id: string, @Body() dto: UpdateDealDto, @Req() req: any) {
    return this.pipelineService.updateDeal(id, dto, req.user.organizationId)
  }

  @Put('deals/:id/move')
  @ApiOperation({ summary: 'Move deal to another stage' })
  moveDeal(@Param('id') id: string, @Body() dto: MoveDealDto, @Req() req: any) {
    return this.pipelineService.moveDeal(id, dto, req.user.organizationId, req.user.id)
  }

  @Put('deals/:id/assign')
  @ApiOperation({ summary: 'Assign deal to an agent — MANAGER/ADMIN only' })
  assignDeal(@Param('id') id: string, @Body() dto: AssignDealDto, @Req() req: any) {
    return this.pipelineService.assignDeal(id, dto, req.user.organizationId, req.user.id, req.user.role)
  }

  @Post('deals/:id/activity')
  @ApiOperation({ summary: 'Log a CALL/NOTE/EMAIL/MEETING/TASK activity on a deal' })
  logActivity(@Param('id') id: string, @Body() dto: LogActivityDto, @Req() req: any) {
    return this.pipelineService.logActivity(id, dto, req.user.organizationId, req.user.id)
  }

  @Put('deals/:id/close')
  @ApiOperation({ summary: 'Mark deal as WON or LOST' })
  closeDeal(@Param('id') id: string, @Body() dto: CloseDealDto, @Req() req: any) {
    return this.pipelineService.closeDeal(id, dto, req.user.organizationId, req.user.id)
  }

  @Delete('deals/:id')
  deleteDeal(@Param('id') id: string, @Req() req: any) {
    return this.pipelineService.deleteDeal(id, req.user.organizationId)
  }
}
