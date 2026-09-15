import { Module } from '@nestjs/common'
import { ReferidosController } from './referidos.controller'
import { ReferidosService } from './referidos.service'

@Module({
  controllers: [ReferidosController],
  providers: [ReferidosService],
  exports: [ReferidosService],
})
export class ReferidosModule {}
