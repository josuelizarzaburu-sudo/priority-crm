import { IsString, IsOptional, IsInt, Min, Max } from 'class-validator'
import { Type } from 'class-transformer'
import { ApiProperty } from '@nestjs/swagger'

export class ClientesQueryDto {
  // Busca por nombre, apellido, cedula, correo, celular o por un dependiente.
  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  search?: string

  // 'true' para ver solo los clientes marcados con datos por revisar.
  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  revisar?: string

  // Solo jefes/admin: filtrar por una ejecutiva concreta.
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
