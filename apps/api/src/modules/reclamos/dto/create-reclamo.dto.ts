import { IsString, IsOptional, IsIn, IsNumber } from 'class-validator'
import { Type } from 'class-transformer'
import { ApiProperty } from '@nestjs/swagger'

const ESTADOS = ['EN_TRAMITE', 'LIQUIDADO', 'NEGADO', 'DEVUELTO']

export class CreateReclamoDto {
  // Si viene, el reclamo queda enlazado al cliente del CRM.
  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  clienteId?: string

  @ApiProperty()
  @IsString()
  clienteNombre!: string

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  pacienteNombre?: string

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  aseguradora?: string

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  contrato?: string

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  diagnostico?: string

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  fechaRecepcion?: string

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  fechaEnvioAseguradora?: string

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  liquidacion?: string

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  fechaLiquidacion?: string

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  fechaEnvioCliente?: string

  @ApiProperty({ required: false })
  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  valor?: number

  // Lo que la aseguradora termino liquidando, distinto del presentado.
  @ApiProperty({ required: false })
  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  valorLiquidado?: number

  @ApiProperty({ required: false, enum: ESTADOS })
  @IsIn(ESTADOS)
  @IsOptional()
  estado?: string

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  medioComunicacion?: string

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  observaciones?: string

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  detalle?: string

  // Solo jefes/admin pueden asignárselo a otra persona.
  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  ejecutivoId?: string
}
