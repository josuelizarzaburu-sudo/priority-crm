import { Controller, Get, Param, Patch, Query, Req, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { NotificacionesService } from './notificaciones.service'

@ApiTags('Notificaciones')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('notificaciones')
export class NotificacionesController {
  constructor(private readonly service: NotificacionesService) {}

  @Get()
  @ApiOperation({ summary: 'Mis avisos, primero los no leídos' })
  listar(@Req() req: any, @Query('soloNoLeidas') soloNoLeidas?: string) {
    return this.service.listar(req.user.id, soloNoLeidas === 'true')
  }

  @Patch(':id/leida')
  @ApiOperation({ summary: 'Marca un aviso como leído' })
  marcarLeida(@Param('id') id: string, @Req() req: any) {
    return this.service.marcarLeida(id, req.user.id)
  }

  @Patch('leidas')
  @ApiOperation({ summary: 'Marca todos mis avisos como leídos' })
  marcarTodas(@Req() req: any) {
    return this.service.marcarTodasLeidas(req.user.id)
  }
}
