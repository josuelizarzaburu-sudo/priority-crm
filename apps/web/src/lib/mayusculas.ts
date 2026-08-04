/**
 * Mayúsculas para los datos que se cargan en el CRM operativo.
 *
 * Pedido de Josue: que todo lo que se escriba quede en mayúsculas, para que la
 * base se vea uniforme sin depender de cómo teclee cada ejecutiva.
 *
 * Se aplica solo a los campos de TEXTO de datos (nombres, direcciones, planes...).
 * A propósito NO se aplica a:
 *   - correos: las direcciones de correo se escriben en minúsculas por convención
 *     y algunas resultan ilegibles o dejan de funcionar en mayúsculas
 *   - contraseñas, cédulas, números, fechas y notas largas
 */

/** Pasa a mayúsculas respetando tildes y ñ. */
export const aMayusculas = (v: string) => v.toLocaleUpperCase('es-EC')

/**
 * Envuelve el onChange de un input para que escriba en mayúsculas mientras se
 * teclea. Uso: onChange={enMayusculas((valor) => set('nombres', valor))}
 */
export const enMayusculas =
  (fn: (valor: string) => void) => (e: { target: { value: string } }) =>
    fn(aMayusculas(e.target.value))
