import { Module } from '@nestjs/common'
import { PipelineController } from './pipeline.controller'
import { PipelineService } from './pipeline.service'
import { PipelineGateway } from './pipeline.gateway'
import { NotificationsModule } from '../notifications/notifications.module'
import { EquiposModule } from '../equipos/equipos.module'
import { ClientesModule } from '../clientes/clientes.module'

@Module({
  imports: [NotificationsModule, EquiposModule, ClientesModule],
  controllers: [PipelineController],
  providers: [PipelineService, PipelineGateway],
  exports: [PipelineService],
})
export class PipelineModule {}
