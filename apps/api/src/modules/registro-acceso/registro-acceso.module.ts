import { Global, Module } from '@nestjs/common'
import { RegistroAccesoService } from './registro-acceso.service'

// Global para poder inyectarlo en clientes, reclamos y reportes sin importarlo
// en cada modulo. El registro de acceso es transversal a todo el sistema.
@Global()
@Module({
  providers: [RegistroAccesoService],
  exports: [RegistroAccesoService],
})
export class RegistroAccesoModule {}
