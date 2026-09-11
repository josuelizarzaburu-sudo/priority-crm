/**
 * Guiones de renovación, tomados del documento "Texto envío renovaciones 2026".
 *
 * Viven aquí y no en la base de datos porque cambian una vez al año, cuando las
 * aseguradoras publican las condiciones nuevas. Lo que sí se edita en cada envío
 * es el correo YA ARMADO: la ejecutiva lo revisa en pantalla, corrige lo que haga
 * falta en ese caso puntual y envía. Así no reescribe nada de cero, que es
 * justamente lo que se quiere evitar.
 */

import {
  construirCorreoVehiculo,
  type DatosVehiculo,
  type FormaPagoVehiculo,
} from '../requerimientos/plantillas-vehiculos'

export interface DatosRenovacion {
  saludo: string
  plan: string
  deducible: string
  aseguradora: string
  fechaRenovacion: string
  formaPago: string
  prima: string
  /** Fecha límite para confirmar cambios. */
  fechaLimite: string
  /** Prima con el 5% de descuento. Solo BMI la ofrece. */
  primaConDescuento?: string | null
  // Vehículos
  marca?: string
  modelo?: string
  anio?: string
  placa?: string
  avaluo?: string
}

const CIERRE =
  'Como sus asesores de seguros adicionalmente contamos con seguros para vehículos, hogar, vida y ahorro.'

const APERTURA_SALUD =
  'Gracias por confiar en Priority algo tan importante como la protección de lo que más valora, su salud.'

const APERTURA_AUTO =
  'Gracias por confiar en Priority algo tan importante como la protección de su vehículo.'

/**
 * Descuento por pago anual con tarjeta.
 *
 * Solo lo ofrece BMI: por eso no aparece en las plantillas de Humana, Confiamed
 * ni Saludsa. Si se incluyera ahí, se le estaría prometiendo al cliente algo que
 * su aseguradora no da.
 */
function bloqueDescuentoBmi(primaConDescuento?: string | null): string {
  if (!primaConDescuento) return ''
  return `Puede acceder a un descuento del 5% si se paga el valor total anual diferido a 12 meses sin intereses con tarjetas de crédito Visa o MasterCard de Produbanco, Banco Guayaquil, Internacional, Bolivariano, Machala, Amazonas y Solidario, la prima mensual se reduce a USD ${primaConDescuento}.`
}

/**
 * Como se nombra cada forma de pago en el guion oficial.
 *
 * Las plantillas de BMI vienen en version diferido y mensual, y la unica
 * diferencia entre ellas es esta frase. Se fija en la plantilla para poder
 * elegirla directo, sin depender de lo que tenga cargada la poliza.
 */
export const FORMA_DIFERIDO = 'diferido a 12 meses sin intereses con tarjeta de crédito'
export const FORMA_MENSUAL = 'débito mensual'

function cuerpoSalud(
  d: DatosRenovacion,
  descripcionPlan: string,
  beneficios: string,
  /** Forma de pago fija de la plantilla. Sin ella se usa la de la póliza. */
  formaPagoFija?: string,
  /** "la prima mensual" o "la prima" — Hospicare usa la segunda. */
  comoLlamarPrima = 'la prima mensual',
): string {
  const forma = formaPagoFija ?? d.formaPago
  return [
    `${d.saludo}`,
    APERTURA_SALUD,
    `Seguimos comprometidos con nuestro acompañamiento permanente, ${descripcionPlan} con deducible de ${d.deducible} que mantiene con ${d.aseguradora} se renueva automáticamente el ${d.fechaRenovacion}, con forma de pago ${forma}, ${comoLlamarPrima} a partir de la renovación es de USD ${d.prima}.`,
    beneficios,
    bloqueDescuentoBmi(d.primaConDescuento),
    // La fecha se deja EN BLANCO a proposito, para que la ejecutiva la escriba.
    // El plazo depende de cada caso —de la aseguradora, de si hay que pedir
    // documentos, de cuando se contacto al cliente— y calcularlo solo llevaba a
    // poner fechas que despues no se podian cumplir.
    `Si desea realizar algún cambio a la renovación por favor nos confirma a través de este medio hasta el (colocar fecha).`,
    CIERRE,
    'Saludos cordiales,',
  ]
    .filter(Boolean)
    .join('\n\n')
}

/**
 * Cada entrada es una plantilla del documento original.
 *
 * La clave combina aseguradora y plan porque BMI tiene cuatro guiones distintos,
 * uno por plan, y cada uno menciona beneficios propios que no se pueden mezclar.
 */
/**
 * Adapta los datos de la renovacion a lo que esperan las plantillas de Canva.
 *
 * Los datos de la aseguradora —cuentas, enlace de pago, telefonos de
 * emergencia— quedan como marcadores para que la ejecutiva los pegue: cambian
 * por compania y tenerlos fijos en el codigo obligaria a un despliegue cada vez
 * que una cambie una cuenta.
 */
