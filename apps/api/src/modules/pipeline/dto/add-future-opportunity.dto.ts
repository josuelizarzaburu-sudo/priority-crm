import { IsString, IsDateString, IsOptional, IsIn } from 'class-validator'

export class AddFutureOpportunityDto {
  @IsIn(['AUTO', 'VIDA', 'PATRIMONIO', 'SALUD'])
  insuranceType!: 'AUTO' | 'VIDA' | 'PATRIMONIO' | 'SALUD'

  @IsDateString()
  contactDate!: string

  @IsString()
  @IsOptional()
  note?: string
}
