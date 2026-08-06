import { IsString, IsOptional, IsNumber, IsIn } from 'class-validator'
import { Type } from 'class-transformer'
import { ApiProperty } from '@nestjs/swagger'

const ESTADOS = [
  'POR_RENOVAR',
  'ENVIAR',
  'ENVIADO',
  'EN_PROCESO',
  'RENOVADO_PAGO_PENDIENTE',
  'RENOVADO',
]
const ENVIOS = ['NO_ENVIADO', 'PRIMER_ENVIO', 'SEGUNDO_ENVIO']

export class UpdateRenovacionDto {
  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  fechaRenovacion?: string

  @ApiProperty({ required: false })
  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  valorActual?: number

  @ApiProperty({ required: false })
  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  valorRenovacion?: number

  @ApiProperty({ required: false })
  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  diferidoEspecial?: number

  @ApiProperty({ required: false, enum: ESTADOS })
  @IsIn(ESTADOS)
  @IsOptional()
  estado?: string

  @ApiProperty({ required: false, enum: ENVIOS })
  @IsIn(ENVIOS)
  @IsOptional()
  envio?: string

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  comentarios?: string

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  ejecutivoId?: string
}
