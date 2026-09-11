import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { EmisionesService } from './emisiones.service'

@ApiTags('Emisiones')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('emisiones')
export class EmisionesController {
  constructor(private readonly service: EmisionesService) {}

  @Get()
  @ApiOperation({ summary: 'Emisiones de vehículos, las pendientes primero' })
  listar(@Req() req: any, @Query('estado') estado?: string, @Query('search') search?: string) {
    return this.service.listar(req.user.organizationId, req.user.role, { estado, search })
  }

  @Get(':id/vista-previa')
  @ApiOperation({ summary: 'El correo armado, editable antes de enviar' })
  vistaPrevia(
    @Param('id') id: string,
    @Req() req: any,
    @Query('plantilla') plantilla?: string,
  ) {
    return this.service.vistaPrevia(id, req.user.organizationId, req.user.role, plantilla)
  }

  @Post(':id/enviar')
  @ApiOperation({ summary: 'Envía el correo de emisión al cliente' })
  enviar(
    @Param('id') id: string,
    @Body() body: { texto?: string; plantilla?: string; copias?: string },
    @Req() req: any,
  ) {
    return this.service.enviar(
      id,
      body ?? {},
      req.user.organizationId,
      req.user.id,
      req.user.role,
    )
  }
}
