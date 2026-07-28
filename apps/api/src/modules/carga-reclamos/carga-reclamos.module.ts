import { Module } from '@nestjs/common'
import { CargaReclamosController } from './carga-reclamos.controller'
import { CargaReclamosService } from './carga-reclamos.service'

@Module({
  controllers: [CargaReclamosController],
  providers: [CargaReclamosService],
})
export class CargaReclamosModule {}
