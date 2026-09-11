/**
 * Plantillas del correo de bienvenida.
 *
 * Salen del Word de operaciones. Son tres variantes reales, que se diferencian
 * en cómo cierran:
 *   - el cliente tiene preexistencias ya cubiertas
 *   - no tiene ninguna declarada
 *   - la póliza es de contrato digital
 *
 * La ejecutiva elige una, el texto se arma con los datos del cliente y puede
 * corregirlo antes de enviar. Es la misma mecánica que en renovaciones: la
 * plantilla ahorra escribir, no impone lo que se manda.
 */

import {
  construirCorreoVehiculo,
  formaPagoVehiculo,
  type DatosVehiculo,
  type FormaPagoVehiculo,
} from './plantillas-vehiculos'

export interface DatosBienvenida {
  /** Cómo se saluda al cliente: nombre preferido, o nada si no se sabe cuál usar. */
  saludo: string
  aseguradora: string | null
  plan: string | null
  deducible: string | null
  ejecutivaNombre: string | null
  ejecutivaEmail: string | null
  ejecutivaCelular: string | null
  /** Diagnósticos ya declarados, uno por línea. */
  preexistencias?: string | null
  vigenciaDesde?: string | null
  /** Forma de pago de la póliza, para proponer la variante en vehículos. */
  formaPago?: string | null
  /** Datos del vehículo, para las viñetas de la cobertura. */
  marca?: string | null
  modelo?: string | null
  placa?: string | null
}

export interface PlantillaBienvenida {
  id: string
  label: string
  descripcion: string
  construir: (d: DatosBienvenida) => string
}

/** Correo de servicio al que se piden reembolsos. */
const CORREO_SERVICIO = 'serviciouio@priority.ec'

/** El plan, tal como se nombra al cliente: "BMI — Sigma con deducible de $500". */
function frasePlan(d: DatosBienvenida): string {
  if (!d.aseguradora && !d.plan) return ''
  const partes = [d.aseguradora, d.plan].filter(Boolean).join(' — ')
  const ded = d.deducible ? ` con deducible de ${formatearDeducible(d.deducible)}` : ''
  return ` Su plan médico es ${partes}${ded}.`
}

/** "500" -> "$500.00". Si ya viene con formato, se respeta. */
function formatearDeducible(v: string): string {
  const limpio = String(v).trim()
  if (/^\d+(\.\d+)?$/.test(limpio)) {
    return `$${Number(limpio).toLocaleString('es-EC', { minimumFractionDigits: 2 })}`
  }
  return limpio
}

/** Bloque de contacto de la ejecutiva. */
function bloqueEjecutiva(d: DatosBienvenida): string {
  const nombre = d.ejecutivaNombre ?? 'su ejecutiva de cuenta'
  const correo = d.ejecutivaEmail ?? CORREO_SERVICIO
  const cel = d.ejecutivaCelular ? ` o al celular ${d.ejecutivaCelular}` : ''
  return (
    `Le saluda ${nombre}, su ejecutiva de cuenta. Estaré disponible para usted en el correo ` +
    `electrónico ${correo}${cel}; le brindaré un acompañamiento permanente en todo momento, ` +
    `el cual comprende:`
  )
}

/** Los tres compromisos de servicio, iguales en las tres plantillas. */
function serviciosIncluidos(d: DatosBienvenida): string {
  const correo = d.ejecutivaEmail ?? CORREO_SERVICIO
  return [
    '• Atención los 365 días del año para consultas y asesoría en las coberturas del plan contratado.',
    '• Apoyo personalizado en emergencias, autorizaciones en las casas de salud y coordinación de beneficios con las compañías de seguros.',
    `• Recepción de reembolsos digitales en ${correo} o retiro de documentos en su domicilio.`,
  ].join('\n')
}

/** Apertura común: saludo, bienvenida, plan y contacto. */
function apertura(d: DatosBienvenida): string {
  const vigencia = d.vigenciaDesde ? ` Su plan se encuentra vigente desde el ${d.vigenciaDesde}.` : ''
  return [
    d.saludo ? `${d.saludo},` : '',
    '',
    'Le damos la más cordial bienvenida y agradecemos la confianza depositada como sus ' +
      'asesores de seguros. Su bienestar es nuestra prioridad y estamos gustosos de atender ' +
      `sus requerimientos.${frasePlan(d)}${vigencia}`,
    '',
    bloqueEjecutiva(d),
    '',
    serviciosIncluidos(d),
  ]
    .join('\n')
    .replace(/^\n+/, '')
}

const CIERRE = 'Priority, siempre contigo.'

