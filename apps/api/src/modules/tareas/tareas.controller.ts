import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query, Req, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { TareasService } from './tareas.service'

// Ojo: la API usa forbidNonWhitelisted, asi que cualquier campo no declarado
// aqui tumba TODA la peticion con 400.

const PRIORIDADES = ['ALTA', 'MEDIA', 'BAJA']

export class CreateTareaDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  titulo!: string

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  detalle?: string

  @IsOptional()
  @IsIn(PRIORIDADES)
  prioridad?: string

  /** Día en formato YYYY-MM-DD. */
  @IsOptional()
  @IsString()
  fechaLimite?: string

  /** Si no viene, la tarea es para uno mismo. */
  @IsOptional()
  @IsString()
  asignadoId?: string

  @IsOptional()
  @IsString()
  clienteId?: string

  /** Pasos de la tarea, en orden. */
  @IsOptional()
  subpuntos?: string[]
}

export class UpdateTareaDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  titulo?: string

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  detalle?: string

  @IsOptional()
  @IsIn(PRIORIDADES)
  prioridad?: string

  @IsOptional()
  @IsString()
  fechaLimite?: string | null

  @IsOptional()
  @IsString()
  asignadoId?: string

  @IsOptional()
  @IsString()
  clienteId?: string | null
}

@ApiTags('Tareas')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('tareas')
export class TareasController {
  constructor(private readonly service: TareasService) {}

  @Get()
  @ApiOperation({ summary: 'Tareas visibles para el usuario actual' })
  findAll(
    @Req() req: any,
    @Query('asignadoId') asignadoId?: string,
    @Query('incluirCompletadas') incluirCompletadas?: string,
  ) {
    return this.service.findAll(req.user.organizationId, req.user.id, req.user.role, {
      asignadoId,
      incluirCompletadas,
    })
  }

  @Post()
  @ApiOperation({ summary: 'Crear una tarea, propia o asignada a alguien' })
  create(@Body() dto: CreateTareaDto, @Req() req: any) {
    return this.service.create(dto, req.user.organizationId, req.user.id, req.user.role)
  }

  @Patch('subpuntos/:id/hecho')
  @ApiOperation({ summary: 'Marca o desmarca un paso de la tarea' })
  alternarSubpunto(@Param('id') id: string, @Req() req: any) {
    return this.service.alternarSubpunto(
      id,
      req.user.organizationId,
      req.user.id,
      req.user.role,
    )
  }

  @Put(':id/subpuntos')
  @ApiOperation({ summary: 'Reemplaza los pasos de la tarea' })
  guardarSubpuntos(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    return this.service.guardarSubpuntos(
      id,
      body?.subpuntos ?? [],
      req.user.organizationId,
      req.user.id,
      req.user.role,
    )
  }

  @Patch(':id/completada')
  @ApiOperation({ summary: 'Marca o desmarca la tarea como hecha' })
  alternar(@Param('id') id: string, @Req() req: any) {
    return this.service.alternarCompletada(id, req.user.organizationId, req.user.id, req.user.role)
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Editar o reasignar una tarea' })
  update(@Param('id') id: string, @Body() dto: UpdateTareaDto, @Req() req: any) {
    return this.service.update(id, dto, req.user.organizationId, req.user.id, req.user.role)
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar una tarea' })
  remove(@Param('id') id: string, @Req() req: any) {
    return this.service.remove(id, req.user.organizationId, req.user.id, req.user.role)
  }
}
