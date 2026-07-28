import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { ClientesQueryDto } from './dto/clientes-query.dto'
import { CreateClienteDto } from './dto/create-cliente.dto'
import { UpdateClienteDto } from './dto/update-cliente.dto'
import { CreatePolizaDto } from './dto/create-poliza.dto'

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
        where: where as any,
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
      this.prisma.cliente.count({ where: where as any }),
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

    const data: any = {
      ...datosCliente,
      organizationId,
      ejecutivoId,
      createdById: userId,
    }
    if (dependientes?.length) {
      data.dependientes = { create: dependientes.map(d => ({ ...d })) }
    }

    return this.prisma.cliente.create({
      data,
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
  /**
   * Agrega una poliza a un cliente existente. Sirve para cuando el cliente
   * contrata un ramo nuevo (ya tenia salud y ahora saca auto, por ejemplo).
   * findOne valida que el usuario tenga acceso a ese cliente.
   */
  async crearPoliza(
    clienteId: string,
    dto: CreatePolizaDto,
    organizationId: string,
    userId: string,
    role: string,
  ) {
    const cliente = await this.findOne(clienteId, organizationId, userId, role)

    const { dependienteIds, fechaEmision, ...resto } = dto

    // Solo se pueden cubrir dependientes que sean de ESTE cliente.
    const idsValidos = new Set(cliente.dependientes.map((d: any) => d.id))
    const cubre = (dependienteIds ?? []).filter((id) => idsValidos.has(id))

    const data: any = {
      ...resto,
      fechaEmision: fechaEmision ? new Date(fechaEmision) : null,
      clienteId,
      organizationId,
    }
    if (cubre.length) {
      data.dependientes = { create: cubre.map((dependienteId) => ({ dependienteId })) }
    }

    return this.prisma.poliza.create({
      data,
      include: {
        dependientes: { include: { dependiente: { select: { id: true, nombres: true, apellidos: true } } } },
      },
    })
  }
  /**
   * Elimina una poliza. Pensado sobre todo para deshacer una carga equivocada.
   * Se valida que la poliza sea de un cliente al que el usuario tiene acceso,
   * asi una ejecutiva no puede borrar la poliza de un cliente ajeno.
   */
  async eliminarPoliza(
    clienteId: string,
    polizaId: string,
    organizationId: string,
    userId: string,
    role: string,
  ) {
    // Valida existencia del cliente y permiso de acceso.
    await this.findOne(clienteId, organizationId, userId, role)

    // Borrar una poliza pierde datos sin vuelta atras (contrato, prima, historial),
    // asi que queda reservado al jefe de operaciones y al admin. Una ejecutiva que
    // se equivoco al cargarla debe corregirla editandola, no borrandola.
    if (!VE_TODO.includes(role)) {
      throw new ForbiddenException(
        'Solo el jefe de operaciones o un administrador pueden eliminar una póliza. Si hay un error en los datos, edítala.',
      )
    }

    const poliza = await this.prisma.poliza.findFirst({
      where: { id: polizaId, clienteId, organizationId },
      select: { id: true, tipo: true, aseguradora: true, plan: true, numeroContrato: true },
    })
    if (!poliza) throw new NotFoundException('Póliza no encontrada')

    // Las filas de poliza_dependientes se borran en cascada (definido en el esquema);
    // los dependientes en si NO se tocan: siguen colgando del cliente.
    await this.prisma.poliza.delete({ where: { id: polizaId } })

    return { ok: true, eliminada: poliza }
  }
}
