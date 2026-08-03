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
import { ReclamosService } from './reclamos.service'
import { ReclamosQueryDto } from './dto/reclamos-query.dto'
import { CreateReclamoDto } from './dto/create-reclamo.dto'
import { UpdateReclamoDto } from './dto/update-reclamo.dto'

// Reclamos / reembolsos. El filtro por ejecutiva vive en el service (servidor),
// no en la UI: una ejecutiva no ve los reclamos de otra aunque llame directo.
@ApiTags('Reclamos')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('reclamos')
export class ReclamosController {
  constructor(private readonly service: ReclamosService) {}

  @Get()
  @ApiOperation({ summary: 'Lista de reclamos (paginada, con búsqueda y filtros)' })
  findAll(@Query() query: ReclamosQueryDto, @Req() req: any) {
    return this.service.findAll(req.user.organizationId, req.user.id, req.user.role, query)
  }

  @Get('resumen')
  @ApiOperation({ summary: 'Totales por estado y valor acumulado' })
  resumen(@Req() req: any) {
    return this.service.resumen(req.user.organizationId, req.user.id, req.user.role)
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalle de un reclamo' })
  findOne(@Param('id') id: string, @Req() req: any) {
    return this.service.findOne(id, req.user.organizationId, req.user.id, req.user.role)
  }

  @Post()
  @ApiOperation({ summary: 'Crear un reclamo' })
  create(@Body() dto: CreateReclamoDto, @Req() req: any) {
    return this.service.create(dto, req.user.organizationId, req.user.id, req.user.role)
  }

  @Post(':id/notas')
  @ApiOperation({ summary: 'Agregar una nota a la bitácora del reclamo' })
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
  @ApiOperation({ summary: 'Actualizar un reclamo' })
  update(@Param('id') id: string, @Body() dto: UpdateReclamoDto, @Req() req: any) {
    return this.service.update(id, dto, req.user.organizationId, req.user.id, req.user.role)
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar un reclamo (solo jefe de operaciones o admin)' })
  remove(@Param('id') id: string, @Req() req: any) {
    return this.service.remove(id, req.user.organizationId, req.user.id, req.user.role)
  }
}
