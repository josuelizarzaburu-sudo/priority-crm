import { Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { CorreosAutomaticosService, hoyEnEcuador } from './correos-automaticos.service'

@ApiTags('Correos automáticos')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('correos-automaticos')
export class CorreosAutomaticosController {
  constructor(private readonly service: CorreosAutomaticosService) {}

  @Get('cumpleanos/hoy')
  @ApiOperation({
    summary: 'A quién le tocaría saludo hoy. Solo consulta, no envía nada.',
  })
  async cumpleanerosDeHoy(@Req() req: any, @Query('fecha') fecha?: string) {
    if (req.user.role !== 'SUPER_ADMIN') return { error: 'Solo SUPER_ADMIN' }
    // El parametro fecha permite revisar otro dia (formato YYYY-MM-DD), util
    // para comprobar que las fechas cuadran sin esperar al cumpleaños de nadie.
    const dia = fecha ?? hoyEnEcuador()
    const clientes = await this.service.cumpleanerosDeHoy(req.user.organizationId, dia)
    return {
      fecha: dia,
      total: clientes.length,
      clientes: clientes.map((c) => ({
        nombre: `${c.nombres} ${c.apellidos}`,
        email: c.email,
        nacimiento: c.fechaNacimiento,
      })),
    }
  }

  @Post('cumpleanos/ejecutar')
  @ApiOperation({
    summary: 'Ejecuta la tarea ahora, sin esperar a las 9 AM. Respeta el modo prueba.',
  })
  async ejecutar(@Req() req: any, @Query('fecha') fecha?: string) {
    if (req.user.role !== 'SUPER_ADMIN') return { error: 'Solo SUPER_ADMIN' }
    return this.service.procesarCumpleanos(req.user.organizationId, fecha ?? hoyEnEcuador())
  }
}
