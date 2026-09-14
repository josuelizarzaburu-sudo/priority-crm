import { InjectQueue, Process, Processor } from '@nestjs/bull'
import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { Queue, Job } from 'bull'
import { RenovacionesService } from './renovaciones.service'

export const COLA_RENOVACIONES = 'renovaciones-programadas'
const TAREA = 'enviar-programadas'

/**
 * Revisa cada 10 minutos si hay renovaciones cuya hora de envío ya llegó.
 *
 * Diez minutos es un punto medio deliberado: la ejecutiva programa para "mañana
 * a las 9", no para las 9:00:00 exactas, así que un margen de minutos no cambia
 * nada. Revisar cada minuto sería consultar la base 1.440 veces al día para algo
 * que pasa unas pocas veces al mes.
 *
 * Se usa un trabajo repetible de Bull y no un cron en memoria por lo mismo que
 * en cumpleaños: si Railway corre dos instancias, un cron normal se ejecutaría
 * en las dos y el cliente recibiría el correo por duplicado. Bull coordina por
 * Redis.
 */
@Injectable()
export class RenovacionesScheduler implements OnModuleInit {
  private readonly logger = new Logger(RenovacionesScheduler.name)

  constructor(@InjectQueue(COLA_RENOVACIONES) private readonly cola: Queue) {}

  async onModuleInit() {
    // Se limpian las programaciones anteriores: sin esto, cambiar la frecuencia
    // dejaría la vieja viva en Redis y la tarea correría dos veces.
    const repetibles = await this.cola.getRepeatableJobs()
    for (const r of repetibles) {
      if (r.name === TAREA) await this.cola.removeRepeatableByKey(r.key)
    }

    await this.cola.add(
      TAREA,
      {},
      {
        repeat: { cron: '*/10 * * * *', tz: 'America/Guayaquil' },
        removeOnComplete: true,
        removeOnFail: false,
      },
    )
    this.logger.log('Revisión de renovaciones programadas — cada 10 minutos')
  }
}

@Processor(COLA_RENOVACIONES)
export class RenovacionesProcessor {
  private readonly logger = new Logger(RenovacionesProcessor.name)

  constructor(private readonly service: RenovacionesService) {}

  @Process(TAREA)
  async procesar(_job: Job): Promise<void> {
    const r = await this.service.enviarProgramadas()
    // Solo se escribe cuando hubo algo que hacer: una línea cada 10 minutos
    // diciendo "nada que enviar" ahogaría los registros útiles.
    if (r.revisadas > 0) {
      this.logger.log(`Renovaciones programadas: ${r.enviadas} de ${r.revisadas} enviadas`)
    }
  }
}
