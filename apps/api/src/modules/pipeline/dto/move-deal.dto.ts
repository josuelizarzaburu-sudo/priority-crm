import { IsString, IsNumber } from 'class-validator'

export class MoveDealDto {
  @IsString()
  stageId!: string

  @IsNumber()
  position!: number
}
