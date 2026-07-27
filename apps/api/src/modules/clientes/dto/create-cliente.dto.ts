import {
  IsString,
  IsOptional,
  IsEmail,
  IsEnum,
  IsArray,
  ValidateNested,
  IsDateString,
  IsNumber,
} from 'class-validator'
import { Type } from 'class-transformer'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { Genero, Parentesco } from '@prisma/client'

export class CreateDependienteDto {
  @ApiProperty()
  @IsString()
  nombres!: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  apellidos?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  identificacion?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  fechaNacimiento?: string

  @ApiPropertyOptional({ enum: Parentesco })
  @IsOptional()
  @IsEnum(Parentesco)
  parentesco?: Parentesco
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

  @ApiPropertyOptional({ enum: Genero })
  @IsOptional()
  @IsEnum(Genero)
  genero?: Genero

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  fechaNacimiento?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  telefono?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  celular?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  ciudad?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  direccion?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notas?: string

  // Solo lo usa un jefe/admin; para OPERACIONES el servidor lo ignora.
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  ejecutivoId?: string

  @ApiPropertyOptional({ type: [CreateDependienteDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateDependienteDto)
  dependientes?: CreateDependienteDto[]
}
