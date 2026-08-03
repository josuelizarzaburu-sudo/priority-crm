import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { ReclamosQueryDto } from './dto/reclamos-query.dto'
import { CreateReclamoDto } from './dto/create-reclamo.dto'
import { UpdateReclamoDto } from './dto/update-reclamo.dto'

// Igual que en clientes: estos roles ven todos los reclamos de la organización.
// El resto solo ve los suyos.
const VE_TODO = ['SUPER_ADMIN', 'OWNER', 'JEFE_OPERACIONES']

const fecha = (v?: string | null) => (v ? new Date(v) : null)

@Injectable()
export class ReclamosService {
  constructor(private readonly prisma: PrismaService) {}

  /** Filtro base de seguridad: una ejecutiva queda limitada a sus reclamos. */
  private baseWhere(organizationId: string, userId: string, role: string) {
    const where: any = { organizationId }
    if (!VE_TODO.includes(role)) where.ejecutivoId = userId
    return where
  }

  async findAll(organizationId: string, userId: string, role: string, query: ReclamosQueryDto) {
    const { search, estado, aseguradora, ejecutivoId, page = 1, limit = 25 } = query
    const skip = (page - 1) * limit

    const where = this.baseWhere(organizationId, userId, role)

    // Solo un jefe puede filtrar por otra ejecutiva; para el resto ya quedó fijo.
    if (ejecutivoId && VE_TODO.includes(role)) where.ejecutivoId = ejecutivoId
    if (estado) where.estado = estado
    if (aseguradora) where.aseguradora = { contains: aseguradora, mode: 'insensitive' }

    if (search) {
      const s = search.trim()
      where.OR = [
        { clienteNombre: { contains: s, mode: 'insensitive' } },
        { pacienteNombre: { contains: s, mode: 'insensitive' } },
        { diagnostico: { contains: s, mode: 'insensitive' } },
        { liquidacion: { contains: s, mode: 'insensitive' } },
        { contrato: { contains: s, mode: 'insensitive' } },
      ]
    }

    const [data, total, sumas] = await Promise.all([
      this.prisma.reclamo.findMany({
        where: where as any,
        skip,
        take: limit,
        orderBy: [{ fechaEnvioAseguradora: 'desc' }, { createdAt: 'desc' }],
        include: {
          cliente: { select: { id: true, nombres: true, apellidos: true } },
          ejecutivo: { select: { id: true, name: true } },
        },
      }),
      this.prisma.reclamo.count({ where: where as any }),
      // Los totales que hoy se sacan con fórmulas en el Excel.
      this.prisma.reclamo.aggregate({ where: where as any, _sum: { valor: true } }),
    ])

    return {
      data: data.map((r) => this.conDias(r)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      valorTotal: sumas._sum.valor ?? 0,
    }
  }

  /**
   * Calcula los días de gestión al vuelo en vez de guardarlos.
   * En el Excel esta fórmula daba -32651 cuando faltaba una fecha; aquí
   * simplemente devuelve null y la pantalla no muestra nada.
   */
  private conDias(r: any) {
    const dias = (desde?: Date | null, hasta?: Date | null): number | null => {
      if (!desde || !hasta) return null
      const d = Math.round((hasta.getTime() - desde.getTime()) / 86400000)
      return d >= 0 ? d : null
    }
    return {
      ...r,
      diasLiquidacion: dias(r.fechaEnvioAseguradora, r.fechaLiquidacion),
      diasEnvioCliente: dias(r.fechaLiquidacion, r.fechaEnvioCliente),
    }
  }

  /** Resumen para las tarjetas de arriba: cuántos hay en cada estado. */
  async resumen(organizationId: string, userId: string, role: string) {
    const where = this.baseWhere(organizationId, userId, role)

    const [porEstado, totalValor, sinEnlazar] = await Promise.all([
      this.prisma.reclamo.groupBy({
        by: ['estado'],
        where: where as any,
        _count: { _all: true },
        _sum: { valor: true },
      }),
      this.prisma.reclamo.aggregate({ where: where as any, _sum: { valor: true } }),
      this.prisma.reclamo.count({ where: { ...where, clienteId: null } as any }),
    ])

    return {
      porEstado: porEstado.map((x) => ({
        estado: x.estado,
        cantidad: x._count._all,
        valor: x._sum.valor ?? 0,
      })),
      valorTotal: totalValor._sum.valor ?? 0,
      sinEnlazarACliente: sinEnlazar,
    }
  }

  async findOne(id: string, organizationId: string, userId: string, role: string) {
    const reclamo = await this.prisma.reclamo.findFirst({
      where: { id, organizationId },
      include: {
        cliente: {
          select: {
            id: true, nombres: true, apellidos: true, identificacion: true,
            // Para que el campo Paciente pueda ofrecer al titular y a sus dependientes.
            dependientes: { select: { id: true, nombres: true, apellidos: true } },
          },
        },
        ejecutivo: { select: { id: true, name: true, email: true } },
        notas: { orderBy: { createdAt: 'desc' } },
      },
    })
    if (!reclamo) throw new NotFoundException('Reclamo no encontrado')

    if (!VE_TODO.includes(role) && reclamo.ejecutivoId !== userId) {
      throw new ForbiddenException('No tienes acceso a este reclamo')
    }
    return this.conDias(reclamo)
  }

  async create(dto: CreateReclamoDto, organizationId: string, userId: string, role: string) {
    // Una ejecutiva se auto-asigna lo que crea; un jefe puede asignárselo a otra.
    let ejecutivoId = dto.ejecutivoId ?? userId
    if (!VE_TODO.includes(role)) ejecutivoId = userId

    const usuario = await this.prisma.user.findUnique({
      where: { id: ejecutivoId },
      select: { name: true },
    })

    const data: any = {
      ...dto,
      organizationId,
      ejecutivoId,
      ejecutivoNombre: usuario?.name ?? null,
      fechaRecepcion: fecha(dto.fechaRecepcion),
      fechaEnvioAseguradora: fecha(dto.fechaEnvioAseguradora),
      fechaLiquidacion: fecha(dto.fechaLiquidacion),
      fechaEnvioCliente: fecha(dto.fechaEnvioCliente),
    }

    return this.prisma.reclamo.create({ data })
  }

  /**
   * Agrega una nota a la bitacora del reclamo. Las notas NO se editan ni se
   * borran, solo se acumulan: es un registro de lo que fue pasando.
   * A diferencia de editar el reclamo, esto SI se permite aunque este cerrado:
   * despues de liquidar puede haber que dejar constancia de algo.
   */
  async agregarNota(id: string, contenido: string, organizationId: string, userId: string, role: string) {
    await this.findOne(id, organizationId, userId, role)
    const texto = (contenido ?? '').trim()
    if (!texto) throw new ForbiddenException('La nota no puede estar vacía')

    const autor = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { name: true },
    })

