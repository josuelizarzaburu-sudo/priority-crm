import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { ReferidosService } from './referidos.service'

@ApiTags('Referidos')
@Controller('referidos')
export class ReferidosController {
  constructor(private readonly service: ReferidosService) {}

  /**
   * Estas dos rutas NO piden sesion del CRM: las usa el referidor desde su
   * propia pantalla, y el codigo es su credencial. Van primero para que no las
   * tape el guard de abajo.
   */
  @Get('panel/:codigo')
  @ApiOperation({ summary: 'Lo que ve el referidor: sus puntos y sus referidos' })
  miPanel(@Param('codigo') codigo: string) {
    return this.service.miPanel(codigo)
  }

  @Post('panel/:codigo/referir')
  @ApiOperation({ summary: 'El referidor manda un contacto' })
  referir(
    @Param('codigo') codigo: string,
    @Body() body: { nombres: string; celular: string; email?: string; interes?: string; nota?: string },
  ) {
    return this.service.crearReferido(codigo, body)
  }

  // ── De aqui para abajo, solo desde el CRM ──────────────────────────────────

  @Get('resumen')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Cuánto se debe y qué está pendiente' })
  resumen(@Req() req: any) {
    return this.service.resumen(req.user.organizationId, req.user.role)
  }

  @Get('referidores')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Lista de referidores' })
  referidores(@Req() req: any, @Query('search') search?: string) {
    return this.service.listarReferidores(req.user.organizationId, req.user.role, search)
  }

  @Post('referidores')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Da de alta un referidor y le genera su código' })
  crearReferidor(@Body() body: any, @Req() req: any) {
    return this.service.crearReferidor(req.user.organizationId, req.user.role, body)
  }

  @Post('referidores/:id/pago')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Registra un pago al referidor' })
  registrarPago(
    @Param('id') id: string,
    @Body() body: { monto: number; detalle?: string },
    @Req() req: any,
  ) {
    return this.service.registrarPago(
      id,
      req.user.organizationId,
      req.user.role,
      req.user.id,
      body,
    )
  }

  @Get()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Los referidos, los nuevos primero' })
  listar(@Req() req: any, @Query('estado') estado?: string) {
    return this.service.listarReferidos(req.user.organizationId, req.user.role, estado)
  }

  @Patch(':id/estado')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Cambia el estado de un referido' })
  cambiarEstado(
    @Param('id') id: string,
    @Body() body: { estado: string; motivo?: string },
    @Req() req: any,
  ) {
    return this.service.cambiarEstadoReferido(
      id,
      req.user.organizationId,
      req.user.role,
      body,
    )
  }

  @Post(':id/acreditar')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Acredita puntos y dinero por un referido cerrado' })
  acreditar(@Param('id') id: string, @Body() body: { primaAnual?: number }, @Req() req: any) {
    return this.service.acreditar(
      id,
      req.user.organizationId,
      req.user.role,
      req.user.id,
      body,
    )
  }

  @Get('reglas')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Puntos por referido y tramos de pago' })
  reglas(@Req() req: any) {
    return this.service.reglas(req.user.organizationId)
  }

  @Patch('reglas')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Ajusta las reglas. Solo afecta hacia adelante.' })
  guardarReglas(@Body() body: any, @Req() req: any) {
    return this.service.guardarReglas(req.user.organizationId, req.user.role, body)
  }
}
