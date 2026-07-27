import { PartialType, OmitType } from '@nestjs/swagger'
import { CreateClienteDto } from './create-cliente.dto'

// Todos los campos opcionales. Se excluye `dependientes`: se gestionan
// en sus propios endpoints para no borrar/recrear en cada edición.
export class UpdateClienteDto extends PartialType(
  OmitType(CreateClienteDto, ['dependientes'] as const),
) {}
