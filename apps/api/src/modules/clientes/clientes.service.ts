import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { ClientesQueryDto } from './dto/clientes-query.dto'
import { CreateClienteDto } from './dto/create-cliente.dto'
import { UpdateClienteDto } from './dto/update-cliente.dto'

// Roles que pueden ver TODOS los clientes de la organización.
// El resto (OPERACIONES) solo ve los suyos.
const VE_TODO = ['SUPER_ADMIN', 'OWNER', 'JEFE_OPERACIONES']

@Injectable()
export class ClientesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Construye el filtro base de seguridad. Es el corazón del módulo:
   * un usuario OPERACIONES SIEMPRE queda limitado a sus propios clientes,
   * sin importar qué mande el frontend. Esto va en el servidor, nunca en la UI.
   */
  private baseWhere(organizationId: string, userId: string, role: string) {
    const where: any = { organizationId }
    if (!VE_TODO.includes(role)) {
      where.ejecutivoId = userId
    }
    return where
  }

  async findAll(organizationId: string, userId: string, role: string, query: ClientesQueryDto) {
    const { search, page = 1, limit = 25, revisar, ejecutivoId } = query
    const skip = (page - 1) * limit

    const where = this.baseWhere(organizationId, userId, role)

    // Un jefe/admin puede filtrar por una ejecutiva concreta.
    // Para OPERACIONES este parámetro se ignora: baseWhere ya lo fijó a lo suyo.
    if (ejecutivoId && VE_TODO.includes(role)) {
      where.ejecutivoId = ejecutivoId
    }

    if (revisar === 'true') where.revisar = true

    if (search) {
      const s = search.trim()
      where.OR = [
        { nombres: { contains: s, mode: 'insensitive' } },
        { apellidos: { contains: s, mode: 'insensitive' } },
        { identificacion: { contains: s } },
        { email: { contains: s, mode: 'insensitive' } },
        { celular: { contains: s } },
        { telefono: { contains: s } },
        // Buscar también por el nombre o cédula de un dependiente
        { dependientes: { some: { nombres: { contains: s, mode: 'insensitive' } } } },
        { dependientes: { some: { apellidos: { contains: s, mode: 'insensitive' } } } },
        { dependientes: { some: { identificacion: { contains: s } } } },
      ]
    }

    const [data, total] = await Promise.all([
      this.prisma.cliente.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ apellidos: 'asc' }, { nombres: 'asc' }],
        // La lista solo necesita las 4 columnas + un par de flags para la UI.
        select: {
          id: true,
          nombres: true,
          apellidos: true,
          identificacion: true,
          telefono: true,
          celular: true,
          email: true,
          revisar: true,
          ejecutivo: { select: { id: true, name: true } },
          _count: { select: { polizas: true } },
        },
      }),
      this.prisma.cliente.count({ where }),
    ])

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) }
  }

  async findOne(id: string, organizationId: string, userId: string, role: string) {
    const cliente = await this.prisma.cliente.findFirst({
      where: { id, organizationId },
      include: {
        ejecutivo: { select: { id: true, name: true, email: true } },
        dependientes: { orderBy: { createdAt: 'asc' } },
        polizas: {
          orderBy: { createdAt: 'asc' },
          include: {
            dependientes: {
              include: { dependiente: { select: { id: true, nombres: true, apellidos: true } } },
            },
          },
        },
      },
    })
    if (!cliente) throw new NotFoundException('Cliente no encontrado')

    // Seguridad: un OPERACIONES no puede abrir la ficha de un cliente ajeno,
    // aunque adivine el id.
    if (!VE_TODO.includes(role) && cliente.ejecutivoId !== userId) {
      throw new ForbiddenException('No tienes acceso a este cliente')
    }
    return cliente
  }

  async create(dto: CreateClienteDto, organizationId: string, userId: string, role: string) {
    // Evitar duplicados: la cédula es única por organización.
    const yaExiste = await this.prisma.cliente.findUnique({
      where: {
        organizationId_identificacion: { organizationId, identificacion: dto.identificacion },
      },
      select: { id: true, nombres: true, apellidos: true },
    })
    if (yaExiste) {
      throw new ForbiddenException(
        `Ya existe un cliente con la cédula ${dto.identificacion}: ${yaExiste.nombres} ${yaExiste.apellidos}`,
      )
    }

    // Una ejecutiva de operaciones se auto-asigna el cliente que crea.
    // Un jefe/admin puede asignárselo a quien indique (o dejarlo sin asignar).
    let ejecutivoId = dto.ejecutivoId ?? null
    if (!VE_TODO.includes(role)) {
      ejecutivoId = userId
    }

    const { dependientes, ...datosCliente } = dto

    return this.prisma.cliente.create({
      data: {
        ...datosCliente,
        organizationId,
        ejecutivoId,
        createdById: userId,
        dependientes: dependientes?.length
          ? { create: dependientes.map(d => ({ ...d })) }
          : undefined,
      },
      include: { dependientes: true },
    })
  }

  async update(
    id: string,
    dto: UpdateClienteDto,
    organizationId: string,
    userId: string,
    role: string,
  ) {
    // findOne ya valida existencia + permiso de acceso.
    await this.findOne(id, organizationId, userId, role)

    // Una ejecutiva no puede reasignar el cliente a otra persona.
    const data: any = { ...dto }
    delete data.dependientes // los dependientes se manejan en endpoints aparte
    if (!VE_TODO.includes(role)) {
      delete data.ejecutivoId
    }

    return this.prisma.cliente.update({ where: { id }, data })
  }
}
