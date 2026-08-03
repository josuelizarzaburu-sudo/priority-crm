// Tarifas Saludsa 2026 — planes del comparativo.
// Fuente: "Precios_SS.xlsx" (Precio Base 2026 Enero) + la hoja de cálculo interna
// que arma la cotización completa.
//
// A diferencia de Humana y BMI, Saludsa NO tiene una tarifa por cada edad: tiene
// UN precio base por plan que se multiplica por un factor según edad y sexo.
//
// VALIDADO al centavo contra dos fuentes:
//  1. Cotizador oficial (captura), hombre de 31 años, los 7 planes Star:
//     Star15 $45,17 · Star15-1500 $38,02 · Star15-2500 $35,92 · Star30 $64,51
//     Star30-1500 $54,49 · Star30-2500 $51,48 · Star30-5000 $48,49
//  2. Hoja de cálculo oficial (Precios_SS_v1), pareja de 31H + 30M:
//     Star15 mensual $110,06 · anual $1.320,76 · transferencia $1.188,68
//     · tarjeta $1.241,51 · cashback $265,13. Los 5 planes exactos.
//
// OJO con el descuento de 2 personas: la primera versión del archivo decía 2% y
// la corregida dice 3%. Vale la pena reconfirmarlo si Saludsa manda otra versión.
//
// Los precios base van SIN redondear a propósito: el cotizador oficial redondea
// solo al final, y usar el valor de dos dígitos desviaba los centavos.

export type SaludsaPlanId = 'star15' | 'star30' | 'sky50' | 'sky70' | 'pro150'

export const SALUDSA_PLAN_LABEL: Record<SaludsaPlanId, string> = {
  star15: 'Star 15K',
  star30: 'Star 30K',
  sky50: 'Sky 50K Plus',
  sky70: 'Sky 70K',
  pro150: 'Pro 150K',
}

/** Precio base mensual 2026 (enero), sin redondear. */
const PRECIO_BASE: Record<SaludsaPlanId, number> = {
  star15: 54.418598,
  star30: 77.714854,
  sky50: 97.274716,
  sky70: 114.44714,
  pro150: 172.655662,
}

export const SALUDSA_PLANES: SaludsaPlanId[] = ['star15', 'star30', 'sky50', 'sky70', 'pro150']

// ── Constantes del cálculo (leídas de la hoja oficial) ──
const GASTO_ADMIN = 2.36 // fijo POR PÓLIZA, no por persona
const SEGURO_CAMPESINO = 0.005 // 0,5%
const DESC_ANUAL_TRANSFERENCIA = 0.1 // 10%
const DESC_ANUAL_TARJETA = 0.06 // 6%
const CASHBACK_VITALITY = 0.2 // 20% del anual
const EDAD_MINIMA_CASHBACK = 18 // los menores no generan cashback

/** Descuento por número de personas en la póliza. */
function descuentoVolumen(n: number): number {
  if (n <= 1) return 0
  if (n === 2) return 0.03
  if (n === 3) return 0.05
  return 0.07 // 4 o más, tope
}

export type Sexo = 'M' | 'F'

export interface SaludsaPersona {
  edad: number
  sexo: Sexo
  /** Mujer sin cobertura de maternidad: paga el mismo factor que un hombre. */
  sinMaternidad?: boolean
}

/**
 * Factor que multiplica el precio base, según edad y sexo.
 *
 * `hayAdulto` cambia la tarifa de los niños: si el niño va SOLO paga 0,72; si va
 * acompañando a un adulto en la misma póliza, baja a 0,53.
 */
function factorPersona(p: SaludsaPersona, hayAdulto: boolean): number {
  const edad = Math.max(0, Math.round(p.edad))

  // Bebés hasta 23 meses: mismo factor para ambos sexos.
  if (edad < 2) return 1.26

  // Menores de 18: depende de si van acompañados de un adulto.
  if (edad < 18) return hayAdulto ? 0.53 : 0.72

  // Mujer sin maternidad paga como hombre.
  const comoHombre = p.sexo === 'M' || p.sinMaternidad === true

  if (edad <= 31) return comoHombre ? 0.83 : 1.2
  if (edad <= 49) return comoHombre ? 1.24 : 1.44
  if (edad <= 60) return comoHombre ? 1.65 : 1.7
  if (edad <= 65) return comoHombre ? 2.83 : 2.25
  if (edad <= 70) return comoHombre ? 5.5 : 4.1
  return comoHombre ? 6.44 : 4.59
}

export interface SaludsaResultadoPlan {
  plan: SaludsaPlanId
  label: string
  /** Suma de las primas antes de descuentos y cargos. */
  subtotal: number
  descuento: number
  mensual: number
  anual: number
  /** Anual pagando por transferencia (-10%). */
  anualTransferencia: number
  /** Anual pagando con tarjeta de crédito (-6%). */
  anualTarjeta: number
  /** Cashback Vitality estimado al año (20%, solo mayores de 18). */
  cashbackAnual: number
}

/** Cotiza un plan de Saludsa para un grupo de personas. */
export function cotizarSaludsaPlan(
  plan: SaludsaPlanId,
  personas: SaludsaPersona[],
): SaludsaResultadoPlan {
  const base = PRECIO_BASE[plan]
  const hayAdulto = personas.some((p) => Math.round(p.edad) >= 18)

  const subtotal = personas.reduce((s, p) => s + base * factorPersona(p, hayAdulto), 0)
  const descuento = subtotal * descuentoVolumen(personas.length)
  const conDescuento = subtotal - descuento
  const conGasto = conDescuento + GASTO_ADMIN
  const mensual = conGasto + conGasto * SEGURO_CAMPESINO
  const anual = mensual * 12

  // El cashback solo lo generan los mayores de 18, sobre su propia prima.
  const cashbackAnual =
    personas
      .filter((p) => Math.round(p.edad) >= EDAD_MINIMA_CASHBACK)
      .reduce((s, p) => s + base * factorPersona(p, hayAdulto), 0) *
    CASHBACK_VITALITY *
    12

  const r2 = (n: number) => Math.round(n * 100) / 100
  return {
    plan,
    label: SALUDSA_PLAN_LABEL[plan],
    subtotal: r2(subtotal),
    descuento: r2(descuento),
    mensual: r2(mensual),
    anual: r2(anual),
    anualTransferencia: r2(anual * (1 - DESC_ANUAL_TRANSFERENCIA)),
    anualTarjeta: r2(anual * (1 - DESC_ANUAL_TARJETA)),
    cashbackAnual: r2(cashbackAnual),
  }
}

/** Cotiza los 5 planes del comparativo de una sola vez. */
export function cotizarSaludsa(personas: SaludsaPersona[]): SaludsaResultadoPlan[] {
  if (personas.length === 0) return []
  return SALUDSA_PLANES.map((p) => cotizarSaludsaPlan(p, personas))
}
