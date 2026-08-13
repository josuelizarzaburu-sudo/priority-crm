import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { NotificationsService } from '../notifications/notifications.service'
import { RequerimientosQueryDto } from './dto/requerimientos-query.dto'
import { CreateRequerimientoDto } from './dto/create-requerimiento.dto'
import { UpdateRequerimientoDto } from './dto/update-requerimiento.dto'

// Igual que en reclamos: estos roles ven todo; el resto solo lo suyo.
const VE_TODO = ['SUPER_ADMIN', 'OWNER', 'JEFE_OPERACIONES']

const fecha = (v?: string | null) => (v ? new Date(v) : null)

@Injectable()
export class RequerimientosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  /** Filtro base de seguridad: una ejecutiva queda limitada a los suyos. */
  private baseWhere(organizationId: string, userId: string, role: string) {
    const where: any = { organizationId }
    if (!VE_TODO.includes(role)) where.ejecutivoId = userId
    return where
  }

  /** Los días se calculan al mostrar, no se guardan (igual que en reclamos). */
  private conDias(r: any) {
    const dias = (desde?: Date | null, hasta?: Date | null): number | null => {
      if (!desde || !hasta) return null
      const d = Math.round((hasta.getTime() - desde.getTime()) / 86400000)
      return d >= 0 ? d : null
    }
    return {
      ...r,
      diasGestion: dias(r.fechaRecepcion, r.fechaEnvioCliente),
    }
  }

  async findAll(
    organizationId: string,
    userId: string,
    role: string,
    query: RequerimientosQueryDto,
  ) {
    const { search, estado, tipo, aseguradora, ejecutivoId, page = 1, limit = 25 } = query
    const skip = (page - 1) * limit

    const where = this.baseWhere(organizationId, userId, role)

    if (ejecutivoId && VE_TODO.includes(role)) where.ejecutivoId = ejecutivoId
    if (estado) where.estado = estado
    if (tipo) where.tipo = tipo
    if (aseguradora) where.aseguradora = { contains: aseguradora, mode: 'insensitive' }

    if (search) {
      const s = search.trim()
      where.OR = [
        { clienteNombre: { contains: s, mode: 'insensitive' } },
        { pacienteNombre: { contains: s, mode: 'insensitive' } },
        { requerimiento: { contains: s, mode: 'insensitive' } },
        { contrato: { contains: s, mode: 'insensitive' } },
      ]
    }

    const [data, total] = await Promise.all([
      this.prisma.requerimiento.findMany({
        where: where as any,
        skip,
        take: limit,
        orderBy: [{ fechaRecepcion: 'desc' }, { createdAt: 'desc' }],
        include: {
          cliente: { select: { id: true, nombres: true, apellidos: true, identificacion: true } },
          ejecutivo: { select: { id: true, name: true } },
        },
      }),
      this.prisma.requerimiento.count({ where: where as any }),
    ])

    return {
      data: data.map((r: any) => this.conDias(r)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    }
  }

  /** Resumen para las tarjetas de arriba: cuántos hay en cada estado. */
  async resumen(organizationId: string, userId: string, role: string) {
    const where = this.baseWhere(organizationId, userId, role)

    const [porEstado, sinEnlazar] = await Promise.all([
      this.prisma.requerimiento.groupBy({
        by: ['estado'],
        where: where as any,
        _count: { _all: true },
      }),
      this.prisma.requerimiento.count({ where: { ...where, clienteId: null } as any }),
    ])

    return {
      porEstado: porEstado.map((e: any) => ({
        estado: e.estado,
        cantidad: e._count._all,
      })),
      sinEnlazarACliente: sinEnlazar,
    }
  }

  async findOne(id: string, organizationId: string, userId: string, role: string) {
    const req = await this.prisma.requerimiento.findFirst({
      where: { id, organizationId },
      include: {
        cliente: {
          select: {
            id: true,
            nombres: true,
            apellidos: true,
            identificacion: true,
            dependientes: { select: { id: true, nombres: true, apellidos: true } },
          },
        },
        ejecutivo: { select: { id: true, name: true, email: true } },
        notas: { orderBy: { createdAt: 'desc' } },
      },
    })
    if (!req) throw new NotFoundException('Requerimiento no encontrado')

    if (!VE_TODO.includes(role) && req.ejecutivoId !== userId) {
      throw new ForbiddenException('No tienes acceso a este requerimiento')
    }
    return this.conDias(req)
  }

  async create(
    dto: CreateRequerimientoDto,
    organizationId: string,
    userId: string,
    role: string,
  ) {
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
      fechaEnvioCliente: fecha(dto.fechaEnvioCliente),
    }

    return this.prisma.requerimiento.create({ data })
  }

  /**
   * Agrega una nota a la bitácora. No se editan ni se borran, solo se acumulan.
   * Se permite aunque el requerimiento esté solucionado: después de cerrarlo puede
   * haber que dejar constancia de algo.
   */
  async agregarNota(
    id: string,
    contenido: string,
    organizationId: string,
    userId: string,
    role: string,
  ) {
    await this.findOne(id, organizationId, userId, role)
    const texto = (contenido ?? '').trim()
    if (!texto) throw new ForbiddenException('La nota no puede estar vacía')

    const autor = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { name: true },
    })

    return this.prisma.notaRequerimiento.create({
      data: {
        contenido: texto,
        requerimientoId: id,
        autorId: userId,
        autorNombre: autor?.name ?? null,
      },
    })
  }

  async update(
    id: string,
    dto: UpdateRequerimientoDto,
    organizationId: string,
    userId: string,
    role: string,
  ) {
    const actual = await this.findOne(id, organizationId, userId, role)

    // Un requerimiento solucionado queda cerrado. El jefe de operaciones y los
    // admin sí pueden corregir, por si alguien lo cerró por error.
    if ((actual as any)?.estado === 'SOLUCIONADO' && !VE_TODO.includes(role)) {
      throw new ForbiddenException(
        'Este requerimiento ya está solucionado y no se puede editar. Pide al jefe de operaciones que lo corrija.',
      )
    }

    const data: any = { ...dto }
    // Una ejecutiva no puede pasarle el requerimiento a otra persona.
    if (!VE_TODO.includes(role)) delete data.ejecutivoId

    for (const f of ['fechaRecepcion', 'fechaEnvioAseguradora', 'fechaEnvioCliente']) {
      if (f in data) data[f] = fecha(data[f])
    }

    if (data.ejecutivoId) {
      const usuario = await this.prisma.user.findUnique({
        where: { id: data.ejecutivoId },
        select: { name: true },
      })
      data.ejecutivoNombre = usuario?.name ?? null
    }

    return this.prisma.requerimiento.update({ where: { id }, data })
  }

  /**
   * Envia el correo de bienvenida al cliente de este requerimiento.
   *
   * Lo dispara la ejecutiva a mano, no una tarea automatica: asi sale recien
   * cuando ya verifico que los datos estan correctos, que es justo para lo que
   * se abre el requerimiento.
   *
   * Se guarda la fecha de envio y se comprueba antes de mandar, para que el
   * cliente no reciba el correo dos veces si alguien pulsa el boton de nuevo.
   */
  async enviarBienvenida(id: string, organizationId: string, userId: string, role: string) {
    const req: any = await this.findOne(id, organizationId, userId, role)

    if (req.tipo !== 'BIENVENIDA') {
      throw new ForbiddenException('Este requerimiento no es de bienvenida')
    }
    if (req.correoBienvenidaEnviado) {
      throw new ForbiddenException(
        'El correo de bienvenida ya se envió el ' +
          new Date(req.correoBienvenidaEnviado).toLocaleDateString('es-EC'),
      )
    }
    if (!req.clienteId) {
      throw new ForbiddenException('El requerimiento no está enlazado a un cliente')
    }

    const cliente = await this.prisma.cliente.findFirst({
      where: { id: req.clienteId, organizationId },
      select: { nombres: true, nombrePreferido: true, email: true },
    })
    if (!cliente?.email) {
      throw new ForbiddenException(
        'El cliente no tiene correo registrado. Complétalo en su ficha antes de enviar.',
      )
    }

    // Se prefiere el nombre preferido: si el cliente pidio que le digan "Pepe",
    // un "Bienvenido Jose Luis" delata que lo escribio una maquina.
    const saludo =
      cliente.nombrePreferido?.trim() || cliente.nombres.trim().split(/\s+/)[0] || cliente.nombres

    await this.notifications.enviarCorreoBienvenida({
      email: cliente.email,
      saludo,
      ejecutivaNombre: req.ejecutivoNombre,
    })

    const autor = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { name: true },
    })

    // El envio queda en la bitacora: es una comunicacion al cliente y tiene que
    // ser rastreable quien la mando y cuando.
    await this.prisma.notaRequerimiento.create({
      data: {
        contenido: `Correo de bienvenida enviado a ${cliente.email}`,
        requerimientoId: id,
        autorId: userId,
        autorNombre: autor?.name ?? null,
      },
    })

    return this.prisma.requerimiento.update({
      where: { id },
      data: { correoBienvenidaEnviado: new Date() },
    })
  }

  async remove(id: string, organizationId: string, userId: string, role: string) {
    await this.findOne(id, organizationId, userId, role)
    // Borrar pierde información: solo jefe de operaciones y admin.
    if (!VE_TODO.includes(role)) {
      throw new ForbiddenException('No tienes permiso para eliminar requerimientos')
    }
    return this.prisma.requerimiento.delete({ where: { id } })
  }
}
