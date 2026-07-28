import { Module } from '@nestjs/common'
import { ReclamosController } from './reclamos.controller'
import { ReclamosService } from './reclamos.service'

@Module({
  controllers: [ReclamosController],
  providers: [ReclamosService],
  exports: [ReclamosService],
})
export class ReclamosModule {}
