import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { IsBoolean, IsOptional, IsString, MaxLength, MinLength, ValidateIf } from 'class-validator'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { EquiposService } from './equipos.service'

// Ojo: la API usa forbidNonWhitelisted, asi que cualquier campo que no este
// declarado aqui tumba TODA la peticion con 400. Si se agrega un campo al
// formulario, hay que declararlo tambien en el DTO.

export class CreateEquipoDto {
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  nombre!: string

  @IsString()
  jefeId!: string
}

export class UpdateEquipoDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  nombre?: string

  @IsOptional()
  @IsString()
  jefeId?: string

  @IsOptional()
  @IsBoolean()
  activo?: boolean
}

export class AsignarMiembroDto {
  /** null saca a la persona de su equipo actual sin ponerla en otro. */
  @ValidateIf((_, valor) => valor !== null)
  @IsString()
  equipoId!: string | null
}

@ApiTags('Equipos')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('equipos')
export class EquiposController {
  constructor(private readonly service: EquiposService) {}

  @Get()
  @ApiOperation({ summary: 'Equipos con su jefe y sus miembros' })
  findAll(@Req() req: any) {
    return this.service.findAll(req.user.organizationId, req.user.role)
  }

  @Post()
  @ApiOperation({ summary: 'Crear un equipo' })
  create(@Body() dto: CreateEquipoDto, @Req() req: any) {
    return this.service.create(dto, req.user.organizationId, req.user.role)
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Renombrar un equipo, cambiar su jefe o desactivarlo' })
  update(@Param('id') id: string, @Body() dto: UpdateEquipoDto, @Req() req: any) {
    return this.service.update(id, dto, req.user.organizationId, req.user.role)
  }

  @Patch('miembros/:userId')
  @ApiOperation({ summary: 'Mover a una persona de equipo (equipoId null la deja sin equipo)' })
  asignarMiembro(@Param('userId') userId: string, @Body() dto: AsignarMiembroDto, @Req() req: any) {
    return this.service.asignarMiembro(userId, dto.equipoId, req.user.organizationId, req.user.role)
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Desactivar un equipo (no se borra, para no perder el historial)' })
  remove(@Param('id') id: string, @Req() req: any) {
    return this.service.remove(id, req.user.organizationId, req.user.role)
  }
}
