/**
 * Reglas de alcance de los equipos comerciales.
 *
 * Todo lo relacionado con "que puede ver y tocar un jefe de equipo" vive aqui, en
 * vez de repartido por los servicios. Es la leccion del bug de comisiones: cuando
 * las comprobaciones estan sueltas por el codigo, agregar un rol nuevo hace que
 * herede accesos que nadie decidio darle.
 */

/** Origen de un lead. Se guarda en `customFields.leadOrigin` del deal. */
export type LeadOrigin = 'PRIORITY_HEALTH' | 'PRIORITY' | 'PROPIO'

/**
 * Origenes que pertenecen a la empresa y por lo tanto se pueden repartir.
 *
 * - PRIORITY_HEALTH: entra por la web y las campanas.
 * - PRIORITY: lo sube el jefe de equipo por Excel. Son los leads que Pablo le
 *   entrega para que los divida entre su gente.
 */
export const ORIGENES_REPARTIBLES: LeadOrigin[] = ['PRIORITY_HEALTH', 'PRIORITY']

/** Los tres origenes que acepta el sistema. */
export const ORIGENES_VALIDOS: LeadOrigin[] = ['PRIORITY_HEALTH', 'PRIORITY', 'PROPIO']

/**
 * Lee el origen de un deal, tolerando datos viejos.
 *
 * Los deals creados antes de que existiera el campo no lo tienen. Se asume
 * PRIORITY_HEALTH porque en esa epoca todos los leads eran de la empresa: el
 * origen PROPIO se agrego despues. Asumir PROPIO por defecto seria peor, porque
 * volveria historico intocable e imposible de repartir.
 */
export function origenDeLead(customFields: unknown): LeadOrigin {
  const origen = (customFields as { leadOrigin?: string } | null)?.leadOrigin
  if (origen === 'PROPIO') return 'PROPIO'
  if (origen === 'PRIORITY') return 'PRIORITY'
  return 'PRIORITY_HEALTH'
}

/**
 * ¿Este lead se puede reasignar a otra persona?
 *
 * REGLA QUE NO SE ROMPE: un lead PROPIO es del vendedor que lo consiguio. Ni el
 * jefe, ni una carga masiva, ni nadie puede quitarselo. Si se pudiera, el
 * vendedor perderia el incentivo de traer clientes por su cuenta.
 */
export function sePuedeReasignar(customFields: unknown): boolean {
  return ORIGENES_REPARTIBLES.includes(origenDeLead(customFields))
}

/**
 * ¿El rol ve unicamente lo de su equipo?
 *
 * Gerencia (SUPER_ADMIN, OWNER, MANAGER) sigue viendo toda la empresa: los
 * equipos son una capa que se agrega debajo, no una que recorte hacia arriba.
 */
export function veSoloSuEquipo(role: string): boolean {
  return role === 'JEFE_EQUIPO'
}

/**
 * Construye el filtro de Prisma para acotar deals al equipo de un jefe.
 *
 * Incluye al propio jefe ademas de sus miembros, porque el jefe tambien vende y
 * sus negocios cuentan en el total del equipo.
 *
 * Si el jefe todavia no tiene equipo asignado, `miembrosIds` llega vacio y solo
 * se ve a si mismo. Es lo correcto: sin equipo no hay a quien supervisar, y
 * devolver todo seria abrirle la empresa entera por un dato faltante.
 */
export function filtroDeEquipo(jefeId: string, miembrosIds: string[]) {
  return { assignedToId: { in: [...new Set([jefeId, ...miembrosIds])] } }
}
