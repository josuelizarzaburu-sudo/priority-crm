import { BadRequestException, ForbiddenException, Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { revisarIdentificacion } from '../../common/identificacion'

/**
 * Importación de la base histórica de clientes desde el Excel de operaciones.
 *
 * ESTRUCTURA DEL ARCHIVO: una fila por PERSONA, no por cliente. Las filas del
 * mismo N DE CONTRATO son una familia: la del TITULAR trae los datos de la
 * póliza (prima, plan, deducible) y las demás son sus dependientes, casi siempre
 * solo con el nombre.
 *
 * Por eso 20 filas pueden ser 7 clientes con 13 dependientes, y no 20 clientes.
 */

/** Una fila del Excel, ya con los nombres de columna normalizados. */
export interface FilaExcel {
  compania?: string
  numeroContrato?: string
  tipoSeguro?: string
  nombreCompleto?: string
  tipoCliente?: string
  nombrePreferido?: string
  rol?: string
  personaContacto?: string
  estado?: string
  empresa?: string
  referidoDe?: string
  agente?: string
  ejecutiva?: string
  cedula?: string
  fechaNacimiento?: string
  genero?: string
  fechaEmision?: string
  primaAnual?: string | number
  plan?: string
  deducible?: string | number
  ciudad?: string
  direccion?: string
  telefono?: string
  celular?: string
  correo?: string
  formaPago?: string
  frecuenciaPago?: string
  origen?: string
}

const t = (v: unknown): string =>
  v === null || v === undefined ? '' : String(v).trim().replace(/\s+/g, ' ')

/** Mayúsculas con locale español, igual que el resto del CRM. */
const mayus = (v: unknown): string => t(v).toLocaleUpperCase('es-EC')

/**
 * Cuantas letras hay que cambiar para pasar de una palabra a otra.
 *
 * Sirve para reconocer el mismo nombre escrito con erratas: "STEPHANY",
 * "STEPHANIE" y "STHEPANY" son la misma persona, y en el Excel aparecen las
 * tres.
 */
function distancia(a: string, b: string): number {
  if (a === b) return 0
  const m = a.length
  const n = b.length
  if (!m || !n) return Math.max(m, n)

  let previa = Array.from({ length: n + 1 }, (_, i) => i)
  for (let i = 1; i <= m; i++) {
    const actual = [i]
    for (let j = 1; j <= n; j++) {
      actual[j] = Math.min(
        previa[j] + 1,
        actual[j - 1] + 1,
        previa[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      )
    }
    previa = actual
  }
  return previa[n]
}

/**
 * ¿Son la misma palabra, aceptando erratas?
 *
 * La tolerancia crece con la longitud: en una palabra corta un cambio de letra
 * suele ser otro nombre ("ANA" y "ANE"), mientras que en una larga casi siempre
 * es una errata.
 */
function mismaPalabra(a: string, b: string): boolean {
  if (a === b) return true
  const largo = Math.min(a.length, b.length)
  if (largo <= 4) return false
  const tope = largo <= 6 ? 1 : 2
  return distancia(a, b) <= tope
}

/**
 * Nombre para comparar: sin tildes, sin dobles espacios y con la Z tratada como
 * S.
 *
 * Es lo que permite que "MOSQUERA" y "MOZQUERA" se reconozcan como la misma
 * persona, que fue justo el caso que planteó Josue. También "MARIA FERNANDA" y
 * "MARÍA FERNANDA".
 */
function claveNombre(v: string): string {
  return t(v)
    .toLocaleUpperCase('es-EC')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/Z/g, 'S')
    // Lo que no es letra se vuelve ESPACIO, no se borra: si se borrara,
    // "MARIA-JOSE" quedaria como "MARIAJOSE" y no coincidiria con "MARIA JOSE".
    .replace(/[^A-Z ]/g, ' ')
    // Los espacios se colapsan al final, ya con todo convertido: "ROXANA  AVILES"
    // no debe contar como una persona distinta de "ROXANA AVILES".
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * "ZALDUMBIDE SERRANO, MARIA DEL ROCIO" -> nombres y apellidos separados.
 *
 * El Excel usa "APELLIDOS, NOMBRES". Si falta la coma se parte por la mitad,
 * que es lo más razonable en un nombre ecuatoriano de cuatro palabras.
 */
function partirNombre(completo: string): { nombres: string; apellidos: string } {
  const s = t(completo)
  if (!s) return { nombres: '', apellidos: '' }

  if (s.includes(',')) {
    const [ape, nom] = s.split(',')
    return { nombres: mayus(nom), apellidos: mayus(ape) }
  }

  const partes = s.split(' ')
  if (partes.length <= 2) return { nombres: mayus(partes[0] ?? ''), apellidos: mayus(partes[1] ?? '') }
  const mitad = Math.ceil(partes.length / 2)
  return { nombres: mayus(partes.slice(mitad).join(' ')), apellidos: mayus(partes.slice(0, mitad).join(' ')) }
}

/** Fecha del Excel a Date en UTC. Sin hora: es un día de calendario. */
function fecha(v: unknown): Date | null {
  if (!v) return null
  if (v instanceof Date) {
    return new Date(Date.UTC(v.getFullYear(), v.getMonth(), v.getDate()))
  }
  const s = t(v)
  // ISO o "YYYY-MM-DD 00:00:00"
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (iso) return new Date(`${iso[1]}-${iso[2]}-${iso[3]}T00:00:00.000Z`)
  // DD/MM/YYYY o DD-MM-YYYY
  const dmy = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/)
  if (dmy) {
    const [, d, m, a] = dmy
    const anio = a.length === 2 ? (Number(a) > 30 ? `19${a}` : `20${a}`) : a
    return new Date(`${anio}-${m.padStart(2, '0')}-${d.padStart(2, '0')}T00:00:00.000Z`)
  }
  return null
}

function numero(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = Number(String(v).replace(/[^\d.,-]/g, '').replace(/,/g, ''))
  return Number.isFinite(n) ? n : null
}

/** El primero de varios correos separados por ; o ,. */
function primerCorreo(v: unknown): string | null {
  const s = t(v)
  if (!s) return null
  const primero = s.split(/[;,]/)[0].trim()
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(primero) ? primero : null
}

/**
 * Tipos de poliza. Solo estos cuatro existen en el enum TipoPoliza; cualquier
 * otro se carga como SALUD, que es el ramo de casi toda la base historica.
 */
const TIPO_POLIZA: Record<string, string> = {
  SALUD: 'SALUD',
  'ASISTENCIA MEDICA': 'SALUD',
  ASISTENCIA: 'SALUD',
  MEDICO: 'SALUD',
  VIDA: 'VIDA',
  AUTO: 'AUTO',
  VEHICULO: 'AUTO',
  VEHICULOS: 'AUTO',
  HOGAR: 'HOGAR',
}

const PARENTESCO: Record<string, string> = {
  CONYUGE: 'CONYUGE',
  CONYUGUE: 'CONYUGE',
  ESPOSA: 'CONYUGE',
  ESPOSO: 'CONYUGE',
  HIJO: 'HIJO',
  HIJA: 'HIJA',
  PADRE: 'PADRE',
  MADRE: 'MADRE',
  HERMANO: 'HERMANO',
  HERMANA: 'HERMANA',
}

const FORMA_PAGO: Record<string, string> = {
  CONTADO: 'CONTADO',
  'DEBITO BANCARIO': 'MENSUAL',
  'DEBITO MENSUAL': 'MENSUAL',
  MENSUAL: 'MENSUAL',
  DIFERIDO: 'DIFERIDO',
  'TARJETA DE CREDITO': 'DIFERIDO',
  'DIFERIDO ESPECIAL': 'DIFERIDO_ESPECIAL',
}

const ORIGEN: Record<string, string> = {
  PROPIO: 'PROPIO',
  'AGENTE PROPIO': 'PROPIO',
  PRIORITY: 'PRIORITY',
  'PRIORITY HEALTH': 'PRIORITY_HEALTH',
}

interface Aviso {
  fila: number
  nivel: 'error' | 'aviso'
  texto: string
}

@Injectable()
export class ImportacionService {
  private readonly logger = new Logger(ImportacionService.name)

  constructor(private readonly prisma: PrismaService) {}

  private exigirAdmin(role: string) {
    if (role !== 'SUPER_ADMIN') {
      throw new ForbiddenException('Solo SUPER_ADMIN puede importar la base de clientes')
    }
  }

  /**
   * Revisa el archivo y dice qué se va a cargar, SIN escribir nada.
   *
   * Existe para poder aprobar la carga viendo el resultado antes de que ocurra:
   * con 1.500 registros, descubrir un error de mapeo después de haber escrito es
   * mucho más caro que verlo antes.
   */
  async previsualizar(filas: FilaExcel[], organizationId: string, role: string) {
    this.exigirAdmin(role)
    return this.procesar(filas, organizationId, { escribir: false })
  }

  async importar(filas: FilaExcel[], organizationId: string, role: string) {
    this.exigirAdmin(role)
    return this.procesar(filas, organizationId, { escribir: true })
  }

  private async procesar(
    filas: FilaExcel[],
    organizationId: string,
    opciones: { escribir: boolean },
  ) {
    if (!Array.isArray(filas) || filas.length === 0) {
      throw new BadRequestException('El archivo no tiene filas')
    }

    const avisos: Aviso[] = []

    // Usuarios del CRM, para emparejar agentes y ejecutivas por nombre.
    const usuarios = await this.prisma.user.findMany({
      where: { organizationId },
      select: { id: true, name: true, role: true },
    })
    // El tipo va explicito: sin el, TypeScript deduce Map<string, {}> cuando la
    // lista viene vacia y despues no deja leer .id.
    const porClave = new Map<string, { id: string; name: string; role: string }>(
      usuarios.map((u) => [claveNombre(u.name), u] as const),
    )

    /**
     * Busca al usuario por nombre, tolerando que el Excel traiga una version
     * corta.
     *
     * El Excel escribe "ERIKA DIAZ" y en el CRM puede estar como "Erika
     * Alexandra Diaz Mora": nombre de pila y primer apellido, sin el segundo
     * nombre ni el segundo apellido.
     *
     * Se comprueba que TODAS las palabras del Excel esten en el nombre del
     * usuario, en cualquier posicion. Comparar solo las dos primeras fallaba
     * justo con quien tiene segundo nombre: tomaba "ERIKA ALEXANDRA" en vez de
     * "ERIKA DIAZ".
     *
     * Se exigen al menos DOS palabras y una sola coincidencia. Con "CAROLINA" a
     * secas, o si dos usuarios encajan, se deja sin enlazar: asignar los
     * clientes de alguien a la persona equivocada es peor que dejarlos sin
     * asignar.
     */
    const palabras = (v: string) => claveNombre(v).split(' ').filter(Boolean)

    const buscarUsuario = (texto: string) => {
      if (!texto) return undefined

      const exacto = porClave.get(claveNombre(texto))
      if (exacto) return exacto

      const buscadas = palabras(texto)
      if (buscadas.length < 2) return undefined

      // Primero se intenta la coincidencia exacta de palabras; solo si nadie
      // encaja se aceptan erratas. Asi un nombre bien escrito nunca se desvia
      // hacia otro parecido.
      const exactos = usuarios.filter((u) => {
        const suyas = palabras(u.name)
        return buscadas.every((p) => suyas.includes(p))
      })
      if (exactos.length === 1) return exactos[0]
      if (exactos.length > 1) return undefined

      const conErratas = usuarios.filter((u) => {
        const suyas = palabras(u.name)
        return buscadas.every((p) => suyas.some((q) => mismaPalabra(p, q)))
      })
      return conErratas.length === 1 ? conErratas[0] : undefined
    }

    /**
     * Agrupa por contrato: las filas del mismo N DE CONTRATO son una familia.
     *
     * Si una fila no trae contrato se agrupa por la cedula del titular, y si
     * tampoco, queda sola: es preferible un cliente suelto de mas que fusionar
     * dos familias distintas por error.
     */
    const grupos = new Map<string, { fila: number; datos: FilaExcel }[]>()
    filas.forEach((f, i) => {
      const clave = t(f.numeroContrato) || t(f.cedula) || `SIN-CONTRATO-${i}`
      const lista = grupos.get(clave) ?? []
      lista.push({ fila: i + 2, datos: f }) // +2: fila 1 son los encabezados
      grupos.set(clave, lista)
    })

    const resumen = {
      filas: filas.length,
      contratos: grupos.size,
      clientes: 0,
      dependientes: 0,
      polizas: 0,
      yaExistian: 0,
      polizasSumadas: 0,
      fallidos: 0,
      completados: 0,
      sinCedula: 0,
      cedulaInvalida: 0,
      agentesSinUsuario: new Set<string>(),
      ejecutivasSinUsuario: new Set<string>(),
    }

    const detalle: any[] = []

    for (const [contrato, miembros] of grupos) {
      // El titular es quien lo dice explícitamente; si ninguno lo dice, se toma
      // el que traiga cédula, y si tampoco, el primero. Un contrato sin titular
      // identificable igual se carga: perderlo sería peor.
      const titular =
        miembros.find((m) => mayus(m.datos.rol).includes('TITULAR')) ??
        miembros.find((m) => t(m.datos.cedula)) ??
        miembros[0]

      const dependientes = miembros.filter((m) => m !== titular)
      const d = titular.datos
      const { nombres, apellidos } = partirNombre(d.nombreCompleto ?? '')

      if (!nombres && !apellidos) {
        avisos.push({ fila: titular.fila, nivel: 'error', texto: 'Sin nombre: la fila se omite' })
        continue
      }

      const cedula = t(d.cedula)
      if (!cedula) {
        resumen.sinCedula++
        avisos.push({
          fila: titular.fila,
          nivel: 'aviso',
          texto: `${nombres} ${apellidos}: sin cédula. Se carga con un marcador y queda marcado para revisar.`,
        })
      } else if (revisarIdentificacion(cedula)) {
        resumen.cedulaInvalida++
        avisos.push({
          fila: titular.fila,
          nivel: 'aviso',
          texto: `${nombres} ${apellidos}: cédula ${cedula} no pasa la validación. Se carga igual y queda para revisar.`,
        })
      }

      // Sin cédula se usa el contrato como identificación, que es único y
      // permite volver a encontrar la ficha. Nunca se inventa una cédula.
      const identificacion = cedula || `SIN-CED-${contrato}`.slice(0, 20)

      const agenteTexto = mayus(d.agente)
      const agenteUsuario = buscarUsuario(agenteTexto)
      if (agenteTexto && !agenteUsuario) resumen.agentesSinUsuario.add(agenteTexto)

      const ejecutivaTexto = mayus(d.ejecutiva)
      const ejecutivaUsuario = buscarUsuario(ejecutivaTexto)
      if (ejecutivaTexto && !ejecutivaUsuario) resumen.ejecutivasSinUsuario.add(ejecutivaTexto)

      const cliente = {
        nombres,
        apellidos,
        identificacion,
        nombrePreferido: mayus(d.nombrePreferido) || null,
        email: primerCorreo(d.correo),
        celular: t(d.celular) || null,
        telefono: t(d.telefono) || null,
        ciudad: mayus(d.ciudad) || null,
        direccion: mayus(d.direccion) || null,
        genero: mayus(d.genero).startsWith('F') ? 'FEMENINO' : mayus(d.genero).startsWith('M') ? 'MASCULINO' : null,
        fechaNacimiento: fecha(d.fechaNacimiento),
        empresa: mayus(d.empresa) || null,
        tipoCliente: mayus(d.tipoCliente) || null,
        referidoDe: mayus(d.referidoDe) || null,
        contactoSugerido: mayus(d.personaContacto) || null,
        agenteNombre: agenteTexto || null,
        agenteId: agenteUsuario?.id ?? null,
        ejecutivoNombre: ejecutivaTexto || null,
        ejecutivoId: ejecutivaUsuario?.id ?? null,
        origenLead: ORIGEN[mayus(d.origen)] ?? null,
        // Se marca para revisar lo que llegó incompleto, en vez de dejarlo pasar
        // en silencio: así operaciones sabe qué fichas completar.
        revisar: !cedula || !primerCorreo(d.correo) || !fecha(d.fechaNacimiento),
        revisarMotivo:
          [
            !cedula ? 'sin cédula' : '',
            !primerCorreo(d.correo) ? 'sin correo' : '',
            !fecha(d.fechaNacimiento) ? 'sin fecha de nacimiento' : '',
          ]
            .filter(Boolean)
            .join(', ') || null,
        organizationId,
      }

      const poliza = {
        tipo: TIPO_POLIZA[mayus(d.tipoSeguro)] ?? 'SALUD',
        aseguradora: mayus(d.compania) || null,
        plan: mayus(d.plan) || null,
        numeroContrato: t(d.numeroContrato) || null,
        deducible: t(d.deducible) || null,
        primaNeta: numero(d.primaAnual),
        formaPago: FORMA_PAGO[mayus(d.formaPago)] ?? null,
        frecuenciaPago: t(d.frecuenciaPago) || null,
        // El agente va TAMBIEN en la poliza, no solo en el cliente: la ficha lo
        // muestra por poliza, que es lo correcto —una persona puede tener una
        // poliza vendida por un agente y otra por otro— y sin esto salia vacio.
        agenteNombre: agenteTexto || null,
        agenteId: agenteUsuario?.id ?? null,
        fechaEmision: fecha(d.fechaEmision),
        // El enum EstadoPoliza no tiene "VIGENTE": sus valores son NUEVO,
        // RENOVADO, CARTA_DE_NOMBRAMIENTO y CANCELADA. La base historica son
        // polizas que ya venian de antes, asi que entran como RENOVADO.
        estado: mayus(d.estado).includes('CANCELAD') ? 'CANCELADA' : 'RENOVADO',
        organizationId,
      }

      const deps = dependientes.map((m) => {
        const n = partirNombre(m.datos.nombreCompleto ?? '')
        return {
          nombres: n.nombres,
          apellidos: n.apellidos || null,
          identificacion: t(m.datos.cedula) || null,
          fechaNacimiento: fecha(m.datos.fechaNacimiento),
          parentesco: PARENTESCO[mayus(m.datos.rol)] ?? 'OTRO',
        }
      })

      resumen.clientes++
      resumen.polizas++
      resumen.dependientes += deps.length

      // En la previsualización se avisa de lo que ya está en la base, para que
      // el informe diga qué va a pasar con cada uno antes de escribir.
      if (!opciones.escribir) {
        const existente = await this.prisma.cliente.findUnique({
          where: { organizationId_identificacion: { organizationId, identificacion } },
          select: { id: true },
        })
        if (existente) {
          const mismoContrato = poliza.numeroContrato
            ? await this.prisma.poliza.findFirst({
                where: { clienteId: existente.id, numeroContrato: poliza.numeroContrato },
                select: { id: true },
              })
            : null
          if (mismoContrato) {
            resumen.clientes--
            resumen.polizas--
            resumen.dependientes -= deps.length

            // Se mira si hay huecos que rellenar, para decirlo antes de escribir.
            const actual = await this.prisma.poliza.findUnique({
              where: { id: mismoContrato.id },
              select: { agenteNombre: true, frecuenciaPago: true },
            })
            // Tambien se mira si a la poliza le faltan los enlaces con sus
            // dependientes: es lo que hacia que dijera "cubre a ningun
            // dependiente" aunque la familia estuviera cargada.
            const enlaces = await this.prisma.polizaDependiente.count({
              where: { polizaId: mismoContrato.id },
            })

            const huecos = [
              !actual?.agenteNombre && poliza.agenteNombre ? 'agente' : '',
              !actual?.frecuenciaPago && poliza.frecuenciaPago ? 'frecuencia de pago' : '',
              deps.length > enlaces
                ? `${deps.length - enlaces} dependiente(s) por enlazar a la póliza`
                : '',
            ].filter(Boolean)

            if (huecos.length) {
              resumen.completados++
              avisos.push({
                fila: titular.fila,
                nivel: 'aviso',
                texto: `${cliente.nombres} ${cliente.apellidos}: ya está cargado; se completará ${huecos.join(', ')}`,
              })
            } else {
              resumen.yaExistian++
              avisos.push({
                fila: titular.fila,
                nivel: 'aviso',
                texto: `${cliente.nombres} ${cliente.apellidos}: el contrato ${poliza.numeroContrato} ya está cargado, se omitirá`,
              })
            }
          } else {
            resumen.polizasSumadas++
            resumen.clientes--
            avisos.push({
              fila: titular.fila,
              nivel: 'aviso',
              texto: `${cliente.nombres} ${cliente.apellidos}: ya existe, se le sumará la póliza de ${poliza.aseguradora ?? 'otra aseguradora'}`,
            })
          }
        }
      }

      detalle.push({
        contrato,
        cliente: `${cliente.nombres} ${cliente.apellidos}`.trim(),
        identificacion: cliente.identificacion,
        aseguradora: poliza.aseguradora,
        plan: poliza.plan,
        prima: poliza.primaNeta,
        agente: cliente.agenteNombre,
        agenteEnCrm: !!cliente.agenteId,
        ejecutiva: cliente.ejecutivoNombre,
        dependientes: deps.length,
        revisar: cliente.revisar,
        motivo: cliente.revisarMotivo,
      })

      if (!opciones.escribir) continue

      // ── Escritura ──
      const yaExiste = await this.prisma.cliente.findUnique({
        where: { organizationId_identificacion: { organizationId, identificacion } },
        select: { id: true },
      })

      // Cliente ya cargado: se le SUMA esta póliza en vez de descartarla.
      //
      // Una misma persona puede tener varios contratos —salud con una
      // aseguradora y auto con otra— y en el Excel vienen como filas separadas.
      // Omitir el segundo perdería esa póliza sin que nadie lo notara.
      //
      // Los datos personales no se pisan: los del primer contrato ya están, y
      // sobrescribirlos con los del segundo podría reemplazar un dato bueno por
      // uno viejo.
      if (yaExiste) {
        const mismaPoliza = poliza.numeroContrato
          ? await this.prisma.poliza.findFirst({
              where: { clienteId: yaExiste.id, numeroContrato: poliza.numeroContrato },
              select: { id: true },
            })
          : null

        if (mismaPoliza) {
          // Mismo contrato ya cargado. No se recrea, pero SI se completan los
          // datos que esten vacios: si una carga anterior dejo huecos —como paso
          // con el agente—, volver a subir el archivo los rellena en vez de
          // obligar a vaciar y empezar de nuevo.
          //
          // Solo rellena lo VACIO: nunca pisa un dato que ya este puesto, que
          // podria haberse corregido a mano despues de la carga.
          const actual = await this.prisma.poliza.findUnique({
            where: { id: mismaPoliza.id },
            select: { agenteNombre: true, agenteId: true, frecuenciaPago: true },
          })
          const completar: Record<string, unknown> = {}
          if (!actual?.agenteNombre && poliza.agenteNombre) {
            completar.agenteNombre = poliza.agenteNombre
          }
          if (!actual?.agenteId && poliza.agenteId) completar.agenteId = poliza.agenteId
          if (!actual?.frecuenciaPago && poliza.frecuenciaPago) {
            completar.frecuenciaPago = poliza.frecuenciaPago
          }

          // Enlaces de dependientes que falten. Las cargas anteriores creaban
          // los dependientes pero no los enlazaban a la poliza, asi que la ficha
          // decia "cubre a ningun dependiente".
          let enlazados = 0
          if (opciones.escribir && deps.length) {
            for (const dep of deps) {
              const existente = await this.prisma.dependiente.findFirst({
                where: {
                  clienteId: yaExiste.id,
                  nombres: dep.nombres,
                  apellidos: dep.apellidos ?? undefined,
                },
                select: { id: true },
              })
              const id =
                existente?.id ??
                (
                  await this.prisma.dependiente.create({
                    data: { ...dep, clienteId: yaExiste.id } as any,
                  })
                ).id
              const yaEnlazado = await this.prisma.polizaDependiente.findUnique({
                where: { polizaId_dependienteId: { polizaId: mismaPoliza.id, dependienteId: id } },
              })
              if (!yaEnlazado) {
                await this.prisma.polizaDependiente.create({
                  data: { polizaId: mismaPoliza.id, dependienteId: id },
                })
                enlazados++
              }
            }
          }

          if ((Object.keys(completar).length || enlazados > 0) && opciones.escribir) {
            if (Object.keys(completar).length) {
              await this.prisma.poliza.update({ where: { id: mismaPoliza.id }, data: completar })
            }
            resumen.completados++
            avisos.push({
              fila: titular.fila,
              nivel: 'aviso',
              texto: `${cliente.nombres} ${cliente.apellidos}: ya estaba cargado; se completó ${
                [
                  ...Object.keys(completar),
                  enlazados > 0 ? `${enlazados} dependiente(s) enlazados a la póliza` : '',
                ]
                  .filter(Boolean)
                  .join(', ')
              }`,
            })
          } else {
            resumen.yaExistian++
            avisos.push({
              fila: titular.fila,
              nivel: 'aviso',
              texto: `${cliente.nombres} ${cliente.apellidos}: el contrato ${poliza.numeroContrato} ya estaba cargado, se omite`,
            })
          }
          continue
        }

        await this.prisma.$transaction(async (tx) => {
          const polizaCreada = await tx.poliza.create({
            data: { ...poliza, clienteId: yaExiste.id } as any,
          })
          // El dependiente se reutiliza si ya existe —la misma familia suele
          // repetirse entre las pólizas de una persona— pero SIEMPRE se enlaza a
          // la póliza nueva: es otra póliza que también lo cubre.
          for (const dep of deps) {
            const existe = await tx.dependiente.findFirst({
              where: {
                clienteId: yaExiste.id,
                nombres: dep.nombres,
                apellidos: dep.apellidos ?? undefined,
              },
              select: { id: true },
            })
            const id =
              existe?.id ??
              (await tx.dependiente.create({ data: { ...dep, clienteId: yaExiste.id } as any })).id
            await tx.polizaDependiente.create({
              data: { polizaId: polizaCreada.id, dependienteId: id },
            })
          }
        })

        resumen.polizasSumadas++
        avisos.push({
          fila: titular.fila,
          nivel: 'aviso',
          texto: `${cliente.nombres} ${cliente.apellidos}: ya existía, se le sumó la póliza de ${poliza.aseguradora ?? 'otra aseguradora'}`,
        })
        continue
      }

      // Cliente, póliza y dependientes en una sola transacción: si algo falla,
      // no queda un cliente a medias sin su póliza.
      //
      // El error se captura por fila: si una da problemas, se anota y se sigue
      // con las demás. Cortar toda la importación por un registro malo obligaría
      // a empezar de cero, y con 1.500 filas eso es carísimo.
      try {
        await this.prisma.$transaction(async (tx) => {
          const creado = await tx.cliente.create({ data: cliente as any })
          const polizaCreada = await tx.poliza.create({
            data: { ...poliza, clienteId: creado.id } as any,
          })

          // Los dependientes se ENLAZAN a la póliza, no solo se crean.
          //
          // Si vienen bajo el mismo número de contrato es porque esa póliza los
          // cubre: es lo que significa la columna TITULAR - DEPENDIENTE. Sin el
          // enlace, la ficha decía "cubre a ningún dependiente" aunque la
          // familia estuviera cargada.
          for (const dep of deps) {
            const creadoDep = await tx.dependiente.create({
              data: { ...dep, clienteId: creado.id } as any,
            })
            await tx.polizaDependiente.create({
              data: { polizaId: polizaCreada.id, dependienteId: creadoDep.id },
            })
          }
        })
      } catch (e: any) {
        resumen.clientes--
        resumen.polizas--
        resumen.dependientes -= deps.length
        resumen.fallidos++
        // Se guarda el motivo real, no un "error interno": con 1.500 filas hay
        // que poder ver QUÉ pasó sin entrar a los registros del servidor.
        avisos.push({
          fila: titular.fila,
          nivel: 'error',
          texto: `${cliente.nombres} ${cliente.apellidos}: no se pudo cargar — ${
            e?.message?.split('\n').pop()?.trim() ?? 'error desconocido'
          }`,
        })
        this.logger.error(`[importacion] fila ${titular.fila}: ${e}`)
      }
    }

    return {
      modo: opciones.escribir ? 'importado' : 'previsualización',
      resumen: {
        ...resumen,
        agentesSinUsuario: [...resumen.agentesSinUsuario],
        ejecutivasSinUsuario: [...resumen.ejecutivasSinUsuario],
      },
      avisos,
      detalle,
    }
  }

  /**
   * Vacía clientes y todo lo que cuelga de ellos.
   *
   * NO toca los leads ni los deals, como pidió Josue: el pipeline comercial se
   * conserva.
   *
   * Exige una frase de confirmación escrita a mano. Es irreversible, y un botón
   * suelto que borra 1.500 clientes es demasiado fácil de pulsar por error.
   */
  /**
   * Enlaza los clientes que tienen NOMBRE de ejecutiva o agente pero no su id.
   *
   * Hace falta porque la importacion exigia el nombre completo identico: los
   * clientes de "CAROLINA TERNEUS" no se enlazaron a "Carolina Terneus Toledo",
   * y al entrar ella no veia ninguno.
   *
   * No pisa lo que ya este puesto: si alguien reasigno un cliente a mano, esa
   * decision manda sobre lo que diga el Excel.
   */
  async reenlazarUsuarios(organizationId: string, role: string) {
    this.exigirAdmin(role)

    const usuarios = await this.prisma.user.findMany({
      where: { organizationId },
      select: { id: true, name: true },
    })

    // Misma comparacion que en la importacion: todas las palabras del Excel
    // deben estar en el nombre del usuario, en cualquier posicion. Asi "ERIKA
    // DIAZ" encuentra a "Erika Alexandra Diaz Mora".
    const palabras = (v: string) => claveNombre(v).split(' ').filter(Boolean)

    const buscar = (texto: string | null) => {
      if (!texto) return undefined
      const exacto = usuarios.find((u) => claveNombre(u.name) === claveNombre(texto))
      if (exacto) return exacto
      const buscadas = palabras(texto)
      if (buscadas.length < 2) return undefined
      const exactos = usuarios.filter((u) => {
        const suyas = palabras(u.name)
        return buscadas.every((p) => suyas.includes(p))
      })
      if (exactos.length === 1) return exactos[0]
      if (exactos.length > 1) return undefined

      // Con erratas: "STEPHANIE SOSA" encuentra a "Stephany Sosa".
      const conErratas = usuarios.filter((u) => {
        const suyas = palabras(u.name)
        return buscadas.every((p) => suyas.some((q) => mismaPalabra(p, q)))
      })
      return conErratas.length === 1 ? conErratas[0] : undefined
    }

    const clientes = await this.prisma.cliente.findMany({
      where: {
        organizationId,
        OR: [
          { ejecutivoId: null, ejecutivoNombre: { not: null } },
          { agenteId: null, agenteNombre: { not: null } },
        ],
      },
      select: {
        id: true,
        ejecutivoId: true,
        ejecutivoNombre: true,
        agenteId: true,
        agenteNombre: true,
      },
    })

    let ejecutivas = 0
    let agentes = 0
    const sinEnlazar = new Set<string>()

    for (const c of clientes) {
      const cambios: Record<string, string> = {}

      if (!c.ejecutivoId && c.ejecutivoNombre) {
        const u = buscar(c.ejecutivoNombre)
        if (u) {
          cambios.ejecutivoId = u.id
          ejecutivas++
        } else sinEnlazar.add(c.ejecutivoNombre)
      }

      if (!c.agenteId && c.agenteNombre) {
        const u = buscar(c.agenteNombre)
        if (u) {
          cambios.agenteId = u.id
          agentes++
        } else sinEnlazar.add(c.agenteNombre)
      }

      if (Object.keys(cambios).length) {
        await this.prisma.cliente.update({ where: { id: c.id }, data: cambios })
      }
    }

    // Las polizas guardan su propio agente: se enlazan igual.
    const polizas = await this.prisma.poliza.findMany({
      where: { organizationId, agenteId: null, agenteNombre: { not: null } },
      select: { id: true, agenteNombre: true },
    })
    let polizasEnlazadas = 0
    for (const p of polizas) {
      const u = buscar(p.agenteNombre)
      if (u) {
        await this.prisma.poliza.update({ where: { id: p.id }, data: { agenteId: u.id } })
        polizasEnlazadas++
      }
    }

    /**
     * Cuantos clientes quedan por ejecutiva, para poder comprobar de un vistazo
     * que cada una tiene los suyos sin entrar con su usuario.
     */
    const porEjecutiva = await this.prisma.cliente.groupBy({
      by: ['ejecutivoNombre'],
      where: { organizationId, ejecutivoNombre: { not: null } },
      _count: { _all: true },
    })
    const conUsuario = await this.prisma.cliente.groupBy({
      by: ['ejecutivoNombre'],
      where: { organizationId, ejecutivoId: { not: null } },
      _count: { _all: true },
    })
    const mapaConUsuario = new Map(
      conUsuario.map((r) => [r.ejecutivoNombre ?? '', r._count._all]),
    )

    return {
      revisados: clientes.length,
      ejecutivasEnlazadas: ejecutivas,
      agentesEnlazados: agentes,
      polizasEnlazadas,
      // nombre -> cuantos clientes tiene y cuantos quedaron enlazados
      resumenPorEjecutiva: porEjecutiva
        .map((r) => ({
          nombre: r.ejecutivoNombre ?? '',
          total: r._count._all,
          enlazados: mapaConUsuario.get(r.ejecutivoNombre ?? '') ?? 0,
        }))
        .sort((a, b) => b.total - a.total),
      // Los que no coinciden con nadie: vendedores externos, o nombres que hay
      // que corregir a mano.
      sinUsuarioEnElCrm: [...sinEnlazar],
    }
  }

  async vaciarClientes(organizationId: string, role: string, confirmacion: string) {
    this.exigirAdmin(role)
    if (t(confirmacion) !== 'BORRAR TODOS LOS CLIENTES') {
      throw new BadRequestException(
        'Para vaciar la base hay que escribir exactamente: BORRAR TODOS LOS CLIENTES',
      )
    }

    // Se cuenta ANTES de borrar para poder informar cuánto se llevó: después ya
    // no hay forma de saberlo.
    const [antes, polizasAntes, renovacionesAntes] = await Promise.all([
      this.prisma.cliente.count({ where: { organizationId } }),
      this.prisma.poliza.count({ where: { organizationId } }),
      this.prisma.renovacion.count({ where: { organizationId } }),
    ])

    // El orden importa: primero lo que apunta a clientes sin borrarse en
    // cascada, o quedarían huérfanos apuntando a fichas que ya no existen.
    const [reqs, tareas, reclamos] = await this.prisma.$transaction([
      this.prisma.requerimiento.deleteMany({ where: { organizationId } }),
      this.prisma.tarea.updateMany({
        where: { organizationId, clienteId: { not: null } },
        data: { clienteId: null },
      }),
      this.prisma.reclamo.deleteMany({ where: { organizationId } }),
    ])

    // Al borrar el cliente se van EN CASCADA: sus polizas, y con cada poliza sus
    // renovaciones; ademas dependientes, notas y correos automaticos.
    const borrados = await this.prisma.cliente.deleteMany({ where: { organizationId } })

    this.logger.warn(
      `[importacion] base vaciada: ${borrados.count} clientes, ${reqs.count} requerimientos, ${reclamos.count} reclamos`,
    )

    return {
      clientesBorrados: borrados.count,
      // Reembolsos: en el CRM el modulo se llama asi, en la base son Reclamos.
      reembolsosBorrados: reclamos.count,
      requerimientosBorrados: reqs.count,
      // Se fueron en cascada con sus clientes y polizas.
      polizasBorradas: polizasAntes,
      renovacionesBorradas: renovacionesAntes,
      // Las tareas NO se borran: pueden ser de trabajo interno. Solo se les
      // quita el cliente al que apuntaban.
      tareasDesvinculadas: tareas.count,
      habia: antes,
    }
  }
}
