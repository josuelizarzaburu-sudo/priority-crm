import { IsArray, IsIn, IsNotEmpty, IsOptional, IsString, ValidateNested, ArrayMinSize } from 'class-validator'
import { Type } from 'class-transformer'
import { ApiProperty } from '@nestjs/swagger'

export class ChatMessageDto {
  @ApiProperty({ enum: ['user', 'assistant'] })
  @IsIn(['user', 'assistant'])
  role!: 'user' | 'assistant'

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  content!: string
}

export class ChatDto {
  @ApiProperty({ type: [ChatMessageDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ChatMessageDto)
  messages!: ChatMessageDto[]

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  sessionId?: string
}
