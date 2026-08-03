import { IsString, IsOptional, IsInt, Min, Max } from 'class-validator'
import { Type } from 'class-transformer'
import { ApiProperty } from '@nestjs/swagger'

export class RequerimientosQueryDto {
  // Busca por cliente, paciente o el detalle del requerimiento.
  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  search?: string

  @ApiProperty({ required: false, enum: ['EN_TRAMITE', 'MAS_INFORMACION', 'SOLUCIONADO'] })
  @IsString()
  @IsOptional()
  estado?: string

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  tipo?: string

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  aseguradora?: string

  // Solo jefes/admin: ver los de una ejecutiva concreta.
  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  ejecutivoId?: string

  @ApiProperty({ required: false, default: 1 })
  @IsInt()
  @Min(1)
  @Type(() => Number)
  @IsOptional()
  page?: number = 1

  @ApiProperty({ required: false, default: 25 })
  @IsInt()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  @IsOptional()
  limit?: number = 25
}
