import { IsOptional, IsString, IsInt, Min, Max, IsBooleanString } from 'class-validator'
import { Type } from 'class-transformer'
import { ApiPropertyOptional } from '@nestjs/swagger'

export class ClientesQueryDto {
  // Búsqueda libre: nombre, apellido, cédula, o nombre de un dependiente.
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1

  @ApiPropertyOptional({ default: 25 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 25

  // Filtro opcional: solo clientes marcados para revisar.
  @ApiPropertyOptional()
  @IsOptional()
  @IsBooleanString()
  revisar?: string

  // Solo jefes/admin: ver los clientes de una ejecutiva concreta.
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  ejecutivoId?: string
}
