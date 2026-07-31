import { Global, Module } from '@nestjs/common'
import { RegistroAccesoService } from './registro-acceso.service'
import { RegistroAccesoController } from './registro-acceso.controller'

// Global para poder inyectarlo en clientes, reclamos y reportes sin importarlo
// en cada modulo. El registro de acceso es transversal a todo el sistema.
@Global()
@Module({
  controllers: [RegistroAccesoController],
  providers: [RegistroAccesoService],
  exports: [RegistroAccesoService],
})
export class RegistroAccesoModule {}
