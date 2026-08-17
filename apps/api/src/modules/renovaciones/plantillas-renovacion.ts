/**
 * Guiones de renovación, tomados del documento "Texto envío renovaciones 2026".
 *
 * Viven aquí y no en la base de datos porque cambian una vez al año, cuando las
 * aseguradoras publican las condiciones nuevas. Lo que sí se edita en cada envío
 * es el correo YA ARMADO: la ejecutiva lo revisa en pantalla, corrige lo que haga
 * falta en ese caso puntual y envía. Así no reescribe nada de cero, que es
 * justamente lo que se quiere evitar.
 */

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

function cuerpoSalud(d: DatosRenovacion, descripcionPlan: string, beneficios: string): string {
  return [
    `${d.saludo}`,
    APERTURA_SALUD,
    `Seguimos comprometidos con nuestro acompañamiento permanente, ${descripcionPlan} con deducible de ${d.deducible} que mantiene con ${d.aseguradora} se renueva automáticamente el ${d.fechaRenovacion}, con forma de pago ${d.formaPago}, la prima a partir de la renovación es de USD ${d.prima}.`,
    beneficios,
    bloqueDescuentoBmi(d.primaConDescuento),
    `Si desea realizar algún cambio a la renovación por favor nos confirma a través de este medio hasta el ${d.fechaLimite}.`,
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
export const PLANTILLAS: Record<
  string,
  { etiqueta: string; armar: (d: DatosRenovacion) => string }
> = {
  'BMI:SIGMA': {
    etiqueta: 'BMI — Sigma',
    armar: (d) =>
      cuerpoSalud(
        d,
        'su Plan Sigma',
        'A partir de la renovación el plan cuenta con nuevos beneficios que se detallan en el documento adjunto.',
      ),
  },
  'BMI:INNOVA': {
    etiqueta: 'BMI — Innova',
    armar: (d) =>
      cuerpoSalud(
        d,
        'su Plan Innova',
        'A partir de la renovación el plan incrementa la cobertura a 120.000 por incapacidad por persona al año, adicional cuenta con nuevos beneficios que se detallan en el documento adjunto.',
      ),
  },
  'BMI:GMM': {
    etiqueta: 'BMI — Gastos Médicos Mayores',
    armar: (d) =>
      cuerpoSalud(
        d,
        'su Plan de Gastos Médicos Mayores',
        'A partir de la renovación el plan cuenta con un nuevo beneficio; el acceso en la Clínica Universidad de Navarra en España para cobertura hospitalaria.',
      ),
  },
  'BMI:HOSPICARE': {
    etiqueta: 'BMI — Hospicare',
    armar: (d) =>
      cuerpoSalud(
        d,
        'su Plan Hospicare',
        'La cobertura en el plan Hospicare es Hospitalaria al 80% y Ambulatoria incluido medicinas al 50%, el plan cuenta con nuevos beneficios que se detallan en el documento adjunto.',
      ),
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
): string | null {
  const a = (aseguradora ?? '').toUpperCase()
  const p = (plan ?? '').toUpperCase()

  if (tipoPoliza === 'AUTO' || tipoPoliza === 'VEHICULO') {
    return a.includes('ZURICH') ? 'AUTO:ZURICH' : 'AUTO'
  }

  if (a.includes('BMI')) {
    // El orden importa: 'GASTOS MEDICOS MAYORES' y 'GMM' son el mismo plan, y
    // hay que reconocer ambas formas porque el Excel usa la larga.
    if (p.includes('SIGMA')) return 'BMI:SIGMA'
    if (p.includes('INNOVA')) return 'BMI:INNOVA'
    if (p.includes('HOSPICARE')) return 'BMI:HOSPICARE'
    if (p.includes('GMM') || p.includes('GASTOS MEDICOS') || p.includes('GASTOS MÉDICOS')) {
      return 'BMI:GMM'
    }
    return null
  }

  if (a.includes('HUMANA')) return 'HUMANA'
  if (a.includes('CONFIAMED')) return 'CONFIAMED'
  if (a.includes('SALUD')) return 'SALUDSA'

  return null
}

/** ¿Esta aseguradora ofrece el descuento del 5% por pago anual con tarjeta? */
export function ofreceDescuento(aseguradora: string | null): boolean {
  return (aseguradora ?? '').toUpperCase().includes('BMI')
}
