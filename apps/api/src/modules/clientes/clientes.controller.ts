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
import { ClientesService } from './clientes.service'
import { ClientesQueryDto } from './dto/clientes-query.dto'
import { CreateClienteDto } from './dto/create-cliente.dto'
import { UpdateClienteDto } from './dto/update-cliente.dto'
import { CreatePolizaDto } from './dto/create-poliza.dto'

// Base de clientes del área de Operaciones.
// Todas las rutas exigen sesión iniciada. El filtro por ejecutiva vive en el
// service (servidor), no en la UI: una ejecutiva no puede ver clientes ajenos
// aunque llame al endpoint directamente.
@ApiTags('Clientes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('clientes')
export class ClientesController {
  constructor(private readonly clientesService: ClientesService) {}

  @Get()
  @ApiOperation({ summary: 'Lista de clientes (paginada, con búsqueda y filtros)' })
  findAll(@Query() query: ClientesQueryDto, @Req() req: any) {
    return this.clientesService.findAll(
      req.user.organizationId,
      req.user.id,
      req.user.role,
      query,
    )
  }

  @Get(':id')
  @ApiOperation({ summary: 'Ficha completa: datos, pólizas y dependientes' })
  findOne(@Param('id') id: string, @Req() req: any) {
    return this.clientesService.findOne(id, req.user.organizationId, req.user.id, req.user.role)
  }

  @Post()
  @ApiOperation({ summary: 'Crear un cliente nuevo' })
  create(@Body() dto: CreateClienteDto, @Req() req: any) {
    return this.clientesService.create(dto, req.user.organizationId, req.user.id, req.user.role)
  }

  @Post(':id/polizas')
  @ApiOperation({ summary: 'Agregar una póliza a un cliente existente' })
  crearPoliza(@Param('id') id: string, @Body() dto: CreatePolizaDto, @Req() req: any) {
    return this.clientesService.crearPoliza(
      id,
      dto,
      req.user.organizationId,
      req.user.id,
      req.user.role,
    )
  }

  @Delete(':id/polizas/:polizaId')
  @ApiOperation({ summary: 'Eliminar una póliza del cliente' })
  eliminarPoliza(
    @Param('id') id: string,
    @Param('polizaId') polizaId: string,
    @Req() req: any,
  ) {
    return this.clientesService.eliminarPoliza(
      id,
      polizaId,
      req.user.organizationId,
      req.user.id,
      req.user.role,
    )
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar datos del cliente' })
  update(@Param('id') id: string, @Body() dto: UpdateClienteDto, @Req() req: any) {
    return this.clientesService.update(
      id,
      dto,
      req.user.organizationId,
      req.user.id,
      req.user.role,
    )
  }
}
