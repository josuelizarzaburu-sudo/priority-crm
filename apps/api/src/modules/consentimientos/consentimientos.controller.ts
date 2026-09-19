import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { ConsentimientosService } from './consentimientos.service'

@ApiTags('Consentimientos')
@Controller('consentimientos')
export class ConsentimientosController {
  constructor(private readonly service: ConsentimientosService) {}

  /**
   * Estas tres NO piden sesion: las usa el CLIENTE desde el enlace de su correo.
   * El token es la credencial. Van primero para que no las tape el guard.
   */
  @Get('publico/:token')
  @ApiOperation({ summary: 'Lo que ve el cliente al abrir el enlace' })
  ver(@Param('token') token: string) {
    return this.service.verPorToken(token)
  }

  @Post('publico/:token/aceptar')
  @ApiOperation({ summary: 'El cliente otorga su consentimiento' })
  aceptar(@Param('token') token: string, @Req() req: any) {
    // La IP y el navegador se toman del SERVIDOR, no del cuerpo de la peticion:
    // si vinieran del cliente, cualquiera podria escribir lo que quisiera y la
    // evidencia no valdria nada.
    const ip =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.socket?.remoteAddress
    return this.service.otorgar(token, ip, req.headers['user-agent'])
  }

  @Post('publico/:token/revocar')
  @ApiOperation({ summary: 'El cliente retira su consentimiento' })
  revocar(@Param('token') token: string) {
    return this.service.revocar(token)
  }

  // ── De aqui para abajo, solo desde el CRM ──────────────────────────────────

  @Get('tablero')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Quien acepto y quien no' })
  tablero(@Req() req: any, @Query('estado') estado?: string) {
    return this.service.tablero(req.user.organizationId, req.user.role, estado)
  }

  @Post('cliente/:clienteId/solicitar')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Envia el enlace de consentimiento a un cliente' })
  solicitar(@Param('clienteId') clienteId: string, @Req() req: any) {
    return this.service.solicitar(clienteId, req.user.organizationId, req.user.role)
  }

  @Post('solicitar-masivo')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Envia el enlace a los que aun no lo tienen, por tandas' })
  masivo(@Body() body: { limite?: number }, @Req() req: any) {
    return this.service.solicitarMasivo(
      req.user.organizationId,
      req.user.role,
      body?.limite ?? 50,
    )
  }

  @Get('cliente/:clienteId/evidencia')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'La evidencia, como se le presenta a la autoridad' })
  evidencia(@Param('clienteId') clienteId: string, @Req() req: any) {
    return this.service.evidencia(clienteId, req.user.organizationId, req.user.role)
  }
}
