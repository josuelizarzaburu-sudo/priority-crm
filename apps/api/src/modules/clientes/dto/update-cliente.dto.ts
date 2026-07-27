import { PartialType } from '@nestjs/swagger'
import { CreateClienteDto } from './create-cliente.dto'

// Todos los campos opcionales. El service ignora `dependientes` aqui:
// se gestionan por separado para no borrarlos/recrearlos en cada edicion.
export class UpdateClienteDto extends PartialType(CreateClienteDto) {}
