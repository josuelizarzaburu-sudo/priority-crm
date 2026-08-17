/**
 * Quien puede gestionar negocios propios en "Mi Pipeline".
 *
 * Hay dos caminos para llegar:
 *
 * 1. Ser vendedor de planta (SALES_REP). El permiso viene con el cargo.
 * 2. Tener el permiso individual `puedeVender`. Es el caso de los perfiles de
 *    Operaciones, que venden de vez en cuando. Se activa usuario por usuario
 *    desde la pantalla de Usuarios, NO por rol: asi se le da solo a quien
 *    corresponda y una ejecutiva nueva entra sin el.
 *
 * En ambos casos la restriccion es la misma y es lo importante: ven y tocan
 * UNICAMENTE los negocios que tienen asignados. Nadie gana visibilidad sobre el
 * pipeline completo por esta via.
 *
 * Por que existe este archivo: antes las comprobaciones estaban escritas como
 * `role === 'SALES_REP'` repartidas por el servicio. Eso pregunta "quien eres",
 * no "que puedes hacer", asi que cualquier rol que no fuera vendedor caia del
 * lado sin restriccion. Concentrando la decision aqui, agregar un permiso nuevo
 * es cambiar una sola funcion en vez de buscar comparaciones sueltas.
 */

/** Perfiles del area de Operaciones. */
export const ROLES_OPERACIONES = ['OPERACIONES', 'JEFE_OPERACIONES']

/**
 * ¿Este usuario esta limitado a sus propios negocios?
 *
 * Ojo con el orden: si el rol no es de Operaciones, `puedeVender` se ignora a
 * proposito. La casilla no debe poder recortarle la vista a un MANAGER ni
 * ampliarsela a nadie; solo habilita a los perfiles operativos.
 */
export function soloVeSusNegocios(role: string, puedeVender?: boolean): boolean {
  if (role === 'SALES_REP') return true
  if (puedeVender === true && ROLES_OPERACIONES.includes(role)) return true
  return false
}

/**
 * ¿Los negocios que crea esta persona son SUYOS?
 *
 * Es una pregunta DISTINTA de soloVeSusNegocios, aunque se parezcan:
 *   - soloVeSusNegocios responde "¿que alcance tiene al mirar?"
 *   - esta responde "¿a quien se asigna lo que crea?"
 *
 * El jefe de equipo las separa: al MIRAR ve todo su equipo, pero lo que CREA es
 * suyo, porque tambien vende. Con una sola funcion, darle lo segundo le quitaba
 * lo primero.
 */
export function creaNegociosPropios(role: string, puedeVender?: boolean): boolean {
  if (role === 'SALES_REP') return true
  if (role === 'JEFE_EQUIPO') return true
  if (puedeVender === true && ROLES_OPERACIONES.includes(role)) return true
  return false
}

/**
 * ¿Puede entrar a "Mi Pipeline"?
 *
 * Hoy coincide con soloVeSusNegocios, pero se deja aparte porque responden
 * preguntas distintas: una es sobre acceso y la otra sobre alcance. Si algun dia
 * un rol sin restriccion necesita la pantalla, solo cambia esta.
 */
export function puedeGestionarNegociosPropios(role: string, puedeVender?: boolean): boolean {
  return creaNegociosPropios(role, puedeVender)
}
