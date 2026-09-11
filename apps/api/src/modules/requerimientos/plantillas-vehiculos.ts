/**
 * Correos de vehículos: emisión y renovación.
 *
 * Salen de las plantillas de Canva que pasó operaciones. Las dos comparten casi
 * todo el texto; lo que cambia de verdad es un párrafo:
 *   - emisión dice "ha sido emitida"; renovación, "ha sido renovada"
 *   - el bloque de pago depende de cómo paga el cliente, no del tipo de correo
 *
 * Por eso no son dos plantillas separadas sino una con dos variantes: mantenerlas
 * aparte haría que una corrección se aplicara solo a la mitad.
 */

export type TipoCorreoVehiculo = 'EMISION' | 'RENOVACION'

/** Cómo paga el cliente. Decide qué bloque de pago va en el correo. */
export type FormaPagoVehiculo = 'CONTADO' | 'TARJETA' | 'DEBITO'

export interface DatosVehiculo {
  /** Nombre con el que se saluda. Preferido si lo tiene. */
  saludo: string
  aseguradora: string
  plan: string | null
  /** "Renault Duster" */
  vehiculo: string | null
  placa: string | null
  /** "26 de agosto de 2026" */
  vigencia: string | null
  formaPago: FormaPagoVehiculo
  /** Solo en débito: cuántas cuotas y desde cuándo. */
  cuotas?: number | null
  diaDebito?: number | null
  mesInicioDebito?: string | null
  /** Datos de emergencia de la aseguradora. */
  emergenciaWhatsapp?: string | null
  emergenciaTelefono?: string | null
  /** Enlace de pago con tarjeta, cuando la aseguradora lo tiene. */
  enlacePago?: string | null
  /** Cuentas para transferencia, cuando el pago es de contado. */
  cuentas?: { banco: string; tipo: string; numero: string }[]
  /** RUC de la aseguradora, para el encabezado de la tabla de cuentas. */
  rucAseguradora?: string | null
}

/** Contacto de Gianella: es la ejecutiva de vehículos y de fidelización. */
const CONTACTO_PRIORITY = {
  nombre: 'Gianella Pozo',
  email: 'comercial@priority.ec',
  celular: '0987734263',
}

const SERVICIOS = [
  '• Asesorías y consultas sobre las coberturas de tu plan.',
  '• Apoyo personalizado 24/7 en emergencias, cuando más lo necesites.',
  '• Coordinación con talleres y compañías de seguros en caso de siniestro.',
].join('\n')

/** Los datos de la póliza, en viñetas. */
function detallesCobertura(d: DatosVehiculo): string {
  return [
    `• Compañía: ${[d.aseguradora, d.plan].filter(Boolean).join(' - ')}`,
    d.vehiculo || d.placa
      ? `• Vehículo: ${[d.vehiculo, d.placa ? `Placa ${d.placa}` : ''].filter(Boolean).join(' - ')}`
      : '',
    d.vigencia ? `• Vigencia: ${d.vigencia}` : '',
  ]
    .filter(Boolean)
    .join('\n')
}

/**
 * El bloque de pago.
 *
 * Depende de cómo paga el cliente y no del tipo de correo: una renovación de
 * contado lleva las cuentas igual que una emisión.
 */
