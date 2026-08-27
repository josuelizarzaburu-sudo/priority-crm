import { Injectable } from '@nestjs/common'
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
}
