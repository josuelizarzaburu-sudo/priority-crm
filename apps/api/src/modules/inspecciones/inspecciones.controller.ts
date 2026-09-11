import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { InspeccionesService, type EstadoInspeccion } from './inspecciones.service'

@ApiTags('Inspecciones')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('inspecciones')
export class InspeccionesController {
  constructor(private readonly service: InspeccionesService) {}

  @Get('deal/:dealId')
  @ApiOperation({ summary: 'Inspección de un negocio, con su bitácora' })
  porDeal(@Param('dealId') dealId: string, @Req() req: any) {
    return this.service.porDeal(dealId, req.user.organizationId)
  }

  @Post('deal/:dealId/enviar')
  @ApiOperation({ summary: 'Envía la solicitud de inspección a Fidelización' })
  enviar(@Param('dealId') dealId: string, @Body() body: any, @Req() req: any) {
    return this.service.enviar(dealId, body ?? {}, req.user.organizationId, req.user.id)
  }

  @Post('deal/:dealId/resolver')
  @ApiOperation({ summary: 'Registra el resultado. Solo Fidelización.' })
  resolver(
    @Param('dealId') dealId: string,
    @Body() body: { estado: EstadoInspeccion; observacion?: string },
    @Req() req: any,
  ) {
    return this.service.resolver(
      dealId,
      body,
      req.user.organizationId,
      req.user.id,
      req.user.role,
    )
  }
}
