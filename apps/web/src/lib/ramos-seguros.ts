// Ramos y aseguradoras para capturar la venta en el CRM comercial.
//
// Los valores de RAMO son EXACTAMENTE los del enum TipoPoliza del CRM operativo
// (SALUD / AUTO / VIDA / HOGAR). Es a propósito: cuando el deal ganado cruza al
// operativo, la póliza se crea con este mismo valor sin traducir nada en medio.
//
// Las aseguradoras salen del catálogo real de comparativos, no de una lista
// inventada. Para VIDA y HOGAR todavía no hay catálogo cargado, así que el campo
// deja escribir libre (ver ASEGURADORA_LIBRE abajo).

export type RamoId = 'SALUD' | 'AUTO' | 'VIDA' | 'HOGAR'

export const RAMOS: { id: RamoId; label: string }[] = [
  { id: 'SALUD', label: 'Salud' },
  { id: 'AUTO', label: 'Vehículo' },
  { id: 'VIDA', label: 'Vida' },
  { id: 'HOGAR', label: 'Hogar' },
]

export const RAMO_LABEL: Record<RamoId, string> = {
  SALUD: 'Salud',
  AUTO: 'Vehículo',
  VIDA: 'Vida',
  HOGAR: 'Hogar',
}

// Sugerencias por ramo. El campo NO obliga a elegir una de estas: se puede
// escribir cualquier otra, porque el catálogo todavía no cubre vida ni hogar.
export const ASEGURADORAS_POR_RAMO: Record<RamoId, string[]> = {
  // Salud nacional + internacional (BMI Ideal/Support, BestDoctors)
  SALUD: ['BMI', 'Humana', 'Confiamed', 'Saludsa', 'Bupa', 'BestDoctors', 'Ecuasanitas'],
  AUTO: ['Atlántida', 'Zurich', 'Sweaden', 'AIG'],
  VIDA: [],
  HOGAR: [],
}

/** Ramos donde todavía no hay catálogo y se escribe la aseguradora a mano. */
export const ASEGURADORA_LIBRE: RamoId[] = ['VIDA', 'HOGAR']

// ── Campos propios de cada ramo ────────────────────────────────────────────
// Coinciden con los campos por ramo que ya tiene el modelo Poliza del operativo.

export interface DatosVehiculo {
  marca?: string
  modelo?: string
  anio?: string
  placa?: string
}

export interface DatosSumaAsegurada {
  sumaAsegurada?: string
}

/** Un ramo pide datos del vehículo solo si es AUTO. */
export const pideDatosVehiculo = (ramo: RamoId) => ramo === 'AUTO'

/** Vida y hogar se cotizan por suma asegurada. */
export const pideSumaAsegurada = (ramo: RamoId) => ramo === 'VIDA' || ramo === 'HOGAR'
