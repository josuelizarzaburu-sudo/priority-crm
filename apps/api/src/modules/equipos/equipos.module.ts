import { Module } from '@nestjs/common'
import { EquiposController } from './equipos.controller'
import { EquiposService } from './equipos.service'

@Module({
  controllers: [EquiposController],
  providers: [EquiposService],
  // Lo exporta para que PipelineModule pueda acotar las consultas al equipo del
  // jefe sin duplicar la logica de quien pertenece a que equipo.
  exports: [EquiposService],
})
export class EquiposModule {}
