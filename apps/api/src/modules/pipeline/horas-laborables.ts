/**
 * Horas laborables, para medir el plazo de gestion de un lead.
 *
 * Un lead asignado el viernes a las 6 de la tarde no se puede castigar el sabado
 * a esa hora: nadie estaba trabajando. Por eso el reloj se pausa fuera del
 * horario y se reanuda al siguiente tramo habil.
 *
 * Horario (acordado con Josue, ajustable en un solo lugar):
 *   Lunes a viernes  09:00 - 18:00  (9 h)
 *   Sabado           09:00 - 13:00  (4 h)
 *   Domingo          no cuenta
 */

export const HORARIO: Record<number, { desde: number; hasta: number }> = {
  0: { desde: 0, hasta: 0 }, // domingo
  1: { desde: 9, hasta: 18 },
  2: { desde: 9, hasta: 18 },
  3: { desde: 9, hasta: 18 },
  4: { desde: 9, hasta: 18 },
  5: { desde: 9, hasta: 18 },
  6: { desde: 9, hasta: 13 }, // sabado
}

/** Plazo por defecto para dar la primera gestion a un lead asignado. */
export const HORAS_PLAZO_GESTION = 24

const MS_HORA = 3600000

/** Horas laborables transcurridas entre dos fechas. */
export function horasLaborables(desde: Date, hasta: Date): number {
  if (hasta <= desde) return 0

  let total = 0
  // Se avanza dia por dia sumando solo el tramo habil que cae dentro del rango.
  const cursor = new Date(desde.getFullYear(), desde.getMonth(), desde.getDate())

  // Tope de seguridad: 400 dias. Evita un bucle infinito con fechas corruptas.
  for (let i = 0; i < 400; i++) {
    if (cursor > hasta) break

    const h = HORARIO[cursor.getDay()]
    if (h.hasta > h.desde) {
      const inicioJornada = new Date(cursor)
      inicioJornada.setHours(h.desde, 0, 0, 0)
      const finJornada = new Date(cursor)
      finJornada.setHours(h.hasta, 0, 0, 0)

      // Interseccion entre la jornada y el rango que se esta midiendo
      const ini = desde > inicioJornada ? desde : inicioJornada
      const fin = hasta < finJornada ? hasta : finJornada
      if (fin > ini) total += (fin.getTime() - ini.getTime()) / MS_HORA
    }

    cursor.setDate(cursor.getDate() + 1)
  }

  return total
}

/** Suma horas laborables a una fecha; sirve para saber cuando vence el plazo. */
export function sumarHorasLaborables(desde: Date, horas: number): Date {
  let restantes = horas
  const cursor = new Date(desde)

  for (let i = 0; i < 400 && restantes > 0; i++) {
    const h = HORARIO[cursor.getDay()]
    if (h.hasta > h.desde) {
      const finJornada = new Date(cursor)
      finJornada.setHours(h.hasta, 0, 0, 0)
      const inicioJornada = new Date(cursor)
      inicioJornada.setHours(h.desde, 0, 0, 0)

      // Si el cursor cae antes de abrir, el reloj arranca al abrir.
      const ini = cursor < inicioJornada ? inicioJornada : cursor
      if (ini < finJornada) {
        const disponibles = (finJornada.getTime() - ini.getTime()) / MS_HORA
        if (disponibles >= restantes) {
          return new Date(ini.getTime() + restantes * MS_HORA)
        }
        restantes -= disponibles
      }
    }
    // Al dia siguiente, arrancando a la hora de apertura
    cursor.setDate(cursor.getDate() + 1)
    cursor.setHours(0, 0, 0, 0)
  }

  return cursor
}
