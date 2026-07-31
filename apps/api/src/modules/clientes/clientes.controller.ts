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
import { RegistroAccesoService, ACCESO } from '../registro-acceso/registro-acceso.service'
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
  constructor(
    private readonly clientesService: ClientesService,
    private readonly registro: RegistroAccesoService,
  ) {}

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
  async findOne(@Param('id') id: string, @Req() req: any) {
    const ficha = await this.clientesService.findOne(
      id,
      req.user.organizationId,
      req.user.id,
      req.user.role,
    )
    // Queda rastro de quien abrio la ficha. Va despues de findOne para no
    // registrar accesos a fichas que el usuario no tenia permitido ver (findOne
    // lanza si no le corresponde).
    await this.registro.registrar({
      organizationId: req.user.organizationId,
      usuarioId: req.user.id,
      usuarioNombre: req.user.name ?? null,
      usuarioRol: req.user.role,
      accion: ACCESO.VER_FICHA_CLIENTE,
      objetoTipo: 'Cliente',
      objetoId: id,
      detalle: (ficha as any)?.nombres
        ? `${(ficha as any).nombres} ${(ficha as any).apellidos ?? ''}`.trim()
        : undefined,
    })
    return ficha
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

  @Patch(':id/ejecutiva')
  @ApiOperation({
    summary: 'Cambiar la ejecutiva asignada (solo jefe de operaciones y admin)',
  })
  cambiarEjecutiva(
    @Param('id') id: string,
    @Body() dto: { ejecutivoId: string; motivo: string },
    @Req() req: any,
  ) {
    return this.clientesService.cambiarEjecutiva(
      id,
      dto?.ejecutivoId,
      dto?.motivo,
      req.user.organizationId,
      req.user.id,
      req.user.role,
    )
  }

  @Post(':id/notas')
  @ApiOperation({ summary: 'Agregar una nota a la bitácora del cliente' })
  agregarNota(@Param('id') id: string, @Body() dto: { contenido: string }, @Req() req: any) {
    return this.clientesService.agregarNota(
      id,
      dto?.contenido,
      req.user.organizationId,
      req.user.id,
      req.user.role,
    )
  }

  @Post(':id/dependientes')
  @ApiOperation({ summary: 'Agregar un dependiente al cliente' })
  agregarDependiente(@Param('id') id: string, @Body() dto: any, @Req() req: any) {
    return this.clientesService.agregarDependiente(
      id,
      dto,
      req.user.organizationId,
      req.user.id,
      req.user.role,
    )
  }

  @Delete(':id/dependientes/:dependienteId')
  @ApiOperation({ summary: 'Eliminar un dependiente' })
  eliminarDependiente(
    @Param('id') id: string,
    @Param('dependienteId') dependienteId: string,
    @Req() req: any,
  ) {
    return this.clientesService.eliminarDependiente(
      id,
      dependienteId,
      req.user.organizationId,
      req.user.id,
      req.user.role,
    )
  }

  @Patch(':id/polizas/:polizaId')
  @ApiOperation({ summary: 'Editar una póliza del cliente' })
  actualizarPoliza(
    @Param('id') id: string,
    @Param('polizaId') polizaId: string,
    @Body() dto: any,
    @Req() req: any,
  ) {
    return this.clientesService.actualizarPoliza(
      id,
      polizaId,
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
