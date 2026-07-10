import { IsString, IsEmail, IsOptional, IsEnum, IsNotEmpty, IsBoolean, ValidateNested } from 'class-validator'
import { Transform, Type } from 'class-transformer'
import { ApiProperty } from '@nestjs/swagger'

export class AutoDataDto {
  @ApiProperty({ required: false }) @IsOptional() @IsString() marca?: string | null
  @ApiProperty({ required: false }) @IsOptional() @IsString() modelo?: string | null
  @ApiProperty({ required: false }) @IsOptional() @IsString() anio?: string | null
  @ApiProperty({ required: false }) @IsOptional() @IsString() placa?: string | null
  @ApiProperty({ required: false }) @IsOptional() @IsString() ciudad?: string | null
  @ApiProperty({ required: false }) @IsOptional() @IsString() nombrePropietario?: string | null
  @ApiProperty({ required: false }) @IsOptional() @IsString() cedulaRuc?: string | null
  @ApiProperty({ required: false }) @IsOptional() @IsString() edad?: string | null
  @ApiProperty({ required: false }) @IsOptional() @IsString() estadoCivil?: string | null
  @ApiProperty({ required: false }) @IsOptional() @IsString() sexo?: string | null
}

export enum InsuranceType {
  SALUD = 'SALUD',
  AUTO = 'AUTO',
}

export enum LeadSource {
  WEB = 'WEB',
  WHATSAPP = 'WHATSAPP',
  CALL = 'CALL',
  LANDING_PAGE = 'landing_page',
  CHAT_WEB = 'CHAT_WEB',
}

export class IngestLeadDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  firstName!: string

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  lastName?: string

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  phone!: string

  @ApiProperty({ required: false })
  @IsEmail()
  @IsOptional()
  email?: string

  @ApiProperty({ enum: InsuranceType })
  @IsEnum(InsuranceType)
  insuranceType!: InsuranceType

  @ApiProperty({ enum: LeadSource, required: false })
  @IsEnum(LeadSource)
  @IsOptional()
  source?: LeadSource = LeadSource.WEB

  @ApiProperty({ required: false, description: 'Practica deporte regularmente' })
  @Transform(({ value }) => {
    if (value === undefined || value === null) return undefined
    return value === true || value === 'true'
  })
  @IsBoolean()
  @IsOptional()
  sport?: boolean

  @ApiProperty({ required: false, description: 'Tiene seguro actual' })
  @Transform(({ value }) => {
    if (value === undefined || value === null) return undefined
    return value === true || value === 'true'
  })
  @IsBoolean()
  @IsOptional()
  insured?: boolean

  @ApiProperty({ required: false, description: 'Tipo de perfil calculado (A/B/C/D) — ignorado, el backend lo recalcula' })
  @IsString()
  @IsOptional()
  profileType?: string

  @ApiProperty({ required: false, description: 'Notas o comentarios adicionales del lead' })
  @IsString()
  @IsOptional()
  notes?: string

  @ApiProperty({ required: false, description: 'Datos del vehículo para cotización de auto' })
  @IsOptional()
  @ValidateNested()
  @Type(() => AutoDataDto)
  autoData?: AutoDataDto
}
