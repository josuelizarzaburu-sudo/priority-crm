/**
 * Niveles del programa de referidos.
 *
 * Adaptado de lo que hace funcionar a Vitality: no basta con acumular puntos,
 * tiene que haber una CATEGORÍA visible y un siguiente escalón cerca. Ver
 * "te faltan 2 para Plata" mueve más que ver "tienes 30 puntos".
 *
 * Los cortes son por referidos cerrados y no por puntos, porque es lo que el
 * referidor controla: sabe cuántas personas ha traído, no cuántos puntos suman.
 */
export interface Nivel {
  id: string
  nombre: string
  desde: number
  color: string
  fondo: string
  /** Lo que gana de más al llegar aquí. Vacío en el primero. */
  beneficio?: string
}

export const NIVELES: Nivel[] = [
  {
    id: 'bronce',
    nombre: 'Bronce',
    desde: 0,
    color: '#8B5A2B',
    fondo: '#FBF0E4',
  },
  {
    id: 'plata',
    nombre: 'Plata',
    desde: 3,
    color: '#5A6472',
    fondo: '#F1F3F6',
    beneficio: 'Acceso a los premios de 50 puntos',
  },
  {
    id: 'oro',
    nombre: 'Oro',
    desde: 8,
    color: '#A67C00',
    fondo: '#FDF6E3',
    beneficio: 'Premios grandes y sorteos del mes',
  },
  {
    id: 'platino',
    nombre: 'Platino',
    desde: 15,
    color: '#0C2057',
    fondo: '#EEF1F8',
    beneficio: 'El mejor catálogo y prioridad en la atención',
  },
]

/** El nivel que le corresponde según cuántos referidos cerró. */
export function nivelDe(cerrados: number): Nivel {
  // Se recorre al revés para quedarse con el más alto que alcanzó.
  return [...NIVELES].reverse().find((n) => cerrados >= n.desde) ?? NIVELES[0]
}

/** El siguiente nivel y cuánto falta. Null si ya está en el más alto. */
export function siguienteNivel(cerrados: number): { nivel: Nivel; faltan: number } | null {
  const proximo = NIVELES.find((n) => n.desde > cerrados)
  return proximo ? { nivel: proximo, faltan: proximo.desde - cerrados } : null
}

/**
 * Cuánto lleva recorrido hacia el siguiente nivel, de 0 a 1.
 *
 * Sirve para la barra de progreso. En el último nivel devuelve 1: ya está
 * completo y la barra llena es la señal correcta.
 */
export function progresoNivel(cerrados: number): number {
  const actual = nivelDe(cerrados)
  const proximo = NIVELES.find((n) => n.desde > cerrados)
  if (!proximo) return 1

  const recorrido = cerrados - actual.desde
  const tramo = proximo.desde - actual.desde
  return Math.max(0, Math.min(1, recorrido / tramo))
}
