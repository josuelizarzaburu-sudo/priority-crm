import { IsString, IsNumber, IsOptional, IsObject } from 'class-validator'

export class MoveDealDto {
  @IsString()
  stageId!: string

  @IsNumber()
  position!: number

  @IsOptional()
  @IsObject()
  insuranceData?: {
    netPremium: number
    plan: string
    paymentFrequency?: string
    issueDate?: string
    holderName?: string
  }
}
