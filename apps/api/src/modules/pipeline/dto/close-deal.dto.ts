import { IsString, IsOptional, IsIn } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

export class CloseDealDto {
  @ApiProperty({ enum: ['WON', 'LOST'] })
  @IsIn(['WON', 'LOST'])
  status!: string

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  closingReason?: string
}
