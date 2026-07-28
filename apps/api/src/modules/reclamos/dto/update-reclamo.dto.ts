import { PartialType } from '@nestjs/swagger'
import { CreateReclamoDto } from './create-reclamo.dto'

export class UpdateReclamoDto extends PartialType(CreateReclamoDto) {}
