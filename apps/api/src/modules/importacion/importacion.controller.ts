import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common'
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