/** Adapta los datos a lo que esperan las plantillas de vehículos. */
function datosVeh(d: DatosBienvenida, formaPago: FormaPagoVehiculo): DatosVehiculo {
  return {
    saludo: d.saludo,
    aseguradora: d.aseguradora ?? '',
    plan: d.plan ?? null,
    vehiculo: [d.marca, d.modelo].filter(Boolean).join(' ') || null,
    placa: d.placa ?? null,
    vigencia: d.vigenciaDesde ?? null,
    formaPago,
  }
}

export const PLANTILLAS_BIENVENIDA: PlantillaBienvenida[] = [
  /**
   * Emisión de vehículos, con el diseño de Canva.
   *
   * Tres variantes por forma de pago, que es lo único que cambia entre ellas.
   * Van primero porque en autos hay una sola ejecutiva y es su caso de siempre.
   */
  {
    id: 'vehiculo-contado',
    label: 'Vehículo — pago de contado',
    descripcion: 'Con las cuentas bancarias de la aseguradora',
    construir: (d) => construirCorreoVehiculo('EMISION', datosVeh(d, 'CONTADO')),
  },
  {
    id: 'vehiculo-tarjeta',
    label: 'Vehículo — pago con tarjeta',
    descripcion: 'Con el enlace de pago de la aseguradora',
    construir: (d) => construirCorreoVehiculo('EMISION', datosVeh(d, 'TARJETA')),
  },
  {
    id: 'vehiculo-debito',
    label: 'Vehículo — débito bancario',
    descripcion: 'Débito mensual a cuotas',
    construir: (d) => construirCorreoVehiculo('EMISION', datosVeh(d, 'DEBITO')),
  },
  {
    id: 'sin-preexistencias',
    label: 'Sin preexistencias',
    descripcion: 'El cliente no declaró ningún diagnóstico',
    construir: (d) =>
      [
        apertura(d),
        '',
        'No mantiene preexistencias declaradas al momento. En caso de que requiera declarar ' +
          'algún diagnóstico no mencionado durante la emisión de su contrato, por favor ' +
          'repórtelo lo antes posible por este medio.',
        '',
        CIERRE,
      ].join('\n'),
  },
  {
    id: 'con-preexistencias',
    label: 'Con preexistencias',
    descripcion: 'El cliente tiene diagnósticos declarados y ya cubiertos',
    construir: (d) =>
      [
        apertura(d),
        '',
        'Su póliza registra los siguientes diagnósticos preexistentes, mismos que ya superaron ' +
          'el tiempo de carencia para cobertura. La cobertura para todas las preexistencias ' +
          'declaradas es de 20 SBU, monto renovable anualmente.',
        '',
        // Si no se cargaron, queda el hueco marcado: es preferible que la
        // ejecutiva vea que falta a que el correo salga con el párrafo vacío.
        d.preexistencias?.trim()
          ? d.preexistencias
              .split('\n')
              .map((l) => (l.trim() ? `• ${l.trim()}` : ''))
              .filter(Boolean)
              .join('\n')
          : '(agregar aquí los diagnósticos declarados)',
        '',
        CIERRE,
      ].join('\n'),
  },
  {
    id: 'contrato-digital',
    label: 'Contrato digital',
    descripcion: 'La póliza se firma digitalmente',
    construir: (d) =>
      [
        apertura(d),
        '',
        'El contrato es digital y llegará a su correo electrónico registrado para que lo acepte.',
        '',
        'No mantiene preexistencias declaradas al momento. En caso de que requiera declarar ' +
          'algún diagnóstico no mencionado durante la emisión de su contrato, por favor ' +
          'repórtelo lo antes posible por este medio.',
        '',
        CIERRE,
      ].join('\n'),
  },
]

/**
 * Plantilla por defecto según lo que se sepa del cliente.
 *
 * Si tiene preexistencias cargadas se propone esa; si no, la simple. Es una
 * propuesta, no una decisión: la ejecutiva puede cambiarla.
 */
export function plantillaSugerida(d: DatosBienvenida, tipoPoliza?: string | null): string {
  // En vehiculos se propone la variante segun como pague, para no tener que
  // elegirla casi nunca.
  if (tipoPoliza === 'AUTO' || tipoPoliza === 'VEHICULO') {
    const f = formaPagoVehiculo(d.formaPago ?? null)
    return f === 'TARJETA'
      ? 'vehiculo-tarjeta'
      : f === 'DEBITO'
        ? 'vehiculo-debito'
        : 'vehiculo-contado'
  }
  return d.preexistencias?.trim() ? 'con-preexistencias' : 'sin-preexistencias'
}

export function construirTextoBienvenida(
  plantillaId: string,
  d: DatosBienvenida,
  tipoPoliza?: string | null,
): string {
  const p =
    PLANTILLAS_BIENVENIDA.find((x) => x.id === plantillaId) ??
    PLANTILLAS_BIENVENIDA.find((x) => x.id === plantillaSugerida(d, tipoPoliza))!
  return p.construir(d)
}
