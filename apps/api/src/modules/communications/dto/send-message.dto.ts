import { IsString, IsOptional, IsEnum } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

export class SendMessageDto {
  @ApiProperty()
  @IsString()
  content!: string

  @ApiProperty({ required: false, default: 'TEXT' })
  @IsEnum(['TEXT', 'IMAGE', 'DOCUMENT', 'AUDIO', 'VIDEO'])
  @IsOptional()
  type?: string

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  subject?: string
}
