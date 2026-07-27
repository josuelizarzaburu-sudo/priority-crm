import { Module } from '@nestjs/common'
import { ResetComercialController } from './reset-comercial.controller'
import { ResetComercialService } from './reset-comercial.service'

@Module({
  controllers: [ResetComercialController],
  providers: [ResetComercialService],
})
export class ResetComercialModule {}
