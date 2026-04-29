import { IsString, IsNumber, IsOptional, IsObject, Min } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

export class CreateDealDto {
  @ApiProperty()
  @IsString()
  title!: string

  @ApiProperty()
  @IsString()
  stageId!: string

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  contactId?: string

  @ApiProperty({ required: false })
  @IsNumber()
  @Min(0)
  @IsOptional()
  value?: number

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  currency?: string = 'USD'

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  assignedToId?: string

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  expectedCloseDate?: string

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  notes?: string

  @ApiProperty({ required: false })
  @IsOptional()
  @IsObject()
  customFields?: Record<string, unknown>
}
