import { Module } from '@nestjs/common'
import { RequerimientosController } from './requerimientos.controller'
import { RequerimientosService } from './requerimientos.service'

@Module({
  controllers: [RequerimientosController],
  providers: [RequerimientosService],
  exports: [RequerimientosService],
})
export class RequerimientosModule {}
