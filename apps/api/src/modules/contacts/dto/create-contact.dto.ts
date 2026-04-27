import { IsString, IsEmail, IsOptional, IsEnum } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'
import { ContactStatus } from '@priority-crm/shared'

export class CreateContactDto {
  @ApiProperty()
  @IsString()
  firstName!: string

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  lastName?: string

  @ApiProperty({ required: false })
  @IsEmail()
  @IsOptional()
  email?: string

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  phone?: string

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  company?: string

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  position?: string

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  assignedToId?: string

  @ApiProperty({ enum: ContactStatus, required: false })
  @IsEnum(ContactStatus)
  @IsOptional()
  status?: ContactStatus
}
