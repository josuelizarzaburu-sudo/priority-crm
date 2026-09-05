import { IsString, IsOptional, IsArray, ValidateNested, IsIn } from 'class-validator'
import { Type } from 'class-transformer'
import { ApiProperty } from '@nestjs/swagger'

const GENEROS = ['MASCULINO', 'FEMENINO', 'OTRO']
const PARENTESCOS = ['CONYUGE', 'HIJO', 'HIJA', 'PADRE', 'MADRE', 'HERMANO', 'HERMANA', 'OTRO']

export class CreateDependienteDto {
  @ApiProperty()
  @IsString()
  nombres!: string

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  apellidos?: string

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  identificacion?: string

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  fechaNacimiento?: string

  @ApiProperty({ required: false, enum: PARENTESCOS })
  @IsIn(PARENTESCOS)
  @IsOptional()
  parentesco?: string
}

export class CreateClienteDto {
  @ApiProperty()
  @IsString()
  nombres!: string

  @ApiProperty()
  @IsString()
  apellidos!: string

  @ApiProperty()
  @IsString()
  identificacion!: string

  @ApiProperty({ required: false, enum: GENEROS })
  @IsIn(GENEROS)
  @IsOptional()
  genero?: string

  /**
   * Si traia un seguro anterior, y de cual. Lo captura el comercial en el lead,
   * pero se puede corregir desde la ficha: a veces llega vacio o el cliente lo
   * aclara despues.
   */
  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  vieneDeOtroSeguro?: string

  /**
   * Empresa del cliente corporativo. Va en el CLIENTE y no en la poliza porque
   * se busca por ahi: "que clientes tengo de tal empresa".
   */
  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  empresa?: string

  @ApiProperty({ required: false, enum: ['INDIVIDUAL', 'CORPORATIVO'] })
  @IsIn(['INDIVIDUAL', 'CORPORATIVO'])
  @IsOptional()
  tipoCliente?: string

  /** Quien vendio: nombre libre, porque hay agentes historicos sin usuario. */
  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  agenteNombre?: string

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  fechaNacimiento?: string

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  email?: string

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  telefono?: string

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  celular?: string

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  ciudad?: string

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  direccion?: string

  // Estos tres ya existían en el modelo Cliente y el formulario los enviaba, pero
  // faltaba declararlos acá: como la API valida con forbidNonWhitelisted, cualquier
  // campo no declarado hace fallar la creación entera.
  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  nombrePreferido?: string

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  contactoSugerido?: string

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  referidoDe?: string

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  notas?: string

  // Solo lo usa un jefe/admin; para OPERACIONES el servidor lo ignora.
  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  ejecutivoId?: string

  @ApiProperty({ required: false, type: [CreateDependienteDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateDependienteDto)
  @IsOptional()
  dependientes?: CreateDependienteDto[]
}
