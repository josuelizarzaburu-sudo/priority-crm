import { Injectable, NotFoundException, ForbiddenException, Logger } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { RenovacionesQueryDto } from './dto/renovaciones-query.dto'
import { UpdateRenovacionDto } from './dto/update-renovacion.dto'

/**
 * Quién puede ver el módulo de Renovaciones.
 *
 * A pedido de Josue está acotado: la ejecutiva de fidelización (Gianella), los
 * jefes de operaciones y la administración. No es un módulo abierto a todo el
 * equipo de operaciones.
 */
const VE_RENOVACIONES = ['SUPER_ADMIN', 'OWNER', 'JEFE_OPERACIONES', 'OPERACIONES']

const fecha = (v?: string | null) => (v ? new Date(v) : null)

@Injectable()
export class RenovacionesService {
  private readonly logger = new Logger(RenovacionesService.name)

  constructor(private readonly prisma: PrismaService) {}

  private verificarAcceso(role: string) {
    if (!VE_RENOVACIONES.includes(role)) {
      throw new ForbiddenException('No tienes acceso al módulo de renovaciones')
    }
  }

  /**
   * Crea las renovaciones que faltan a partir de las pólizas.
   *
   * La fecha sale de la vigencia + 1 año, avanzando de año en año hasta caer en
   * el futuro: una póliza emitida en 2024 que nunca se tocó debe generar la
   * renovación de 2026, no la de 2025 que ya pasó.
   *
   * Es idempotente: el índice único (polizaId, fechaRenovacion) evita duplicados,
   * así que se puede llamar cuantas veces haga falta.
   */
  async generar(organizationId: string, role: string) {
    this.verificarAcceso(role)

    const polizas = await this.prisma.poliza.findMany({
      where: {
        organizationId,
        estado: { not: 'CANCELADA' as any },
        OR: [{ fechaRenovacion: { not: null } }, { fechaEmision: { not: null } }],
      },
      select: {
        id: true,
        fechaEmision: true,
        fechaRenovacion: true,
        primaNeta: true,
        agenteId: true,
        agenteNombre: true,
      },
    })

    const hoy = new Date()
    let creadas = 0

    for (const p of polizas) {
      // La fecha de renovación explícita manda; si no hay, se usa la de vigencia.
      const base = p.fechaRenovacion ?? p.fechaEmision
      if (!base) continue

      const proxima = new Date(base)
      // Avanza de año en año hasta quedar por delante de hoy.
      let vueltas = 0
      while (proxima <= hoy && vueltas < 50) {
        proxima.setFullYear(proxima.getFullYear() + 1)
        vueltas++
      }

      try {
        await this.prisma.renovacion.create({
          data: {
            organizationId,
            polizaId: p.id,
            fechaRenovacion: proxima,
            // El valor actual se precarga de la prima y queda editable.
            valorActual: p.primaNeta,
            ejecutivoId: p.agenteId,
            ejecutivoNombre: p.agenteNombre,
          },
        })
        creadas++
      } catch {
        // Ya existía esa renovación (índice único). Es lo esperado al re-generar.
      }
    }

    this.logger.log(`[renovaciones] generadas ${creadas} de ${polizas.length} pólizas`)
    return { revisadas: polizas.length, creadas }
  }

  /** El % de incremento se calcula al mostrar, no se guarda (igual que el Excel). */
  private conCalculos(r: any) {
    const actual = Number(r.valorActual) || 0
    const nuevo = Number(r.valorRenovacion) || 0
    return {
      ...r,
      incremento: actual > 0 && nuevo > 0 ? (nuevo - actual) / actual : null,
    }
  }

