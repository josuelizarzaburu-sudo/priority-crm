import { URL_COTIZADOR } from './prompt'

/**
 * Ultima red de seguridad de la regla de precios.
 *
 * El prompt ya lo prohibe, pero un prompt no es garantia. Si el modelo
 * igual suelta algo que parece una prima, se corta antes de que llegue al
 * asesor: es preferible una respuesta bloqueada a un precio inventado.
 *
 * Se bloquea un VALOR de prima, no la palabra "prima". Decir "hay 8% de
 * descuento sobre la prima neta" es informacion comercial permitida;
 * decir "la prima es de $85" no lo es.
 */
const SOSPECHOSOS: RegExp[] = [
  // "prima/tarifa mensual de $85" o "... seria 1.200 dolares"
  /\b(prima|tarifa)\s+(mensual|anual|neta)\b[^.\n]{0,30}(\$\s?[\d.,]+|\b[\d.,]{2,}\s*(dolares|d[oó]lares|usd))/i,
  /(\$\s?[\d.,]+|\b[\d.,]{2,}\s*(dolares|d[oó]lares|usd))[^.\n]{0,30}\b(de\s+)?(prima|tarifa)\b/i,
  /\b(cuesta|costaria|costar[ií]a|vale|precio\s+es)\b[^.\n]{0,40}\$\s?\d/i,
  /\$\s?[\d.,]+\s*(al|por)\s*mes\b/i,
  /\b\d+[\d.,]*\s*(dolares|d[oó]lares|usd)\s*(mensuales|al mes|por mes)\b/i,
]

export function pareceUnPrecio(texto: string): boolean {
  return SOSPECHOSOS.some((r) => r.test(texto))
}

export const RESPUESTA_SIN_PRECIO = [
  'No puedo dar precios ni estimarlos.',
  '',
  `Para el valor exacto usa el cotizador del CRM (${URL_COTIZADOR}), que está validado contra las hojas oficiales de cada aseguradora.`,
  '',
  'Si quieres, pregúntame por coberturas, carencias, exclusiones o comparaciones entre planes.',
].join('\n')
