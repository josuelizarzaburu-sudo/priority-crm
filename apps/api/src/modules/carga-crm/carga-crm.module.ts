import { Module } from '@nestjs/common'
import { CargaCrmController } from './carga-crm.controller'
import { CargaCrmService } from './carga-crm.service'

@Module({
  controllers: [CargaCrmController],
  providers: [CargaCrmService],
})
export class CargaCrmModule {}
