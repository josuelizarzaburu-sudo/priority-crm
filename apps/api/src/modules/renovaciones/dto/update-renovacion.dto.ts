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
const FORMAS_PAGO = ['CONTADO', 'MENSUAL', 'DIFERIDO', 'DIFERIDO_ESPECIAL']

export class UpdateRenovacionDto {
  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  fechaRenovacion?: string

  /**
   * Forma de pago. Vive en la póliza, no en la renovación, pero se puede
   * corregir desde aquí: cambia justo al renovar y es un dato que sale en el
   * correo al cliente.
   */
  @ApiProperty({ required: false, enum: FORMAS_PAGO })
  @IsIn(FORMAS_PAGO)
  @IsOptional()
  formaPago?: string

  /**
   * Plan y deducible viven en la POLIZA, no en la renovacion, pero se corrigen
   * desde aqui: son —con la forma de pago— los tres datos que cambian al
   * renovar, y guardarlos deja la poliza lista para el año siguiente.
   */
  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  plan?: string

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  deducible?: string

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
