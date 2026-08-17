import {
  Controller, Get, Post, Patch, Body, Param, Query, UseGuards, Req,
} from '@nestjs/common'
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { RenovacionesService } from './renovaciones.service'
import { RenovacionesQueryDto } from './dto/renovaciones-query.dto'
import { UpdateRenovacionDto } from './dto/update-renovacion.dto'

@ApiTags('Renovaciones')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('renovaciones')
export class RenovacionesController {
  constructor(private readonly service: RenovacionesService) {}

  @Get()
  @ApiOperation({ summary: 'Renovaciones, filtrables por mes y estado' })
  findAll(@Query() query: RenovacionesQueryDto, @Req() req: any) {
    return this.service.findAll(req.user.organizationId, req.user.role, query)
  }

  @Get('por-mes')
  @ApiOperation({ summary: 'Cuántas renovaciones hay en cada mes' })
  porMes(@Req() req: any) {
    return this.service.porMes(req.user.organizationId, req.user.role)
  }

  @Post('generar')
  @ApiOperation({ summary: 'Crear las renovaciones que faltan a partir de las pólizas' })
  generar(@Req() req: any) {
    return this.service.generar(req.user.organizationId, req.user.role)
  }

  @Get(':id/correo')
  @ApiOperation({ summary: 'Correo de renovación ya armado, para revisarlo antes de enviar' })
  prepararCorreo(@Param('id') id: string, @Req() req: any) {
    return this.service.prepararCorreo(id, req.user.organizationId)
  }

  @Post(':id/enviar-correo')
  @ApiOperation({ summary: 'Envía el correo de renovación tal como quedó en pantalla' })
  enviarCorreo(
    @Param('id') id: string,
    @Body() dto: { texto: string; destinatario: string; plantilla?: string },
    @Req() req: any,
  ) {
    return this.service.enviarCorreo(id, dto, req.user.organizationId, req.user.id)
  }

  @Get(':id')
  @ApiOperation({ summary: 'Ficha de la renovación' })
  findOne(@Param('id') id: string, @Req() req: any) {
    return this.service.findOne(id, req.user.organizationId, req.user.role)
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Editar la renovación' })
  update(@Param('id') id: string, @Body() dto: UpdateRenovacionDto, @Req() req: any) {
    return this.service.update(id, dto, req.user.organizationId, req.user.role)
  }

  @Post(':id/notas')
  @ApiOperation({ summary: 'Agregar nota a la bitácora' })
  agregarNota(@Param('id') id: string, @Body() dto: { contenido: string }, @Req() req: any) {
    return this.service.agregarNota(
      id, dto?.contenido, req.user.organizationId, req.user.id, req.user.role,
    )
  }
}
