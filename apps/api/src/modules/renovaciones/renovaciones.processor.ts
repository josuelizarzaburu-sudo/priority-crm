import { InjectQueue, Process, Processor } from '@nestjs/bull'
import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { Queue, Job } from 'bull'
import { RenovacionesService } from './renovaciones.service'

export const COLA_RENOVACIONES = 'renovaciones-programadas'
const TAREA = 'enviar-programadas'

/**
 * Revisa cada 2 minutos si hay renovaciones cuya hora de envío ya llegó.
 *
 * Empezó en 10 minutos por ahorro, pero el efecto práctico era malo: se programa
 * para las 9:25, llegan las 9:27 y no ha salido nada, así que parece roto. Dos
 * minutos es margen suficiente para no dudar y sigue siendo una consulta trivial
 * —solo mira si hay alguna con la hora cumplida.
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
        repeat: { cron: '*/2 * * * *', tz: 'America/Guayaquil' },
        removeOnComplete: true,
        removeOnFail: false,
      },
    )
    this.logger.log('Revisión de renovaciones programadas — cada 2 minutos')
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
