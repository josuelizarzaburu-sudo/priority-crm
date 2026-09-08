import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { ImportacionService, type FilaExcel } from './importacion.service'

// Las filas llegan como objetos con muchas columnas opcionales, asi que se tipan
// como any y la validacion vive en el servicio, que puede decir QUE fila tiene el
// problema en vez de rechazar todo el archivo.

@ApiTags('Importación')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('importacion')
export class ImportacionController {
  constructor(private readonly service: ImportacionService) {}

  @Post('clientes/previsualizar')
  @ApiOperation({ summary: 'Revisa el archivo y dice qué se cargaría, sin escribir nada' })
  previsualizar(@Body() body: { filas: FilaExcel[] }, @Req() req: any) {
    return this.service.previsualizar(body?.filas ?? [], req.user.organizationId, req.user.role)
  }

  @Post('clientes')
  @ApiOperation({ summary: 'Carga los clientes en la base' })
  importar(@Body() body: { filas: FilaExcel[] }, @Req() req: any) {
    return this.service.importar(body?.filas ?? [], req.user.organizationId, req.user.role)
  }

  @Post('clientes/reenlazar')
  @ApiOperation({
    summary: 'Enlaza ejecutivas y agentes que quedaron solo con nombre, sin usuario',
  })
  reenlazar(@Req() req: any) {
    return this.service.reenlazarUsuarios(req.user.organizationId, req.user.role)
  }

  @Get('agentes/parecidos')
  @ApiOperation({ summary: 'Nombres de agente que podrían ser la misma persona' })
  agentesParecidos(@Req() req: any) {
    return this.service.agentesParecidos(req.user.organizationId, req.user.role)
  }

  @Post('agentes/unificar')
  @ApiOperation({ summary: 'Deja una sola forma escrita para el mismo agente' })
  unificarAgentes(@Body() body: { pares: { de: string; a: string }[] }, @Req() req: any) {
    return this.service.unificarAgentes(
      req.user.organizationId,
      req.user.role,
      body?.pares ?? [],
    )
  }

  @Post('clientes/vaciar')
  @ApiOperation({ summary: 'Borra todos los clientes — irreversible, exige confirmación escrita' })
  vaciar(@Body() body: { confirmacion: string }, @Req() req: any) {
    return this.service.vaciarClientes(
      req.user.organizationId,
      req.user.role,
      body?.confirmacion ?? '',
    )
  }
}
