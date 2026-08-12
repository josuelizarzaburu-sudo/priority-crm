import { Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { CorreosAutomaticosService, hoyEnEcuador } from './correos-automaticos.service'

/**
 * Valida el parametro ?fecha=YYYY-MM-DD.
 *
 * Se exige el dia y el mes con DOS digitos. El calculo compara posiciones fijas
 * del texto, asi que '2026-09-5' se leeria mal y devolveria un resultado
 * silenciosamente equivocado. Es mejor rechazarlo que responder algo que parece
 * correcto y no lo es.
 */
function fechaValida(fecha: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return false
  const d = new Date(`${fecha}T00:00:00.000Z`)
  // Descarta fechas imposibles tipo 2026-02-31, que Date acomoda en silencio.
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === fecha
}

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
    if (!fechaValida(dia)) {
      return { error: 'Formato de fecha inválido. Usa YYYY-MM-DD, por ejemplo 2026-09-05.' }
    }
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
    const dia = fecha ?? hoyEnEcuador()
    if (!fechaValida(dia)) {
      return { error: 'Formato de fecha inválido. Usa YYYY-MM-DD, por ejemplo 2026-09-05.' }
    }
    return this.service.procesarCumpleanos(req.user.organizationId, dia)
  }
}
