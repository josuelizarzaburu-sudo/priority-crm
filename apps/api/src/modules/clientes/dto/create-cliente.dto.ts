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
