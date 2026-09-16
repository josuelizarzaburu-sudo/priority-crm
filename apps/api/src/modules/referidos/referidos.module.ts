import { Module } from '@nestjs/common'
import { ReferidosController } from './referidos.controller'
import { ReferidosService } from './referidos.service'
import { LeadsModule } from '../leads/leads.module'

@Module({
  imports: [LeadsModule],
  controllers: [ReferidosController],
  providers: [ReferidosService],
  exports: [ReferidosService],
})
export class ReferidosModule {}
