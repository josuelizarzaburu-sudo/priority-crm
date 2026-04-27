import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, Req } from '@nestjs/common'
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { AutomationsService } from './automations.service'

@ApiTags('Automations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('automations')
export class AutomationsController {
  constructor(private readonly automationsService: AutomationsService) {}

  @Get()
  findAll(@Req() req: any) {
    return this.automationsService.findAll(req.user.organizationId)
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Req() req: any) {
    return this.automationsService.findOne(id, req.user.organizationId)
  }

  @Post()
  create(@Body() body: any, @Req() req: any) {
    return this.automationsService.create(body, req.user.organizationId, req.user.id)
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    return this.automationsService.update(id, body, req.user.organizationId)
  }

  @Put(':id/toggle')
  toggle(@Param('id') id: string, @Req() req: any) {
    return this.automationsService.toggle(id, req.user.organizationId)
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: any) {
    return this.automationsService.remove(id, req.user.organizationId)
  }
}
