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

const TIPO_POLIZA: Record<string, string> = {
  SALUD: 'SALUD',
  VIDA: 'VIDA',
  AUTO: 'AUTO',
  VEHICULO: 'AUTO',
  HOGAR: 'HOGAR',
  ASISTENCIA: 'ASISTENCIA',
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
     * Agrupa por contrato: las filas del mismo N DE CONTRATO son una familia.
     *
     * Si una fila no trae contrato se agrupa por la cédula del titular, y si
     * tampoco, queda sola: es preferible un cliente suelto de más que fusionar
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
      const agenteUsuario = agenteTexto ? porClave.get(claveNombre(agenteTexto)) : undefined
      if (agenteTexto && !agenteUsuario) resumen.agentesSinUsuario.add(agenteTexto)

      const ejecutivaTexto = mayus(d.ejecutiva)
      const ejecutivaUsuario = ejecutivaTexto ? porClave.get(claveNombre(ejecutivaTexto)) : undefined
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
        fechaEmision: fecha(d.fechaEmision),
        contrato: mayus(d.tipoCliente) === 'CORPORATIVO' ? mayus(d.empresa) || 'CORPORATIVO' : 'INDIVIDUAL',
        estado: 'VIGENTE',
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
            resumen.yaExistian++
            resumen.clientes--
            resumen.polizas--
            resumen.dependientes -= deps.length
            avisos.push({
              fila: titular.fila,
              nivel: 'aviso',
              texto: `${cliente.nombres} ${cliente.apellidos}: el contrato ${poliza.numeroContrato} ya está cargado, se omitirá`,
            })
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
          // Mismo contrato ya cargado: es una re-subida del mismo archivo.
          resumen.yaExistian++
          avisos.push({
            fila: titular.fila,
            nivel: 'aviso',
            texto: `${cliente.nombres} ${cliente.apellidos}: el contrato ${poliza.numeroContrato} ya estaba cargado, se omite`,
          })
          continue
        }

        await this.prisma.$transaction(async (tx) => {
          await tx.poliza.create({ data: { ...poliza, clienteId: yaExiste.id } as any })
          // Los dependientes se agregan solo si no estaban ya: la misma familia
          // suele repetirse entre las pólizas de una persona.
          for (const dep of deps) {
            const existe = await tx.dependiente.findFirst({
              where: {
                clienteId: yaExiste.id,
                nombres: dep.nombres,
                apellidos: dep.apellidos ?? undefined,
              },
              select: { id: true },
            })
            if (!existe) {
              await tx.dependiente.create({ data: { ...dep, clienteId: yaExiste.id } as any })
            }
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
      await this.prisma.$transaction(async (tx) => {
        const creado = await tx.cliente.create({ data: cliente as any })
        await tx.poliza.create({ data: { ...poliza, clienteId: creado.id } as any })
        if (deps.length) {
          await tx.dependiente.createMany({
            data: deps.map((x) => ({ ...x, clienteId: creado.id })) as any,
          })
        }
      })
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
