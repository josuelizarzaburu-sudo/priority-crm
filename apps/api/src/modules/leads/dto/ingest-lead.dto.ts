import { IsString, IsEmail, IsOptional, IsEnum, IsNotEmpty } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

export enum InsuranceType {
  SALUD = 'SALUD',
  AUTO = 'AUTO',
}

export enum LeadSource {
  WEB = 'WEB',
  WHATSAPP = 'WHATSAPP',
  CALL = 'CALL',
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
}
