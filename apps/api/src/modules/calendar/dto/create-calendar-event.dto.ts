import { IsString, IsOptional, IsArray, IsDateString, IsEnum } from 'class-validator'
import { CalendarEventModality } from '@prisma/client'

export class CreateCalendarEventDto {
  @IsString()
  title!: string

  @IsString()
  @IsOptional()
  description?: string

  @IsDateString()
  startAt!: string

  @IsDateString()
  @IsOptional()
  endAt?: string

  @IsString()
  @IsOptional()
  givenBy?: string

  @IsEnum(CalendarEventModality)
  @IsOptional()
  modality?: CalendarEventModality

  @IsString()
  @IsOptional()
  meetingLink?: string

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  participantIds?: string[]
}
