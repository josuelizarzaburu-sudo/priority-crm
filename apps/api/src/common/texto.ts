/**
 * Normalización de texto de los datos del CRM.
 *
 * Los datos se guardan en MAYÚSCULAS para que las búsquedas, los reportes y los
 * listados sean consistentes: hoy conviven "Juan Perez", "JUAN PEREZ" y
 * "juan perez" como si fueran cosas distintas.
 *
 * OJO — esto es solo para GUARDAR. Cuando el dato sale hacia un cliente (correos
 * de bienvenida, renovación, cumpleaños) hay que suavizarlo con
 * `paraMostrarAlCliente`, o las cartas dirían "Estimado PABLO", que se lee como
 * un grito.
 */

/**
 * Campos que NO se pasan a mayúsculas, y por qué:
 *
 * - Correos: algunos servidores tratan distinto mayúsculas y minúsculas en la
 *   parte anterior a la arroba, así que convertirlos puede romper el envío.
 * - Textos largos (notas, observaciones, comentarios, descripciones): son
 *   párrafos; en mayúsculas se vuelven ilegibles.
 * - nombrePreferido: si el cliente pidió que le digan "Pepe", guardar "PEPE" y
 *   usarlo en un correo se ve peor que el problema que se quería resolver.
 * - Contraseñas y tokens: cambiarlos los invalida.
 * - URLs y rutas.
 */
const NO_CONVERTIR = new Set([
  'email',
  'correo',
  'correoTexto',
  'correoDestinatario',
  'password',
  'nombrePreferido',
  'notas',
  'nota',
  'contenido',
  'observaciones',
  'comentarios',
  'descripcion',
  'detalle',
  'requerimiento',
  'diagnostico',
  'preexistencias',
  'motivo',
  'revisarMotivo',
  'url',
  'link',
  'avatar',
  'meetingLink',
])

/** ¿Este campo se guarda en mayúsculas? */
export function seConvierte(campo: string): boolean {
  if (NO_CONVERTIR.has(campo)) return false
  // Cualquier cosa que parezca un correo o una contraseña, por si el campo se
  // llama distinto en otro módulo.
  const c = campo.toLowerCase()
  // 'correo' incluido: sin él, campos como correoEjecutiva o correoDestinatario
  // se convertirían y podrían romper el envío.
  if (c.includes('email') || c.includes('mail') || c.includes('correo')) return false
  if (c.includes('password') || c.includes('token') || c.includes('secret')) return false
  if (c.includes('url') || c.includes('link')) return false
  return true
}

/**
 * Pasa a mayúsculas los campos de texto de un objeto.
 *
 * Solo toca strings del primer nivel: los objetos anidados (customFields, por
 * ejemplo) se dejan tal cual, porque ahí viven datos con formato propio que
 * convertir a ciegas rompería.
 */
export function aMayusculas<T extends Record<string, any>>(datos: T): T {
  const salida: Record<string, any> = { ...datos }
  for (const [campo, valor] of Object.entries(salida)) {
    if (typeof valor !== 'string') continue
    if (!seConvierte(campo)) continue
    // toLocaleUpperCase('es') para que la ñ y los acentos se conviertan bien:
    // toUpperCase() a secas deja mal algunos caracteres en ciertos entornos.
    salida[campo] = valor.trim().toLocaleUpperCase('es-EC')
  }
  return salida as T
}

/**
 * Suaviza un texto guardado en mayúsculas para escribirlo en un correo.
 *
 * "PABLO CARRILLO" -> "Pablo Carrillo"
 *
 * Las partículas de los apellidos compuestos se dejan en minúscula ("DE LA
 * TORRE" -> "de la Torre") salvo al inicio, porque escribirlas con mayúscula es
 * incorrecto en español.
 */
const PARTICULAS = new Set(['de', 'del', 'la', 'las', 'los', 'y', 'e', 'da', 'do', 'van', 'von'])

export function paraMostrarAlCliente(texto: string | null | undefined): string {
  if (!texto?.trim()) return ''
  return texto
    .trim()
    .toLocaleLowerCase('es-EC')
    .split(/\s+/)
    .map((palabra, i) => {
      if (i > 0 && PARTICULAS.has(palabra)) return palabra
      return palabra.charAt(0).toLocaleUpperCase('es-EC') + palabra.slice(1)
    })
    .join(' ')
}
