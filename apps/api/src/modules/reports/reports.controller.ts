import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { ReportsService } from './reports.service'

@ApiTags('Reportes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('reportes')
export class ReportsController {
  constructor(private readonly service: ReportsService) {}

  @Get('ventas')
  @ApiOperation({ summary: 'Ventas ganadas del período, con totales para los gráficos' })
  ventas(
    @Req() req: any,
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
    @Query('agenteId') agenteId?: string,
  ) {
    return this.service.ventasGanadas(
      req.user.organizationId,
      req.user.id,
      req.user.role,
      req.user.puedeVender,
      { desde, hasta, agenteId },
    )
  }

  @Get('embudo')
  @ApiOperation({ summary: 'Leads por etapa, con conversión y motivos de pérdida' })
  embudo(
    @Req() req: any,
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
    @Query('agenteId') agenteId?: string,
  ) {
    return this.service.embudo(
      req.user.organizationId,
      req.user.id,
      req.user.role,
      req.user.puedeVender,
      { desde, hasta, agenteId },
    )
  }

  @Get('tiempos')
  @ApiOperation({ summary: 'Días desde que entra el lead hasta que se cierra' })
  tiempos(
    @Req() req: any,
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
    @Query('agenteId') agenteId?: string,
  ) {
    return this.service.tiemposDeCierre(
      req.user.organizationId,
      req.user.id,
      req.user.role,
      req.user.puedeVender,
      { desde, hasta, agenteId },
    )
  }

  @Get('agentes')
  @ApiOperation({ summary: 'Agentes con ventas, para el filtro' })
  agentes(@Req() req: any) {
    return this.service.agentesConVentas(
      req.user.organizationId,
      req.user.id,
      req.user.role,
      req.user.puedeVender,
    )
  }
}
