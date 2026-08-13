import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common'
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { RequerimientosService } from './requerimientos.service'
import { RequerimientosQueryDto } from './dto/requerimientos-query.dto'
import { CreateRequerimientoDto } from './dto/create-requerimiento.dto'
import { UpdateRequerimientoDto } from './dto/update-requerimiento.dto'

// Requerimientos administrativos. Igual que en reclamos, el filtro por ejecutiva
// vive en el service (servidor): una ejecutiva no ve los de otra aunque llame
// directo al endpoint.
@ApiTags('Requerimientos')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('requerimientos')
export class RequerimientosController {
  constructor(private readonly service: RequerimientosService) {}

  @Get()
  @ApiOperation({ summary: 'Lista de requerimientos (paginada, con búsqueda y filtros)' })
  findAll(@Query() query: RequerimientosQueryDto, @Req() req: any) {
    return this.service.findAll(
      req.user.organizationId,
      req.user.id,
      req.user.role,
      query,
    )
  }

  @Get('resumen')
  @ApiOperation({ summary: 'Conteo por estado para las tarjetas' })
  resumen(@Req() req: any) {
    return this.service.resumen(req.user.organizationId, req.user.id, req.user.role)
  }

  @Get(':id')
  @ApiOperation({ summary: 'Ficha del requerimiento' })
  findOne(@Param('id') id: string, @Req() req: any) {
    return this.service.findOne(id, req.user.organizationId, req.user.id, req.user.role)
  }

  @Post()
  @ApiOperation({ summary: 'Registrar un requerimiento' })
  create(@Body() dto: CreateRequerimientoDto, @Req() req: any) {
    return this.service.create(dto, req.user.organizationId, req.user.id, req.user.role)
  }

  @Post(':id/notas')
  @ApiOperation({ summary: 'Agregar una nota a la bitácora del requerimiento' })
  agregarNota(@Param('id') id: string, @Body() dto: { contenido: string }, @Req() req: any) {
    return this.service.agregarNota(
      id,
      dto?.contenido,
      req.user.organizationId,
      req.user.id,
      req.user.role,
    )
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Editar un requerimiento' })
  update(@Param('id') id: string, @Body() dto: UpdateRequerimientoDto, @Req() req: any) {
    return this.service.update(id, dto, req.user.organizationId, req.user.id, req.user.role)
  }
  @Get(':id/datos-bienvenida')
  @ApiOperation({ summary: 'Datos que van en la carta, para revisarlos antes de enviar' })
  datosBienvenida(@Param('id') id: string, @Req() req: any) {
    return this.service.datosBienvenida(
      id,
      req.user.organizationId,
      req.user.id,
      req.user.role,
    )
  }

  @Post(':id/enviar-bienvenida')
  @ApiOperation({ summary: 'Envía el correo de bienvenida al cliente' })
  enviarBienvenida(@Param('id') id: string, @Req() req: any) {
    return this.service.enviarBienvenida(
      id,
      req.user.organizationId,
      req.user.id,
      req.user.role,
    )
  }


  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar (solo jefe de operaciones y admin)' })
  remove(@Param('id') id: string, @Req() req: any) {
    return this.service.remove(id, req.user.organizationId, req.user.id, req.user.role)
  }
}
