import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PrismaService } from '../../prisma/prisma.service'
import { NotificationsService } from '../notifications/notifications.service'

/** Zona horaria de la empresa. Todo el calculo de "hoy" se hace contra esta. */
const ZONA = 'America/Guayaquil'

export const TIPO_CUMPLEANOS = 'CUMPLEANOS'

/**
 * Devuelve el dia de hoy en Ecuador como 'YYYY-MM-DD'.
 *
 * Se calcula con Intl y no con toISOString() porque toISOString() da la fecha en
 * UTC: a las 21:00 de Ecuador ya seria el dia siguiente, y felicitariamos a la
 * gente equivocada.
 */
export function hoyEnEcuador(ahora = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(ahora)
}

/**
 * Dia y mes de nacimiento, leidos en UTC.
 *
 * fechaNacimiento se guarda como fecha sin hora (medianoche UTC), asi que hay
 * que leerla en UTC. Si se leyera en hora local, alguien nacido un dia 1
 * aparecería como del ultimo dia del mes anterior. Es el mismo error que ya
 * corregimos en la lista de Renovaciones.
 */
function diaMesDeNacimiento(fecha: Date): { dia: number; mes: number } {
  return { dia: fecha.getUTCDate(), mes: fecha.getUTCMonth() + 1 }
}

/** ¿El año de esta fecha 'YYYY-MM-DD' es bisiesto? */
function esBisiesto(fechaISO: string): boolean {
  const a = Number(fechaISO.slice(0, 4))
  return (a % 4 === 0 && a % 100 !== 0) || a % 400 === 0
}

/**
 * ¿A este cliente le toca su saludo hoy?
 *
 * El caso especial es el 29 de febrero: quien nace ese dia solo cumple cada
 * cuatro años, asi que en los años normales se le felicita el 28. Sin esta
 * regla, esas personas no recibirian saludo casi nunca.
 */
export function cumpleHoy(nacimiento: Date, hoyISO: string): boolean {
  const { dia, mes } = diaMesDeNacimiento(nacimiento)
  const mesHoy = Number(hoyISO.slice(5, 7))
  const diaHoy = Number(hoyISO.slice(8, 10))

  if (mes === mesHoy && dia === diaHoy) return true

  // Nacido el 29 de febrero, y hoy es 28 de febrero de un año no bisiesto.
  if (mes === 2 && dia === 29 && mesHoy === 2 && diaHoy === 28 && !esBisiesto(hoyISO)) {
    return true
  }
  return false
}

/** Un correo con formato razonable. No valida que exista, solo que no sea basura. */
export function correoUtilizable(email: string | null | undefined): email is string {
  if (!email) return false
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())
}

/**
 * Como saludar al cliente.
 *
 * Se prefiere nombrePreferido: si alguien pidio que le digan "Pepe", un correo
 * que diga "Estimado Jose Luis" delata que lo escribio una maquina.
 */
export function saludoPara(cliente: { nombres: string; nombrePreferido: string | null }): string {
  const preferido = cliente.nombrePreferido?.trim()
  if (preferido) return preferido
  // Solo el primer nombre: "Maria Jose Andrade" -> "Maria".
  return cliente.nombres.trim().split(/\s+/)[0] ?? cliente.nombres
}

@Injectable()
export class CorreosAutomaticosService {
  private readonly logger = new Logger(CorreosAutomaticosService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly notifications: NotificationsService,
  ) {}

  /**
   * MODO PRUEBA.
   *
   * Por defecto NO se envia nada: se calcula a quien le tocaria y se registra.
   * Hay que poner CORREOS_AUTOMATICOS_ENVIAR=true de forma explicita para que
   * salgan de verdad.
   *
   * El default es deliberado. Con 1.500 clientes, un error en las fechas o en
   * los correos se multiplica por 1.500 y lo descubre el cliente, no nosotros.
   * Conviene dejarlo simulando una semana, revisar a quien habria escrito, y
   * recien ahi activarlo.
   */
  private get envioReal(): boolean {
    return this.config.get<string>('CORREOS_AUTOMATICOS_ENVIAR') === 'true'
  }

