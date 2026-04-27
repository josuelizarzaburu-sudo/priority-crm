import { Module } from '@nestjs/common'
import { PipelineController } from './pipeline.controller'
import { PipelineService } from './pipeline.service'
import { PipelineGateway } from './pipeline.gateway'

@Module({
  controllers: [PipelineController],
  providers: [PipelineService, PipelineGateway],
  exports: [PipelineService],
})
export class PipelineModule {}