    return this.prisma.notaReclamo.create({
      data: { contenido: texto, reclamoId: id, autorId: userId, autorNombre: autor?.name ?? null },
    })
  }

  async update(
    id: string,
    dto: UpdateReclamoDto,
    organizationId: string,
    userId: string,
    role: string,
  ) {
    const actual = await this.findOne(id, organizationId, userId, role)

    // Un reclamo liquidado o negado queda cerrado: ya se le respondió al cliente
    // y cambiarlo despues desalinearia lo informado con lo registrado. El jefe de
    // operaciones y los admin SI pueden corregir, porque si alguien marca
    // "Liquidado" por error el reclamo quedaria inservible para siempre.
    const CERRADOS = ['LIQUIDADO', 'NEGADO']
    if (CERRADOS.includes((actual as any)?.estado) && !VE_TODO.includes(role)) {
      throw new ForbiddenException(
        'Este reclamo ya está cerrado y no se puede editar. Pide al jefe de operaciones que lo corrija.',
      )
    }

    const data: any = { ...dto }
    // Una ejecutiva no puede pasarle el reclamo a otra persona.
    if (!VE_TODO.includes(role)) delete data.ejecutivoId

    for (const f of [
      'fechaRecepcion',
      'fechaEnvioAseguradora',
      'fechaLiquidacion',
      'fechaEnvioCliente',
    ]) {
      if (data[f] !== undefined) data[f] = fecha(data[f])
    }

    // Si le reasignan la ejecutiva, actualizamos también el nombre guardado.
    if (data.ejecutivoId) {
      const u = await this.prisma.user.findUnique({
        where: { id: data.ejecutivoId },
        select: { name: true },
      })
      data.ejecutivoNombre = u?.name ?? null
    }

    return this.prisma.reclamo.update({ where: { id }, data })
  }

  /** Borrar pierde historial del cliente: reservado a jefe/admin. */
  async remove(id: string, organizationId: string, userId: string, role: string) {
    await this.findOne(id, organizationId, userId, role)

    if (!VE_TODO.includes(role)) {
      throw new ForbiddenException(
        'Solo el jefe de operaciones o un administrador pueden eliminar un reclamo. Si hay un error, edítalo.',
      )
    }

    await this.prisma.reclamo.delete({ where: { id } })
    return { ok: true }
  }
}