  /**
   * Clientes a los que les toca saludo hoy.
   *
   * El filtrado del dia se hace en memoria y no en SQL porque comparar dia y mes
   * ignorando el año no es directo en Prisma. Con 1.500 clientes traer solo los
   * que tienen fecha y correo es barato; si algun dia son cientos de miles, esto
   * habria que pasarlo a una consulta SQL con EXTRACT.
   */
  async cumpleanerosDeHoy(organizationId: string, hoyISO = hoyEnEcuador()) {
    const candidatos = await this.prisma.cliente.findMany({
      where: {
        organizationId,
        fechaNacimiento: { not: null },
        email: { not: null },
      },
      select: {
        id: true,
        nombres: true,
        apellidos: true,
        nombrePreferido: true,
        email: true,
        fechaNacimiento: true,
      },
    })

    return candidatos.filter(
      (c) =>
        c.fechaNacimiento &&
        correoUtilizable(c.email) &&
        cumpleHoy(c.fechaNacimiento, hoyISO),
    )
  }

  /**
   * Procesa los saludos de cumpleaños del dia.
   *
   * Devuelve un resumen para poder revisar que habria hecho sin mirar los logs.
   */
  async procesarCumpleanos(organizationId: string, hoyISO = hoyEnEcuador()) {
    const clientes = await this.cumpleanerosDeHoy(organizationId, hoyISO)
    const simulado = !this.envioReal

    this.logger.log(
      `Cumpleaños ${hoyISO}: ${clientes.length} cliente(s)` +
        (simulado ? ' — MODO PRUEBA, no se envía nada' : ''),
    )

    const enviados: string[] = []
    const omitidos: string[] = []
    const fallidos: string[] = []

    for (const cliente of clientes) {
      // Se reserva el envio ANTES de mandarlo. Si otra ejecucion ya lo reservo,
      // el indice unico lo rechaza y se salta. Asi, aunque la tarea corra dos
      // veces, el cliente recibe un solo correo.
      try {
        await this.prisma.correoAutomatico.create({
          data: {
            clienteId: cliente.id,
            tipo: TIPO_CUMPLEANOS,
            fecha: hoyISO,
            destinatario: cliente.email!,
            simulado,
            organizationId,
          },
        })
      } catch {
        omitidos.push(cliente.email!)
        this.logger.log(`Ya se le había escrito hoy, se omite: ${cliente.email}`)
        continue
      }

      if (simulado) {
        this.logger.log(`[PRUEBA] Se le escribiría a ${cliente.email} (${cliente.nombres})`)
        enviados.push(cliente.email!)
        continue
      }

      try {
        await this.notifications.enviarCorreoCumpleanos({
          email: cliente.email!,
          saludo: saludoPara(cliente),
        })
        enviados.push(cliente.email!)
      } catch (err) {
        // Un fallo no debe frenar a los demas cumpleañeros del dia.
        const mensaje = err instanceof Error ? err.message : String(err)
        fallidos.push(cliente.email!)
        this.logger.error(`Falló el envío a ${cliente.email}: ${mensaje}`)
        await this.prisma.correoAutomatico.updateMany({
          where: { clienteId: cliente.id, tipo: TIPO_CUMPLEANOS, fecha: hoyISO },
          data: { error: mensaje.slice(0, 500) },
        })
      }
    }

    return { fecha: hoyISO, simulado, total: clientes.length, enviados, omitidos, fallidos }
  }

  /** Todas las organizaciones, para la tarea diaria. */
  async procesarCumpleanosTodasLasOrganizaciones(hoyISO = hoyEnEcuador()) {
    const orgs = await this.prisma.organization.findMany({ select: { id: true } })
    const resultados = []
    for (const org of orgs) {
      resultados.push(await this.procesarCumpleanos(org.id, hoyISO))
    }
    return resultados
  }
}
