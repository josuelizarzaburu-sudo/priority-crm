import { IsString, IsNumber, IsOptional, IsArray } from 'class-validator'

export class MoveDealDto {
  @IsString()
  stageId!: string

  @IsNumber()
  position!: number

  @IsOptional()
  @IsArray()
  insuranceData?: Array<{
    netPremium: number
    plan: string
    paymentFrequency?: string
    issueDate?: string
    holderName?: string
    aseguradora?: string
  }>
}
