/**
 * Aseguradoras de vehículos y sus planes.
 *
 * El plan depende de la aseguradora: "FULL" existe en Atlántida pero no en
 * Zurich, y ofrecer todos juntos lleva a cotizar planes que no existen.
 *
 * Todas dejan escribir un plan que no esté en la lista: las aseguradoras cambian
 * su oferta y esperar a que alguien actualice el código bloquearía una venta.
 */
export const ASEGURADORAS_VEHICULO: { nombre: string; planes: string[] }[] = [
  { nombre: 'ATLÁNTIDA', planes: ['BÁSICO', 'MEDIO', 'FULL'] },
  { nombre: 'SWEADEN', planes: ['NORMAL', 'PLUS', 'ULTRA'] },
  { nombre: 'AIG', planes: ['AIG FULL COBERTURA', 'AIG PÉRDIDA TOTAL'] },
  { nombre: 'ZURICH', planes: ['TAILOR MADE', 'BASIC'] },
  // Latina no tiene planes fijos: se escribe el que corresponda.
  { nombre: 'LATINA', planes: [] },
]

/** Planes de una aseguradora, como venga escrita. */
export function planesDe(aseguradora: string | null | undefined): string[] {
  const a = (aseguradora ?? '')
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
  const encontrada = ASEGURADORAS_VEHICULO.find((x) =>
    a.includes(x.nombre.normalize('NFD').replace(/[\u0300-\u036f]/g, '')),
  )
  return encontrada?.planes ?? []
}

/** Formas de pago que se usan en vehículos. */
export const FORMAS_PAGO_VEHICULO = [
  'CONTADO',
  'TARJETA DE CRÉDITO',
  'DÉBITO BANCARIO',
  'DIFERIDO SIN INTERESES',
]
