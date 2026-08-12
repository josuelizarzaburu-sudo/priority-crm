import { InjectQueue, Process, Processor } from '@nestjs/bull'
import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { Queue, Job } from 'bull'
import { CorreosAutomaticosService } from './correos-automaticos.service'

export const COLA_CORREOS = 'correos-automaticos'
const TAREA_DIARIA = 'cumpleanos-diario'

/**
 * Programa la revision diaria de cumpleaños.
 *
 * Se usa un trabajo repetible de Bull y NO un cron en memoria a proposito: si
 * Railway llegara a correr dos instancias de la API, un cron normal se
 * ejecutaria en las dos y cada cliente recibiria el saludo por duplicado. Bull
 * coordina por Redis, asi que solo una instancia lo procesa.
 *
 * (Aun asi, la tabla correos_automaticos garantiza que nunca se envie dos veces,
 * incluso si algo se ejecutara repetido. Son dos defensas independientes.)
 */
@Injectable()
export class CorreosAutomaticosScheduler implements OnModuleInit {
  private readonly logger = new Logger(CorreosAutomaticosScheduler.name)

  constructor(@InjectQueue(COLA_CORREOS) private readonly cola: Queue) {}

  async onModuleInit() {
    // Se limpian las programaciones anteriores antes de registrar la nueva. Sin
    // esto, cambiar la hora dejaria la programacion vieja viva en Redis y la
    // tarea correria dos veces al dia.
    const repetibles = await this.cola.getRepeatableJobs()
    for (const r of repetibles) {
      if (r.name === TAREA_DIARIA) await this.cola.removeRepeatableByKey(r.key)
    }

    await this.cola.add(
      TAREA_DIARIA,
      {},
      {
        // 9:00 AM hora de Ecuador. La zona se declara explicitamente porque el
        // servidor de Railway corre en UTC: sin esto saldrian a las 4 AM.
        repeat: { cron: '0 9 * * *', tz: 'America/Guayaquil' },
        removeOnComplete: true,
        removeOnFail: false,
      },
    )
    this.logger.log('Revisión diaria de cumpleaños programada — 9:00 AM (America/Guayaquil)')
  }
}

@Processor(COLA_CORREOS)
export class CorreosAutomaticosProcessor {
  private readonly logger = new Logger(CorreosAutomaticosProcessor.name)

  constructor(private readonly service: CorreosAutomaticosService) {}

  @Process(TAREA_DIARIA)
  async procesarCumpleanos(_job: Job): Promise<void> {
    const resultados = await this.service.procesarCumpleanosTodasLasOrganizaciones()
    for (const r of resultados) {
      this.logger.log(
        `${r.fecha} — ${r.total} cumpleañero(s), ${r.enviados.length} enviado(s), ` +
          `${r.omitidos.length} omitido(s), ${r.fallidos.length} fallido(s)` +
          (r.simulado ? ' [MODO PRUEBA]' : ''),
      )
    }
  }
}