function datosVehiculo(d: DatosRenovacion, formaPago: FormaPagoVehiculo): DatosVehiculo {
  return {
    saludo: d.saludo.replace(/,$/, ''),
    aseguradora: d.aseguradora ?? '',
    plan: d.plan ?? null,
    vehiculo: [d.marca, d.modelo].filter(Boolean).join(' ') || null,
    placa: d.placa ?? null,
    vigencia: d.fechaRenovacion ?? null,
    formaPago,
  }
}

export const PLANTILLAS: Record<
  string,
  { etiqueta: string; armar: (d: DatosRenovacion) => string }
> = {
  'BMI:SIGMA:DIFERIDO': {
    etiqueta: 'BMI — Sigma (diferido)',
    armar: (d) =>
      cuerpoSalud(
        d,
        'su Plan Sigma',
        'A partir de la renovación el plan cuenta con nuevos beneficios que se detallan en el documento adjunto.',
        FORMA_DIFERIDO,
      ),
  },
  'BMI:SIGMA:MENSUAL': {
    etiqueta: 'BMI — Sigma (débito mensual)',
    armar: (d) =>
      cuerpoSalud(
        d,
        'su Plan Sigma',
        'A partir de la renovación el plan cuenta con nuevos beneficios que se detallan en el documento adjunto.',
        FORMA_MENSUAL,
      ),
  },
  'BMI:INNOVA:DIFERIDO': {
    etiqueta: 'BMI — Innova (diferido)',
    armar: (d) =>
      cuerpoSalud(
        d,
        'su Plan Innova',
        'A partir de la renovación el plan incrementa la cobertura a 120.000 por incapacidad por persona al año, adicional cuenta con nuevos beneficios que se detallan en el documento adjunto.',
        FORMA_DIFERIDO,
      ),
  },
  'BMI:INNOVA:MENSUAL': {
    etiqueta: 'BMI — Innova (débito mensual)',
    armar: (d) =>
      cuerpoSalud(
        d,
        'su Plan Innova',
        'A partir de la renovación el plan incrementa la cobertura a 120.000 por incapacidad por persona al año, adicional cuenta con nuevos beneficios que se detallan en el documento adjunto.',
        FORMA_MENSUAL,
      ),
  },
  'BMI:GMM:DIFERIDO': {
    etiqueta: 'BMI — Gastos Médicos Mayores (diferido)',
    armar: (d) =>
      cuerpoSalud(
        d,
        'su Plan de Gastos Médicos Mayores',
        'A partir de la renovación el plan cuenta con un nuevo beneficio; el acceso en la Clínica Universidad de Navarra en España para cobertura hospitalaria.',
        FORMA_DIFERIDO,
      ),
  },
  'BMI:GMM:MENSUAL': {
    etiqueta: 'BMI — Gastos Médicos Mayores (débito mensual)',
    armar: (d) =>
      cuerpoSalud(
        d,
        'su Plan de Gastos Médicos Mayores',
        'A partir de la renovación el plan cuenta con un nuevo beneficio; el acceso en la Clínica Universidad de Navarra en España para cobertura hospitalaria.',
        FORMA_MENSUAL,
      ),
  },
  'BMI:HOSPICARE:MENSUAL': {
    etiqueta: 'BMI — Hospicare (débito mensual)',
    armar: (d) =>
      cuerpoSalud(
        d,
        'su Plan Hospicare',
        'La cobertura en el plan Hospicare es Hospitalaria al 80% y Ambulatoria incluido medicinas al 50%, el plan cuenta con nuevos beneficios que se detallan en el documento adjunto.',
        FORMA_MENSUAL,
        // El guion de Hospicare dice "la prima", no "la prima mensual".
        'la prima',
      ),
  },
  BUPA: {
    etiqueta: 'BUPA',
    armar: (d) => cuerpoSalud(d, `su Plan ${d.plan}`, ''),
  },
  HUMANA: {
    etiqueta: 'Humana',
    armar: (d) => cuerpoSalud(d, `el Plan ${d.plan}`, ''),
  },
  CONFIAMED: {
    etiqueta: 'Confiamed',
    armar: (d) => cuerpoSalud(d, `el Plan ${d.plan}`, ''),
  },
  SALUDSA: {
    etiqueta: 'Saludsa',
    armar: (d) => cuerpoSalud(d, `su plan ${d.plan}`, ''),
  },

  // ── Vehículos ──
  AUTO: {
    etiqueta: 'Vehículos — Atlántida, Sweaden, AIG',
    armar: (d) =>
      [
        d.saludo,
        APERTURA_AUTO,
        `Recibimos las condiciones de renovación de la póliza de su vehículo ${d.marca ?? ''} ${d.modelo ?? ''}, año ${d.anio ?? ''} placas ${d.placa ?? ''} que se encuentra asegurado con ${d.aseguradora}, el cual se renueva el ${d.fechaRenovacion} con un avalúo de USD ${d.avaluo ?? ''}, la compañía mantiene la tasa para la renovación por lo que la prima es de USD ${d.prima}.`,
        'De acuerdo a Patio Tuerca envío el valor actual referencial del vehículo, podría renovarlo por un 10% menos del valor actual asegurado.',
        'Por favor me confirma por qué valor renovamos para coordinar el formulario de vinculación.',
        'Saludos cordiales,',
      ]
        .filter(Boolean)
        .join('\n\n'),
  },
  /**
   * Confirmacion de que la poliza YA se renovo, con el diseño de Canva.
   *
   * Distinta de las dos de arriba, que son el aviso PREVIO pidiendo confirmar
   * el avaluo. Aqui la renovacion ya ocurrio y se le pasan al cliente los datos
   * de su cobertura y como pagar.
   *
   * Tres variantes segun como pague: son los tres bloques de texto que existen.
   */
  'AUTO:RENOVADO:CONTADO': {
    etiqueta: 'Vehículos renovado — pago de contado',
    armar: (d) =>
      construirCorreoVehiculo('RENOVACION', datosVehiculo(d, 'CONTADO')),
  },
  'AUTO:RENOVADO:TARJETA': {
    etiqueta: 'Vehículos renovado — pago con tarjeta',
    armar: (d) => construirCorreoVehiculo('RENOVACION', datosVehiculo(d, 'TARJETA')),
  },
  'AUTO:RENOVADO:DEBITO': {
    etiqueta: 'Vehículos renovado — débito bancario',
    armar: (d) => construirCorreoVehiculo('RENOVACION', datosVehiculo(d, 'DEBITO')),
  },
  'AUTO:ZURICH': {
    etiqueta: 'Vehículos — Zurich',
    armar: (d) =>
      [
        d.saludo,
        APERTURA_AUTO,
        `Recibimos las condiciones de renovación de la póliza de su vehículo ${d.marca ?? ''} ${d.modelo ?? ''}, año ${d.anio ?? ''} placas ${d.placa ?? ''} que se encuentra asegurado con Zurich Seguros, el cual se renueva el ${d.fechaRenovacion}, la compañía considera el avalúo de USD ${d.avaluo ?? ''}, la compañía mantiene la tasa para la renovación por lo que la prima es de USD ${d.prima}.`,
        'Quedo al pendiente de su confirmación para coordinar el formulario de vinculación.',
        'Saludos cordiales,',
      ]
        .filter(Boolean)
        .join('\n\n'),
  },
}

