import { IsString, IsOptional, IsIn } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

const ESTADOS = ['EN_TRAMITE', 'MAS_INFORMACION', 'SOLUCIONADO']
const TIPOS = [
  'DATOS_FACTURACION',
  'CAMBIO_FORMA_PAGO',
  'CAMBIO_DEDUCIBLE',
  'ACTUALIZACION_DATOS',
  'INCLUSION_DEPENDIENTES',
  'EXCLUSION_DEPENDIENTES',
  'CANCELACION',
  'COTIZACION',
  'PRE_NOTIFICACION',
  'OTROS',
]

export class CreateRequerimientoDto {
  // Si viene, el requerimiento queda enlazado al cliente del CRM.
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

  @ApiProperty({ required: false, enum: TIPOS })
  @IsIn(TIPOS)
  @IsOptional()
  tipo?: string

  /** Solo cuando tipo = OTROS. */
  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  tipoOtro?: string

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  requerimiento?: string

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
  fechaEnvioCliente?: string

  @ApiProperty({ required: false, enum: ESTADOS })
  @IsIn(ESTADOS)
  @IsOptional()
  estado?: string

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  observaciones?: string

  // Solo jefes/admin pueden asignárselo a otra persona.
  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  ejecutivoId?: string
}
