import { IsString, IsIn, IsOptional } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

export class LogInteractionDto {
  @ApiProperty({ enum: ['CALL', 'WHATSAPP', 'EMAIL', 'NOTE'] })
  @IsIn(['CALL', 'WHATSAPP', 'EMAIL', 'NOTE'])
  type!: string

  @ApiProperty({ enum: ['answered', 'no_answer', 'voicemail'], required: false })
  @IsIn(['answered', 'no_answer', 'voicemail'])
  @IsOptional()
  callResult?: string

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  description?: string
}
