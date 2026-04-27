import { IsString, IsNotEmpty } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

export class AssignDealDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  agentId!: string
}