function bloquePago(d: DatosVehiculo): string {
  if (d.formaPago === 'TARJETA') {
    return [
      'La póliza la puedes pagar con tarjeta de crédito hasta 12 meses sin intereses ingresando en el link que se detalla a continuación.',
      '',
      d.enlacePago ?? '(pegar aquí el enlace de pago de la aseguradora)',
    ].join('\n')
  }

  if (d.formaPago === 'DEBITO') {
    const cuotas = d.cuotas ? `a ${d.cuotas} cuotas` : ''
    const cuando =
      d.diaDebito && d.mesInicioDebito
        ? `, el débito lo realizarán el ${d.diaDebito} de cada mes a partir de ${d.mesInicioDebito}`
        : ''
    return `El pago está registrado con débito bancario ${cuotas} de acuerdo a lo solicitado${cuando}.`
  }

  // Contado: las cuentas van como texto, no como tabla.
  //
  // El correo se arma desde texto plano y editable; una tabla HTML no se podría
  // corregir en el cuadro de texto. Las cuentas quedan legibles igual.
  const cabecera = d.rucAseguradora
    ? `${d.aseguradora} — RUC ${d.rucAseguradora}`
    : d.aseguradora
  const lineas = (d.cuentas ?? []).map(
    (c) => `• ${c.banco} — ${c.tipo} — ${c.numero}`,
  )
  return [
    'El pago lo puedes realizar de contado en las siguientes cuentas bancarias, por favor enviarnos el comprobante de pago.',
    '',
    cabecera,
    ...(lineas.length ? lineas : ['(agregar aquí las cuentas de la aseguradora)']),
  ].join('\n')
}

/** Contacto de Priority y de la aseguradora, uno debajo del otro. */
function bloqueContacto(d: DatosVehiculo): string {
  const emergencias = [
    d.emergenciaWhatsapp ? `${d.aseguradora} WhatsApp: ${d.emergenciaWhatsapp}` : '',
    d.emergenciaTelefono ?? '',
  ].filter(Boolean)

  return [
    `Te saluda ${CONTACTO_PRIORITY.nombre}, seré tu apoyo y te acompañaré en todo momento.`,
    '',
    'Mis datos de contacto son:',
    `Email: ${CONTACTO_PRIORITY.email}`,
    `Celular: ${CONTACTO_PRIORITY.celular}`,
    ...(emergencias.length
      ? ['', 'Datos para emergencias aseguradora:', ...emergencias]
      : []),
  ].join('\n')
}

export function construirCorreoVehiculo(
  tipo: TipoCorreoVehiculo,
  d: DatosVehiculo,
): string {
  const emitidaORenovada =
    tipo === 'EMISION' ? 'ha sido emitida' : 'ha sido renovada'

  // Solo la emisión menciona el adjunto: en la renovación el cliente ya conoce
  // sus coberturas y no se le vuelven a mandar.
  const cierre =
    tipo === 'EMISION'
      ? 'Continuamos ofreciéndote la tranquilidad y el respaldo que mereces, adjunto encontrarás los beneficios y coberturas de tu póliza.'
      : 'Continuamos ofreciéndote la tranquilidad y el respaldo que mereces.'

  return [
    d.saludo ? `${d.saludo},` : '',
    '',
    '¡Gracias por confiar en nosotros!',
    '',
    'En Priority como tus asesores de seguros, más que un bróker somos tu aliado personal.',
    '',
    `Tu póliza ${emitidaORenovada}, la recibirás en tu correo electrónico como un contrato digital, estos son los detalles claves de tu cobertura:`,
    '',
    detallesCobertura(d),
    '',
    bloquePago(d),
    '',
    bloqueContacto(d),
    '',
    'Estamos siempre contigo, cuando más lo requieras:',
    SERVICIOS,
    '',
    cierre,
    '',
    'Priority siempre contigo!',
  ]
    .join('\n')
    .replace(/^\n+/, '')
}

/**
 * Cómo se nombra la forma de pago de la póliza en estos correos.
 *
 * La póliza guarda formas como CONTADO, MENSUAL o DIFERIDO; aquí solo importan
 * tres caminos porque son los tres bloques de texto que existen.
 */
export function formaPagoVehiculo(formaPoliza: string | null): FormaPagoVehiculo {
  const f = (formaPoliza ?? '').toUpperCase()
  if (f.includes('TARJETA') || f.includes('DIFERIDO')) return 'TARJETA'
  if (f.includes('DEBITO') || f.includes('MENSUAL') || f.includes('BANCO')) return 'DEBITO'
  return 'CONTADO'
}
