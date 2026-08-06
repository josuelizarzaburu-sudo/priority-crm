import { IsString, IsOptional, IsInt, Min, Max } from 'class-validator'
import { Type } from 'class-transformer'
import { ApiProperty } from '@nestjs/swagger'

export class RenovacionesQueryDto {
  // Busca por nombre, apellido, cédula, aseguradora o plan.
  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  search?: string

  /**
   * Mes a mostrar, formato "2027-05". Es el filtro clave: la ejecutiva trabaja
   * las renovaciones de agosto durante julio, así que necesita adelantarse.
   */
  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  mes?: string

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  estado?: string

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  aseguradora?: string

  @ApiProperty({ required: false, default: 1 })
  @IsInt()
  @Min(1)
  @Type(() => Number)
  @IsOptional()
  page?: number = 1

  @ApiProperty({ required: false, default: 50 })
  @IsInt()
  @Min(1)
  @Max(200)
  @Type(() => Number)
  @IsOptional()
  limit?: number = 50
}
