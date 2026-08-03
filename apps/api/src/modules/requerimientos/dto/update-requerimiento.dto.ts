import { PartialType } from '@nestjs/swagger'
import { CreateRequerimientoDto } from './create-requerimiento.dto'

export class UpdateRequerimientoDto extends PartialType(CreateRequerimientoDto) {}
