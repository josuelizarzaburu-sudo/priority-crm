import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { PriorityHelpController } from './priority-help.controller'
import { PriorityHelpService } from './priority-help.service'
import { KbLoader } from './kb.loader'

/**
 * Priority Help: apoyo a la venta para asesores internos.
 *
 * Modulo aparte a proposito. No se mete dentro de ChatModule (prio-chat,
 * que captura leads del sitio publico) ni dentro de AiModule: son
 * propositos distintos y mezclar los prompts degrada a los dos.
 */
@Module({
  imports: [ConfigModule],
  controllers: [PriorityHelpController],
  providers: [PriorityHelpService, KbLoader],
  exports: [PriorityHelpService],
})
export class PriorityHelpModule {}
