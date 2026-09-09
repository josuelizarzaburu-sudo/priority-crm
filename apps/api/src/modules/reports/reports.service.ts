import { ForbiddenException, Injectable } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { veSoloSuEquipo } from '../equipos/equipos-scope'
import { EquiposService } from '../equipos/equipos.service'
import { soloVeSusNegocios } from '../pipeline/puede-vender'

/**
 * Una venta ganada, ya desarmada para el reporte.
 *
 * Un deal puede traer VARIAS pólizas (una familia que asegura a tres personas),
 * y cada una es una venta distinta con su plan, su prima y su titular. Por eso
 * el reporte tiene una fila por PÓLIZA, no por deal: si contara deals, "3 ventas
 * de BMI" aparecería como una sola.
 */
export interface FilaVenta {
  dealId: string
  titular: string
  aseguradora: string | null
  plan: string | null
  ramo: string | null
  /** Fecha de emisión de la póliza; si falta, la de cierre del deal. */
  vigencia: string | null
  formaPago: string | null
  primaAnual: number
  agenteId: string | null
  agente: string
  origen: string
  cerradoEn: string | null
  /** Días entre la creación del lead y el cierre. Mide la efectividad. */
  diasHastaCierre: number | null
}

const FORMA_PAGO: Record<string, string> = {
  'debito-mensual': 'Débito mensual',
  mensual: 'Débito mensual',
  contado: 'Contado',
  diferido: 'Diferido',
  'diferido-especial': 'Diferido especial',
  anual: 'Anual',
  semestral: 'Semestral',
  trimestral: 'Trimestral',
}

