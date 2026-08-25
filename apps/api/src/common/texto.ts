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

/**
 * Primer nombre y primer apellido, para dirigirse al cliente.
 *
 * "MARIA JOSE ANDRADE LOPEZ" -> "Maria Andrade"
 *
 * En Ecuador se registran dos nombres y dos apellidos, asi que el nombre
 * completo de la cedula queda largo y suena a tramite. Para una carta, el primer
 * nombre y el primer apellido es lo natural.
 */
export function nombreCorto(nombres: string, apellidos: string): string {
  const primerNombre = (nombres ?? '').trim().split(/\s+/)[0] ?? ''

  // El primer apellido puede empezar con particula: "DE LA TORRE PEREZ" tiene
  // como primer apellido "DE LA TORRE", no "DE". Se arrastran las particulas
  // hasta llegar a la primera palabra con contenido.
  const partes = (apellidos ?? '').trim().split(/\s+/).filter(Boolean)
  const apellido: string[] = []
  for (const parte of partes) {
    apellido.push(parte)
    if (!PARTICULAS.has(parte.toLocaleLowerCase('es-EC'))) break
  }

  return paraMostrarAlCliente([primerNombre, ...apellido].filter(Boolean).join(' '))
}

/**
 * Nombre completo con el orden de la cedula: apellidos primero.
 *
 * "CADENA HUERTAS" + "HUGO EDUARDO" -> "Cadena Huertas Hugo Eduardo"
 *
 * Se usa en el ASUNTO del correo, donde hace falta identificar al cliente sin
 * ambiguedad. Para el saludo se usa solo el primer nombre, que es como se habla
 * a una persona.
 */
export function nombreCompletoFormal(nombres: string, apellidos: string): string {
  return paraMostrarAlCliente(
    [(apellidos ?? '').trim(), (nombres ?? '').trim()].filter(Boolean).join(' '),
  )
}

/** Solo el primer nombre, para el saludo: "ANTONIETA MARIA" -> "Antonieta". */
export function primerNombre(nombres: string): string {
  return paraMostrarAlCliente((nombres ?? '').trim().split(/\s+/)[0] ?? '')
}