  async findAll(organizationId: string, role: string, query: RenovacionesQueryDto) {
    this.verificarAcceso(role)
    const { search, mes, estado, aseguradora, page = 1, limit = 50 } = query
    const skip = (page - 1) * limit

    const where: any = { organizationId }
    if (estado) where.estado = estado

    // Filtro por mes: "2027-05" -> del 1 de mayo al 31 de mayo de 2027.
    if (mes && /^\d{4}-\d{2}$/.test(mes)) {
      const [anio, m] = mes.split('-').map(Number)
      where.fechaRenovacion = {
        gte: new Date(anio, m - 1, 1),
        lt: new Date(anio, m, 1),
      }
    }

    if (aseguradora) {
      where.poliza = { aseguradora: { contains: aseguradora, mode: 'insensitive' } }
    }

    if (search) {
      const s = search.trim()
      where.poliza = {
        ...(where.poliza ?? {}),
        OR: [
          { aseguradora: { contains: s, mode: 'insensitive' } },
          { plan: { contains: s, mode: 'insensitive' } },
          { cliente: { nombres: { contains: s, mode: 'insensitive' } } },
          { cliente: { apellidos: { contains: s, mode: 'insensitive' } } },
          { cliente: { identificacion: { contains: s } } },
        ],
      }
    }

    const incluir = {
      poliza: {
        select: {
          id: true,
          tipo: true,
          aseguradora: true,
          plan: true,
          deducible: true,
          formaPago: true,
          primaNeta: true,
          fechaEmision: true,
          cliente: {
            select: { id: true, nombres: true, apellidos: true, identificacion: true },
          },
        },
      },
      ejecutivo: { select: { id: true, name: true } },
    }

    const [data, total] = await Promise.all([
      this.prisma.renovacion.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ fechaRenovacion: 'asc' }],
        include: incluir,
      }),
      this.prisma.renovacion.count({ where }),
    ])

    return {
      data: data.map((r: any) => this.conCalculos(r)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    }
  }

  /** Cuántas renovaciones hay en cada mes, para las pestañas de arriba. */
  async porMes(organizationId: string, role: string) {
    this.verificarAcceso(role)
    const filas = await this.prisma.renovacion.findMany({
      where: { organizationId },
      select: { fechaRenovacion: true, estado: true },
    })

    const mapa = new Map<string, { mes: string; total: number; pendientes: number }>()
    for (const f of filas) {
      const d = new Date(f.fechaRenovacion)
      const clave = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const acc = mapa.get(clave) ?? { mes: clave, total: 0, pendientes: 0 }
      acc.total++
      if (f.estado !== 'RENOVADO') acc.pendientes++
      mapa.set(clave, acc)
    }
    return [...mapa.values()].sort((a, b) => a.mes.localeCompare(b.mes))
  }

  async findOne(id: string, organizationId: string, role: string) {
    this.verificarAcceso(role)
    const r = await this.prisma.renovacion.findFirst({
      where: { id, organizationId },
      include: {
        poliza: {
          include: {
            cliente: {
              select: {
                id: true,
                nombres: true,
                apellidos: true,
                identificacion: true,
                email: true,
                celular: true,
              },
            },
          },
        },
        ejecutivo: { select: { id: true, name: true } },
        notas: { orderBy: { createdAt: 'desc' } },
      },
    })
    if (!r) throw new NotFoundException('Renovación no encontrada')
    return this.conCalculos(r)
  }

  async update(
    id: string,
    dto: UpdateRenovacionDto,
    organizationId: string,
    role: string,
  ) {
    await this.findOne(id, organizationId, role)

    const data: any = { ...dto }
    if ('fechaRenovacion' in data) data.fechaRenovacion = fecha(data.fechaRenovacion)

    // Al marcar el primer envío se guarda cuándo, para el seguimiento posterior.
    if (dto.envio === 'PRIMER_ENVIO') {
      const actual = await this.prisma.renovacion.findUnique({
        where: { id },
        select: { fechaPrimerEnvio: true },
      })
      if (!actual?.fechaPrimerEnvio) data.fechaPrimerEnvio = new Date()
    }

    if (data.ejecutivoId) {
      const u = await this.prisma.user.findUnique({
        where: { id: data.ejecutivoId },
        select: { name: true },
      })
      data.ejecutivoNombre = u?.name ?? null
    }

    return this.prisma.renovacion.update({ where: { id }, data })
  }

  /** Nota de bitácora: se agrega, no se edita ni se borra. */
  async agregarNota(
    id: string,
    contenido: string,
    organizationId: string,
    userId: string,
    role: string,
  ) {
    await this.findOne(id, organizationId, role)
    const texto = (contenido ?? '').trim()
    if (!texto) throw new ForbiddenException('La nota no puede estar vacía')

    const autor = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { name: true },
    })

    return this.prisma.notaRenovacion.create({
      data: {
        contenido: texto,
        renovacionId: id,
        autorId: userId,
        autorNombre: autor?.name ?? null,
      },
    })
  }
}
