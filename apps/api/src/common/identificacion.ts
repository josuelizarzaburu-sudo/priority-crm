/**
 * Validación de cédula y RUC ecuatorianos.
 *
 * Es una copia de la que ya usaba el formulario del navegador
 * (nuevo-cliente.tsx). Vive también aquí porque una validación que solo existe
 * en el navegador no protege nada: basta con que un camino del frontend se la
 * salte —o que alguien llame a la API directamente— para que entren datos
 * inválidos. Por el servidor pasan todos los caminos.
 *
 * Las reglas se mantienen idénticas a las del formulario a propósito: si
 * divergen, el usuario vería un dato aceptado en pantalla y rechazado al
 * guardar, o al revés.
 */

/** Devuelve el motivo del rechazo, o null si es válido. */
export function revisarIdentificacion(valor: string): string | null {
  const s = (valor ?? '').trim()
  if (!s) return 'Falta la cédula o RUC'
  if (!/^\d+$/.test(s)) return 'Solo debe tener números'

  // RUC: 13 dígitos terminados en 001.
  if (s.length === 13) {
    return s.endsWith('001') ? null : 'Un RUC debe terminar en 001'
  }

  if (s.length !== 10) {
    return `Tiene ${s.length} dígitos; una cédula tiene 10 y un RUC 13`
  }

  // Los dos primeros dígitos son la provincia. El 30 corresponde a ecuatorianos
  // registrados en el exterior.
  const prov = parseInt(s.slice(0, 2), 10)
  if ((prov < 1 || prov > 24) && prov !== 30) {
    return `La provincia ${s.slice(0, 2)} no existe`
  }
  if (parseInt(s[2], 10) > 5) {
    return 'El tercer dígito no corresponde a una persona natural'
  }

  // Dígito verificador: algoritmo módulo 10 del Registro Civil.
  const coef = [2, 1, 2, 1, 2, 1, 2, 1, 2]
  let total = 0
  for (let i = 0; i < 9; i++) {
    const p = parseInt(s[i], 10) * coef[i]
    total += p > 9 ? p - 9 : p
  }
  const verif = (10 - (total % 10)) % 10
  if (verif !== parseInt(s[9], 10)) {
    return 'El número no es válido (no pasa el dígito verificador)'
  }
  return null
}

/** Atajo para cuando solo importa si es válido. */
export function cedulaORucValido(valor: string): boolean {
  return revisarIdentificacion(valor) === null
}
