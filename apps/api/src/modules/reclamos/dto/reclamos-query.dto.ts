import { IsString, IsOptional, IsInt, Min, Max } from 'class-validator'
import { Type } from 'class-transformer'
import { ApiProperty } from '@nestjs/swagger'

export class ReclamosQueryDto {
  // Busca por cliente, paciente, diagnóstico o número de liquidación.
  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  search?: string

  @ApiProperty({ required: false, enum: ['EN_TRAMITE', 'LIQUIDADO', 'NEGADO', 'DEVUELTO'] })
  @IsString()
  @IsOptional()
  estado?: string

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