const ORIGEN: Record<string, string> = {
  PRIORITY_HEALTH: 'Priority Health',
  PRIORITY: 'Priority',
  PROPIO: 'Propio',
}

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly equipos: EquiposService,
  ) {}

  /**
   * Ventas ganadas del período.
   *
   * Se filtra por FECHA DE CIERRE, no de creación: una venta cerrada en agosto
   * cuenta en agosto aunque el lead haya entrado en julio. Es lo que hace que
   * los totales cuadren con lo que ve el equipo en el pipeline.
   */
  async ventasGanadas(
    organizationId: string,
    userId: string,
    role: string,
    puedeVender: boolean | undefined,
    query: { desde?: string; hasta?: string; agenteId?: string },
  ) {
    const where: any = { organizationId, status: 'WON' }

    // Mismo alcance que el pipeline: un vendedor ve lo suyo, un jefe su equipo.
    // Sin esto, el reporte sería una puerta trasera para ver las ventas de todos.
    if (soloVeSusNegocios(role, puedeVender)) {
      where.assignedToId = userId
    } else if (veSoloSuEquipo(role)) {
      const miembros = await this.equipos.miembrosDelJefe(userId, organizationId)
      where.assignedToId = { in: [userId, ...miembros] }
    }

    if (query.agenteId) {
      // Se cruza con el alcance en vez de reemplazarlo: pedir el id de alguien de
      // otro equipo no debe abrir sus ventas.
      const permitido =
        !where.assignedToId ||
        (typeof where.assignedToId === 'string' && where.assignedToId === query.agenteId) ||
        (where.assignedToId?.in && where.assignedToId.in.includes(query.agenteId))
      if (permitido) where.assignedToId = query.agenteId
    }

    // El rango se interpreta en hora de Ecuador: 'desde' arranca a las 00:00
    // locales y 'hasta' termina a las 23:59:59, o el último día quedaría fuera.
    if (query.desde || query.hasta) {
      where.closedAt = {}
      if (query.desde) where.closedAt.gte = new Date(`${query.desde}T00:00:00-05:00`)
      if (query.hasta) where.closedAt.lte = new Date(`${query.hasta}T23:59:59.999-05:00`)
    }

    const deals = await this.prisma.deal.findMany({
      where,
      orderBy: { closedAt: 'desc' },
      include: {
        assignedTo: { select: { id: true, name: true } },
        contact: { select: { firstName: true, lastName: true } },
      },
    })

    const filas: FilaVenta[] = []

    for (const d of deals) {
      const cf = (d.customFields ?? {}) as any
      const entradas = Array.isArray(cf.insuranceData)
        ? cf.insuranceData
        : cf.insuranceData
          ? [cf.insuranceData]
          : []

      const agente = d.assignedTo?.name ?? 'Sin asignar'
      const origen = ORIGEN[cf.leadOrigin as string] ?? 'Propio'
      const nombreContacto = d.contact
        ? `${d.contact.firstName} ${d.contact.lastName ?? ''}`.trim()
        : d.title

      // Días desde que entró el lead hasta el cierre. Se prefiere leadCreatedAt
      // porque el deal puede haberse registrado después de que llegó el lead.
      const inicio = cf.leadCreatedAt ? new Date(cf.leadCreatedAt) : d.createdAt
      const diasHastaCierre =
        d.closedAt && inicio
          ? Math.max(
              0,
              Math.round((d.closedAt.getTime() - new Date(inicio).getTime()) / 86_400_000),
            )
          : null

      if (entradas.length === 0) {
        // Deal ganado sin datos de póliza: se incluye igual con lo que haya. Si
        // se omitiera, el total del reporte no cuadraría con el del pipeline y
        // nadie sabría por qué falta.
        filas.push({
          dealId: d.id,
          titular: nombreContacto,
          aseguradora: null,
          plan: null,
          ramo: null,
          vigencia: d.closedAt?.toISOString() ?? null,
          formaPago: null,
          primaAnual: typeof d.value === 'number' ? d.value : 0,
          agenteId: d.assignedTo?.id ?? null,
          agente,
          origen,
          cerradoEn: d.closedAt?.toISOString() ?? null,
          diasHastaCierre,
        })
        continue
      }

      for (const e of entradas) {
        filas.push({
          dealId: d.id,
          titular: (e?.holderName as string)?.trim() || nombreContacto,
          aseguradora: e?.aseguradora ?? null,
          plan: e?.plan ?? null,
          ramo: e?.ramo ?? null,
          vigencia: e?.issueDate ?? d.closedAt?.toISOString() ?? null,
          formaPago: FORMA_PAGO[e?.paymentFrequency as string] ?? e?.paymentFrequency ?? null,
          primaAnual: typeof e?.netPremium === 'number' ? e.netPremium : 0,
          agenteId: d.assignedTo?.id ?? null,
          agente,
          origen,
          cerradoEn: d.closedAt?.toISOString() ?? null,
          diasHastaCierre,
        })
      }
    }

    return {
      filas,
      resumen: this.resumir(filas),
      porAgente: this.agrupar(filas, (f) => f.agente),
      porAseguradora: this.agrupar(filas, (f) => f.aseguradora ?? 'Sin aseguradora'),
      porOrigen: this.agrupar(filas, (f) => f.origen),
    }
  }

  private resumir(filas: FilaVenta[]) {
    const conDias = filas.filter((f) => f.diasHastaCierre !== null)
    return {
      // Ventas cuenta PÓLIZAS y negocios cuenta DEALS: una familia con tres
      // pólizas es una negociación y tres ventas, y las dos cifras importan.
      ventas: filas.length,
      negocios: new Set(filas.map((f) => f.dealId)).size,
      primaTotal: filas.reduce((s, f) => s + f.primaAnual, 0),
      primaPromedio: filas.length
        ? filas.reduce((s, f) => s + f.primaAnual, 0) / filas.length
        : 0,
      diasPromedioCierre: conDias.length
        ? Math.round(
            conDias.reduce((s, f) => s + (f.diasHastaCierre ?? 0), 0) / conDias.length,
          )
        : null,
    }
  }

  /** Agrupa para los gráficos: cuántas ventas y cuánta prima por categoría. */
  private agrupar(filas: FilaVenta[], clave: (f: FilaVenta) => string) {
    const mapa = new Map<string, { nombre: string; ventas: number; prima: number; negocios: Set<string> }>()
    for (const f of filas) {
      const k = clave(f)
      const actual = mapa.get(k) ?? { nombre: k, ventas: 0, prima: 0, negocios: new Set<string>() }
      actual.ventas += 1
      actual.prima += f.primaAnual
      actual.negocios.add(f.dealId)
      mapa.set(k, actual)
    }
    return [...mapa.values()]
      .map((v) => ({ nombre: v.nombre, ventas: v.ventas, prima: v.prima, negocios: v.negocios.size }))
      .sort((a, b) => b.prima - a.prima)
  }

  /** Agentes con ventas, para el desplegable del filtro. */
  async agentesConVentas(organizationId: string, userId: string, role: string, puedeVender?: boolean) {
    const where: any = { organizationId, status: 'WON' }
    if (soloVeSusNegocios(role, puedeVender)) {
      where.assignedToId = userId
    } else if (veSoloSuEquipo(role)) {
      const miembros = await this.equipos.miembrosDelJefe(userId, organizationId)
      where.assignedToId = { in: [userId, ...miembros] }
    }

    const deals = await this.prisma.deal.findMany({
      where,
      select: { assignedTo: { select: { id: true, name: true } } },
      distinct: ['assignedToId'],
    })
    return deals
      .filter((d) => d.assignedTo)
      .map((d) => d.assignedTo!)
      .sort((a, b) => a.name.localeCompare(b.name, 'es'))
  }
  /**
   * Embudo: cuántos leads hay en cada etapa y cuánto valen.
   *
   * Responde una pregunta distinta a la del reporte de ventas: aquel mira lo que
   * YA se cerró, este lo que está en juego ahora y dónde se atasca.
   *
   * Se filtra por cuándo ENTRÓ el lead, no por cierre: un embudo es una foto de
   * la camada que entró en ese período y de hasta dónde llegó cada uno.
   */
  async embudo(
    organizationId: string,
    userId: string,
    role: string,
    puedeVender: boolean | undefined,
    query: { desde?: string; hasta?: string; agenteId?: string },
  ) {
    const where: any = { organizationId }

    if (soloVeSusNegocios(role, puedeVender)) {
      where.assignedToId = userId
    } else if (veSoloSuEquipo(role)) {
      const miembros = await this.equipos.miembrosDelJefe(userId, organizationId)
      where.assignedToId = { in: [userId, ...miembros] }
    }
    if (query.agenteId) {
      const permitido =
        !where.assignedToId ||
        (typeof where.assignedToId === 'string' && where.assignedToId === query.agenteId) ||
        (where.assignedToId?.in && where.assignedToId.in.includes(query.agenteId))
      if (permitido) where.assignedToId = query.agenteId
    }

    if (query.desde || query.hasta) {
      where.createdAt = {}
      if (query.desde) where.createdAt.gte = new Date(`${query.desde}T00:00:00-05:00`)
      if (query.hasta) where.createdAt.lte = new Date(`${query.hasta}T23:59:59.999-05:00`)
    }

    const [deals, etapas] = await Promise.all([
      this.prisma.deal.findMany({
        where,
        include: {
          stage: { select: { id: true, name: true, position: true } },
          assignedTo: { select: { id: true, name: true } },
        },
      }),
      this.prisma.pipelineStage.findMany({
        where: { organizationId },
        orderBy: { position: 'asc' },
        select: { id: true, name: true, position: true },
      }),
    ])

    const valorDe = (d: any) => {
      if (typeof d.value === 'number' && d.value > 0) return d.value
      const ins = (d.customFields as any)?.insuranceData
      if (Array.isArray(ins)) {
        return ins.reduce(
          (s: number, e: any) => s + (typeof e?.netPremium === 'number' ? e.netPremium : 0),
          0,
        )
      }
      return 0
    }

    // Ganados y perdidos van APARTE de las etapas: un deal ganado sigue teniendo
    // su etapa guardada, y contarlo ahí inflaría "Negociación" con negocios que
    // ya no se están negociando.
    const abiertos = deals.filter((d) => d.status === 'OPEN')
    const ganados = deals.filter((d) => d.status === 'WON')
    const perdidos = deals.filter((d) => d.status === 'LOST')

    const porEtapa = etapas.map((e) => {
      const enEtapa = abiertos.filter((d) => d.stageId === e.id)
      return {
        etapa: e.name,
        posicion: e.position,
        leads: enEtapa.length,
        valor: enEtapa.reduce((s, d) => s + valorDe(d), 0),
      }
    })

    // Motivos de pérdida, para saber por qué se cae la gente. Es lo más útil de
    // los perdidos y hoy no se veía en ningún reporte.
    //
    // El motivo se guarda en `notes`: al cerrar un deal como perdido, closeDeal
    // escribe ahí lo que puso el asesor. No hay un campo propio para esto.
    const motivos = new Map<string, number>()
    for (const d of perdidos) {
      const m = (d.notes ?? '').trim() || 'Sin motivo registrado'
      motivos.set(m, (motivos.get(m) ?? 0) + 1)
    }

    const agentes = new Map<string, { nombre: string; abiertos: number; ganados: number; perdidos: number; valor: number }>()
    for (const d of deals) {
      const nombre = d.assignedTo?.name ?? 'Sin asignar'
      const a = agentes.get(nombre) ?? { nombre, abiertos: 0, ganados: 0, perdidos: 0, valor: 0 }
      if (d.status === 'OPEN') {
        a.abiertos += 1
        a.valor += valorDe(d)
      } else if (d.status === 'WON') a.ganados += 1
      else if (d.status === 'LOST') a.perdidos += 1
      agentes.set(nombre, a)
    }

    const cerrados = ganados.length + perdidos.length

    return {
      porEtapa,
      resumen: {
        total: deals.length,
        abiertos: abiertos.length,
        ganados: ganados.length,
        perdidos: perdidos.length,
        valorEnJuego: abiertos.reduce((s, d) => s + valorDe(d), 0),
        // La conversión se mide sobre los CERRADOS, no sobre el total: incluir
        // los que siguen abiertos la hundiría sin que nadie haya perdido nada
        // todavía.
        conversion: cerrados > 0 ? Math.round((ganados.length / cerrados) * 100) : null,
      },
      porAgente: [...agentes.values()].sort((a, b) => b.abiertos - a.abiertos),
      motivosPerdida: [...motivos.entries()]
        .map(([motivo, cantidad]) => ({ motivo, cantidad }))
        .sort((a, b) => b.cantidad - a.cantidad),
    }
  }

  /**
   * Tiempo de cierre: cuánto tarda un lead desde que entra hasta que se cierra.
   *
   * No importan las etapas por las que pasó, solo el total. Es una medida de
   * efectividad: dos vendedores con la misma conversión pero uno cerrando en 8
   * días y otro en 40 no rinden igual.
   */
  async tiemposDeCierre(
    organizationId: string,
    userId: string,
    role: string,
    puedeVender: boolean | undefined,
    query: { desde?: string; hasta?: string; agenteId?: string },
  ) {
    const where: any = { organizationId, status: { in: ['WON', 'LOST'] }, closedAt: { not: null } }

    if (soloVeSusNegocios(role, puedeVender)) {
      where.assignedToId = userId
    } else if (veSoloSuEquipo(role)) {
      const miembros = await this.equipos.miembrosDelJefe(userId, organizationId)
      where.assignedToId = { in: [userId, ...miembros] }
    }
    if (query.agenteId) {
      const permitido =
        !where.assignedToId ||
        (typeof where.assignedToId === 'string' && where.assignedToId === query.agenteId) ||
        (where.assignedToId?.in && where.assignedToId.in.includes(query.agenteId))
      if (permitido) where.assignedToId = query.agenteId
    }

    if (query.desde || query.hasta) {
      where.closedAt = { not: null }
      if (query.desde) where.closedAt.gte = new Date(`${query.desde}T00:00:00-05:00`)
      if (query.hasta) where.closedAt.lte = new Date(`${query.hasta}T23:59:59.999-05:00`)
    }

    const deals = await this.prisma.deal.findMany({
      where,
      include: {
        assignedTo: { select: { id: true, name: true } },
        contact: { select: { firstName: true, lastName: true } },
      },
      orderBy: { closedAt: 'desc' },
    })

    const filas = deals
      .map((d) => {
        const cf = (d.customFields ?? {}) as any
        const inicio = cf.leadCreatedAt ? new Date(cf.leadCreatedAt) : d.createdAt
        if (!d.closedAt || !inicio) return null
        const dias = Math.max(
          0,
          Math.round((d.closedAt.getTime() - new Date(inicio).getTime()) / 86_400_000),
        )
        return {
          dealId: d.id,
          cliente: d.contact
            ? `${d.contact.firstName} ${d.contact.lastName ?? ''}`.trim()
            : d.title,
          agente: d.assignedTo?.name ?? 'Sin asignar',
          ganado: d.status === 'WON',
          dias,
          entroEn: new Date(inicio).toISOString(),
          cerradoEn: d.closedAt.toISOString(),
        }
      })
      .filter((f): f is NonNullable<typeof f> => f !== null)

    const ganadas = filas.filter((f) => f.ganado)

    // La MEDIANA además del promedio: un solo negocio que tardó ocho meses
    // arrastra el promedio y da una idea equivocada del caso típico.
    const mediana = (xs: number[]) => {
      if (!xs.length) return null
      const o = [...xs].sort((a, b) => a - b)
      const m = Math.floor(o.length / 2)
      return o.length % 2 ? o[m] : Math.round((o[m - 1] + o[m]) / 2)
    }

    const porAgente = new Map<string, number[]>()
    for (const f of ganadas) {
      porAgente.set(f.agente, [...(porAgente.get(f.agente) ?? []), f.dias])
    }

    // Tramos para el gráfico. Los cortes buscan separar lo que se cierra rápido
    // de lo que se está enfriando.
    const tramos = [
      { rango: '0-7 días', min: 0, max: 7 },
      { rango: '8-15 días', min: 8, max: 15 },
      { rango: '16-30 días', min: 16, max: 30 },
      { rango: '31-60 días', min: 31, max: 60 },
      { rango: 'Más de 60', min: 61, max: Infinity },
    ].map((t) => ({
      rango: t.rango,
      cantidad: ganadas.filter((f) => f.dias >= t.min && f.dias <= t.max).length,
    }))

    return {
      filas,
      resumen: {
        cerrados: filas.length,
        ganados: ganadas.length,
        promedioGanados: ganadas.length
          ? Math.round(ganadas.reduce((s, f) => s + f.dias, 0) / ganadas.length)
          : null,
        medianaGanados: mediana(ganadas.map((f) => f.dias)),
        masRapido: ganadas.length ? Math.min(...ganadas.map((f) => f.dias)) : null,
        masLento: ganadas.length ? Math.max(...ganadas.map((f) => f.dias)) : null,
      },
      tramos,
      porAgente: [...porAgente.entries()]
        .map(([nombre, dias]) => ({
          nombre,
          cerrados: dias.length,
          promedio: Math.round(dias.reduce((s, d) => s + d, 0) / dias.length),
          mediana: mediana(dias),
        }))
        .sort((a, b) => a.promedio - b.promedio),
    }
  }

  /**
   * Renovaciones del mes, para revisarlas ANTES de escribir a los clientes.
   *
   * Es el paso que hoy se hace en un Excel a mano: se mira cuanto subio cada
   * prima y, cuando el alza es fuerte, se prepara una alternativa antes de que
   * el cliente reciba el correo y llame molesto.
   *
   * Por eso la cifra que manda es el PORCENTAJE de incremento, no el total del
   * mes: una subida del 40% en una prima pequeña importa mas que una del 3% en
   * una grande.
   */
  async renovacionesDelMes(
    organizationId: string,
    role: string,
    query: { mes?: string; tipo?: string },
  ) {
    if (!['SUPER_ADMIN', 'OWNER', 'MANAGER', 'JEFE_OPERACIONES'].includes(role)) {
      throw new ForbiddenException('No tienes permiso para ver este reporte')
    }

    const mes = query.mes && /^\d{4}-\d{2}$/.test(query.mes) ? query.mes : null
    const where: any = { organizationId }
    if (mes) {
      const [anio, m] = mes.split('-').map(Number)
      where.fechaRenovacion = { gte: new Date(anio, m - 1, 1), lt: new Date(anio, m, 1) }
    }

    const renovaciones = await this.prisma.renovacion.findMany({
      where,
      include: {
        poliza: {
          include: { cliente: { select: { nombres: true, apellidos: true, email: true } } },
        },
      },
      orderBy: { fechaRenovacion: 'asc' },
    })

    const num = (v: unknown) => (v === null || v === undefined ? null : Number(v))

    const filas = renovaciones
      .map((r) => {
        const actual = num(r.valorActual)
        const nueva = num(r.valorRenovacion)
        // El incremento solo tiene sentido si hay las dos cifras y la anterior
        // no es cero: dividir por cero daria infinito y ensuciaria el reporte.
        const incremento =
          actual && nueva && actual > 0 ? ((nueva - actual) / actual) * 100 : null

        return {
          id: r.id,
          cliente: r.poliza?.cliente
            ? `${r.poliza.cliente.nombres} ${r.poliza.cliente.apellidos ?? ''}`.trim()
            : '(sin cliente)',
          email: r.poliza?.cliente?.email ?? null,
          tipo: r.poliza?.tipo ?? 'SALUD',
          aseguradora: r.poliza?.aseguradora ?? null,
          plan: r.poliza?.plan ?? null,
          deducible: r.poliza?.deducible ?? null,
          formaPago: r.poliza?.formaPago ?? null,
          fechaRenovacion: r.fechaRenovacion,
          agente: r.ejecutivoNombre ?? null,
          primaActual: actual,
          primaRenovacion: nueva,
          incremento: incremento === null ? null : Math.round(incremento * 100) / 100,
          diferidoEspecial: num(r.diferidoEspecial),
          estado: r.estado,
          envio: r.envio,
          // El comentario suelto de la renovacion se llama "comentarios".
          // "notas" es la lista de notas con autor y fecha, que es otra cosa.
          comentario: r.comentarios ?? null,
        }
      })
      .filter((f) => (query.tipo ? f.tipo === query.tipo : true))

    const conIncremento = filas.filter((f) => f.incremento !== null)

    /**
     * Tramos de incremento.
     *
     * El corte del 10% no es arbitrario: por encima de ahi es cuando el cliente
     * suele preguntar, y por encima del 20% cuando conviene llevar una
     * alternativa preparada a la conversacion.
     */
    const tramos = [
      { rango: 'Baja o igual', min: -Infinity, max: 0 },
      { rango: 'Sube hasta 10%', min: 0.01, max: 10 },
      { rango: 'Sube 10-20%', min: 10.01, max: 20 },
      { rango: 'Sube más de 20%', min: 20.01, max: Infinity },
    ].map((t) => ({
      rango: t.rango,
      cantidad: conIncremento.filter((f) => f.incremento! >= t.min && f.incremento! <= t.max)
        .length,
    }))

    const suma = (campo: 'primaActual' | 'primaRenovacion') =>
      filas.reduce((s, f) => s + (f[campo] ?? 0), 0)

    const totalActual = suma('primaActual')
    const totalNueva = suma('primaRenovacion')

    return {
      mes,
      filas,
      resumen: {
        total: filas.length,
        conPrimaNueva: conIncremento.length,
        // Sin prima nueva cargada no se puede avisar al cliente: es lo primero
        // que hay que completar antes de la reunion mensual.
        sinPrimaNueva: filas.length - conIncremento.length,
        primaActualTotal: Math.round(totalActual * 100) / 100,
        primaNuevaTotal: Math.round(totalNueva * 100) / 100,
        incrementoPromedio: conIncremento.length
          ? Math.round(
              (conIncremento.reduce((s, f) => s + f.incremento!, 0) / conIncremento.length) * 100,
            ) / 100
          : null,
        yaEnviadas: filas.filter((f) => f.envio !== 'NO_ENVIADO').length,
      },
      tramos,
      // Las que mas suben primero: son las que hay que mirar antes de enviar.
      mayoresAlzas: [...conIncremento]
        .sort((a, b) => b.incremento! - a.incremento!)
        .slice(0, 15),
    }
  }

}
