import { IsString, IsOptional, IsEnum, IsInt, Min } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'
import { TrainingCategory } from '@prisma/client'

export class CreateTrainingVideoDto {
  @ApiProperty()
  @IsString()
  title!: string

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  description?: string

  @ApiProperty()
  @IsString()
  youtubeUrl!: string

  @ApiProperty({ enum: TrainingCategory })
  @IsEnum(TrainingCategory)
  category!: TrainingCategory

  @ApiProperty({ required: false })
  @IsInt()
  @Min(1)
  @IsOptional()
  durationMinutes?: number
}
