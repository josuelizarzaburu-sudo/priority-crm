import {
  IsArray,
  IsIn,
  IsNotEmpty,
  IsString,
  MaxLength,
  ValidateNested,
  ArrayMinSize,
  ArrayMaxSize,
} from 'class-validator'
import { Type } from 'class-transformer'
import { ApiProperty } from '@nestjs/swagger'

export class MensajeHelpDto {
  @ApiProperty({ enum: ['user', 'assistant'] })
  @IsIn(['user', 'assistant'])
  role!: 'user' | 'assistant'

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  content!: string
}

export class PriorityHelpDto {
  @ApiProperty({ type: [MensajeHelpDto] })
  @IsArray()
  @ArrayMinSize(1)
  // Corta hilos larguisimos: el historial completo encarece cada consulta
  // sin aportar, porque el contexto util son los ultimos turnos.
  @ArrayMaxSize(40)
  @ValidateNested({ each: true })
  @Type(() => MensajeHelpDto)
  messages!: MensajeHelpDto[]
}
