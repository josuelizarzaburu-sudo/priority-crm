import { IsString, IsNotEmpty, IsIn } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

export class LogActivityDto {
  @ApiProperty({ enum: ['NOTE', 'CALL', 'EMAIL', 'MEETING', 'TASK'] })
  @IsIn(['NOTE', 'CALL', 'EMAIL', 'MEETING', 'TASK'])
  type!: string

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  description!: string
}
