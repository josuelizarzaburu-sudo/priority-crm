import { IsString, IsOptional, IsIn, IsArray, IsNumber } from 'class-validator'
import { Type } from 'class-transformer'
import { ApiProperty } from '@nestjs/swagger'

const TIPOS = ['SALUD', 'AUTO', 'VIDA', 'HOGAR']
const ESTADOS = ['NUEVO', 'RENOVADO', 'CARTA_DE_NOMBRAMIENTO', 'CANCELADA']
const PAGOS = ['CONTADO', 'MENSUAL', 'DIFERIDO', 'DIFERIDO_ESPECIAL']

export class CreatePolizaDto {
  @ApiProperty({ enum: TIPOS })
  @IsIn(TIPOS)
  tipo!: string

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  numeroContrato?: string

  @ApiProperty({ required: false, enum: ESTADOS })
  @IsIn(ESTADOS)
  @IsOptional()
  estado?: string

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  aseguradora?: string

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  plan?: string

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  deducible?: string

  @ApiProperty({ required: false, enum: PAGOS })
  @IsIn(PAGOS)
  @IsOptional()
  formaPago?: string

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  fechaEmision?: string

  @ApiProperty({ required: false })
  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  primaNeta?: number

  @ApiProperty({ required: false })
  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  sumaAsegurada?: number

  // ── Solo AUTO ──
  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  marca?: string

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  modelo?: string

  @ApiProperty({ required: false })
  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  anio?: number

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  placa?: string

  // ── Solo VIDA ──
  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  tiempoCobertura?: string

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  observacion?: string

  /**
   * Quien vendio la poliza.
   *
   * Van los dos campos: el NOMBRE siempre, y el id solo cuando esa persona
   * tiene usuario en el CRM. Hay ventas de asesores que ya no estan y nunca
   * tuvieron acceso, y si solo se guardara el id esas ventas quedarian sin
   * dueno.
   */
  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  agenteNombre?: string

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  agenteId?: string

  // Ids de los dependientes del cliente que esta poliza cubre (solo SALUD).
  @ApiProperty({ required: false, type: [String] })
  @IsArray()
  @IsOptional()
  dependienteIds?: string[]
}