/**
 * Elige la plantilla que corresponde a una póliza.
 *
 * Se busca por aseguradora y, en BMI, además por plan. Si no cuadra ninguna, se
 * devuelve la de la aseguradora sin plan concreto; y si tampoco, null, para que
 * la pantalla pida elegirla a mano en vez de mandar un texto equivocado.
 */
export function elegirPlantilla(
  aseguradora: string | null,
  plan: string | null,
  tipoPoliza: string | null,
  /** Como paga el cliente, para proponer la variante diferido o mensual. */
  formaPago?: string | null,
): string | null {
  const a = (aseguradora ?? '').toUpperCase()
  const p = (plan ?? '').toUpperCase()

  if (tipoPoliza === 'AUTO' || tipoPoliza === 'VEHICULO') {
    return a.includes('ZURICH') ? 'AUTO:ZURICH' : 'AUTO'
  }

  if (a.includes('BMI')) {
    // El orden importa: 'GASTOS MEDICOS MAYORES' y 'GMM' son el mismo plan, y
    // hay que reconocer ambas formas porque el Excel usa la larga.
    /**
     * Se propone la variante segun como paga el cliente, para que la ejecutiva
     * no tenga que elegirla casi nunca. Igual puede cambiarla en el desplegable:
     * la forma de pago cargada en la poliza no siempre esta al dia.
     */
    const esDiferido = (formaPago ?? '').toUpperCase().includes('DIFERIDO')
    const variante = esDiferido ? 'DIFERIDO' : 'MENSUAL'

    if (p.includes('SIGMA')) return `BMI:SIGMA:${variante}`
    if (p.includes('INNOVA')) return `BMI:INNOVA:${variante}`
    // Hospicare solo tiene version mensual en el guion oficial.
    if (p.includes('HOSPICARE')) return 'BMI:HOSPICARE:MENSUAL'
    if (p.includes('GMM') || p.includes('GASTOS MEDICOS') || p.includes('GASTOS MÉDICOS')) {
      return `BMI:GMM:${variante}`
    }
    return null
  }

  // BUPA antes que el resto: su nombre no choca con ninguno, pero conviene
  // tenerlo junto a las demas de salud para que se vea que esta cubierta.
  if (a.includes('BUPA')) return 'BUPA'
  if (a.includes('HUMANA')) return 'HUMANA'
  if (a.includes('CONFIAMED')) return 'CONFIAMED'
  if (a.includes('SALUD')) return 'SALUDSA'

  return null
}

/** ¿Esta aseguradora ofrece el descuento del 5% por pago anual con tarjeta? */
export function ofreceDescuento(aseguradora: string | null): boolean {
  return (aseguradora ?? '').toUpperCase().includes('BMI')
}
