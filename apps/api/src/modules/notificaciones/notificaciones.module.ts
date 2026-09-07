import { Global, Module } from '@nestjs/common'
import { NotificacionesController } from './notificaciones.controller'
import { NotificacionesService } from './notificaciones.service'

// Global: cualquier modulo que provoque un aviso —tareas, renovaciones,
// requerimientos— necesita este servicio, y registrarlo en cada uno seria
// repetitivo y facil de olvidar.
@Global()
@Module({
  controllers: [NotificacionesController],
  providers: [NotificacionesService],
  exports: [NotificacionesService],
})
export class NotificacionesModule {}
