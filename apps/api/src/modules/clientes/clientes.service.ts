import { Injectable, Logger, NotFoundException, ForbiddenException } from '@nestjs/common'
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
  private readonly logger = new Logger(ClientesService.name)

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

    // Bandeja de nuevos por asignar: los que llegaron de un deal ganado y todavía
    // no tienen ejecutiva. Solo tiene sentido para quien puede asignar, porque a
    // una OPERACIONES baseWhere ya la dejó viendo únicamente lo suyo.
    if (query.sinAsignar === 'true' && VE_TODO.includes(role)) {
      where.ejecutivoId = null
    }

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
          // Solo la prima de cada póliza, para poder totalizar lo vendido por
          // cliente y por ejecutiva en los reportes.
          polizas: { select: { primaNeta: true } },
        },
      }),
      this.prisma.cliente.count({ where: where as any }),
    ])

    return {
      data: data.map((c: any) => {
        const { polizas, ...resto } = c
        return {
          ...resto,
          // Suma de las primas de sus pólizas. Prisma devuelve Decimal, se manda
          // como número para que el front no tenga que convertir.
          primaTotal: (polizas ?? []).reduce(
            (s: number, p: any) => s + (Number(p.primaNeta) || 0),
            0,
          ),
        }
      }),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    }
  }

  async findOne(id: string, organizationId: string, userId: string, role: string) {
    const cliente = await this.prisma.cliente.findFirst({
      where: { id, organizationId },
      include: {
        ejecutivo: { select: { id: true, name: true, email: true } },
        dependientes: { orderBy: { createdAt: 'asc' } },
        // Bitácora: lo más reciente primero.
        notas_: { orderBy: { createdAt: 'desc' } },
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

  /**
   * Edita los datos del cliente.
   *
   * Reglas acordadas con Priority:
   *  - Nombres, apellidos, fecha de nacimiento y ejecutiva asignada: la ejecutiva
   *    NO los toca (son datos de identidad / asignación). Jefe y admin sí.
   *  - Cédula: la ejecutiva puede corregirla UNA sola vez (para arreglar un error
   *    de digitación). Después queda congelada para ella. Jefe y admin siempre
   *    pueden, para que un error no quede grabado en piedra.
   */
  async update(
    id: string,
    dto: UpdateClienteDto,
    organizationId: string,
    userId: string,
    role: string,
  ) {
    // findOne ya valida existencia + permiso de acceso.
    const actual = await this.findOne(id, organizationId, userId, role)

    const data: any = { ...dto }
    delete data.dependientes // los dependientes se manejan en endpoints aparte

    const esJefe = VE_TODO.includes(role)

    if (!esJefe) {
      // Campos que la ejecutiva no puede tocar. Se descartan en silencio en vez
      // de fallar: la UI ya los muestra bloqueados, esto es la red de seguridad.
      delete data.nombres
      delete data.apellidos
      delete data.fechaNacimiento
      delete data.ejecutivoId

      // Cédula: una sola corrección.
      const quiereCambiarCedula =
        data.identificacion !== undefined && data.identificacion !== actual.identificacion

      if (quiereCambiarCedula) {
        if (actual.cedulaEditada) {
          throw new ForbiddenException(
            'La cédula ya fue corregida una vez. Pide al jefe de operaciones que haga el cambio.',
          )
        }
        // Marcamos que ya usó su única corrección.
        data.cedulaEditada = true
      } else {
        delete data.identificacion
      }
    }

    // Nadie puede dejar dos clientes con la misma cédula.
    if (data.identificacion && data.identificacion !== actual.identificacion) {
      const repetido = await this.prisma.cliente.findUnique({
        where: {
          organizationId_identificacion: {
            organizationId,
            identificacion: data.identificacion,
          },
        },
        select: { id: true, nombres: true, apellidos: true },
      })
      if (repetido && repetido.id !== id) {
        throw new ForbiddenException(
          `Ya existe otro cliente con la cédula ${data.identificacion}: ${repetido.nombres} ${repetido.apellidos}`,
        )
      }
    }

    // fechaNacimiento llega como texto 'YYYY-MM-DD' desde el formulario, pero
    // Prisma espera un Date: sin esta conversion el update revienta con un 500.
    // El metodo de crear si convertia; a update se le habia pasado.
    //
    // Se construye con 'T00:00:00.000Z' para fijarla a medianoche UTC, igual que
    // en el resto del sistema. Un new Date('1990-08-12') a secas la interpreta
    // en hora local y guardaria el dia anterior en Ecuador, que es justo el bug
    // que ya corregimos en Renovaciones y en el saludo de cumpleanos.
    if (data.fechaNacimiento !== undefined) {
      data.fechaNacimiento = data.fechaNacimiento
        ? new Date(`${String(data.fechaNacimiento).slice(0, 10)}T00:00:00.000Z`)
        : null
    }

    return this.prisma.cliente.update({ where: { id }, data })
  }

  /**
   * Edita una póliza existente. Es la salida que tiene la ejecutiva cuando se
   * equivocó al cargarla, ya que borrar está reservado al jefe.
   */
  async actualizarPoliza(
    clienteId: string,
    polizaId: string,
    dto: any,
    organizationId: string,
    userId: string,
    role: string,
  ) {
    await this.findOne(clienteId, organizationId, userId, role)

    const poliza = await this.prisma.poliza.findFirst({
      where: { id: polizaId, clienteId, organizationId },
      select: { id: true },
    })
    if (!poliza) throw new NotFoundException('Póliza no encontrada')

    const { dependienteIds, fechaEmision, ...resto } = dto
    const data: any = { ...resto }
    if (fechaEmision !== undefined) {
      data.fechaEmision = fechaEmision ? new Date(fechaEmision) : null
    }

    // Si mandan la lista de cubiertos, se reemplaza completa.
    if (Array.isArray(dependienteIds)) {
      const cliente = await this.prisma.cliente.findUnique({
        where: { id: clienteId },
        select: { dependientes: { select: { id: true } } },
      })
      const validos = new Set((cliente?.dependientes ?? []).map((d) => d.id))
      const cubre = dependienteIds.filter((x: string) => validos.has(x))

      await this.prisma.polizaDependiente.deleteMany({ where: { polizaId } })
      if (cubre.length) {
        await this.prisma.polizaDependiente.createMany({
          data: cubre.map((dependienteId: string) => ({ polizaId, dependienteId })),
        })
      }
    }

    return this.prisma.poliza.update({
      where: { id: polizaId },
      data,
      include: {
        dependientes: {
          include: { dependiente: { select: { id: true, nombres: true, apellidos: true } } },
        },
      },
    })
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
  /**
   * Agrega una nota a la bitácora del cliente.
   * Las notas no se editan ni se borran a propósito: son historial. Guardamos
   * el nombre del autor además de su id, para que la nota siga siendo legible
   * aunque esa persona ya no esté en la empresa.
   */
  async agregarNota(
    clienteId: string,
    contenido: string,
    organizationId: string,
    userId: string,
    role: string,
  ) {
    await this.findOne(clienteId, organizationId, userId, role)

    const texto = (contenido ?? '').trim()
    if (!texto) throw new ForbiddenException('La nota no puede estar vacía')

    const autor = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { name: true },
    })

    return this.prisma.notaCliente.create({
      data: {
        contenido: texto,
        clienteId,
        autorId: userId,
        autorNombre: autor?.name ?? null,
      },
    })
  }

  /**
   * Cambia la ejecutiva asignada a un cliente.
   *
   * Solo el jefe de operaciones y los admin. Nace de un caso real: a veces el
   * cliente se queja del trato recibido y pide que lo atienda otra persona.
   *
   * El motivo es OBLIGATORIO y queda escrito en la bitácora del cliente junto
   * con quién hizo el cambio, para que después se pueda reconstruir por qué se
   * reasignó. Ambas escrituras van en una transacción: si falla la nota, no se
   * cambia la ejecutiva (nunca queda un cambio sin justificación).
   */
  async cambiarEjecutiva(
    clienteId: string,
    nuevoEjecutivoId: string,
    motivo: string,
    organizationId: string,
    userId: string,
    role: string,
  ) {
    if (!VE_TODO.includes(role)) {
      throw new ForbiddenException(
        'Solo el jefe de operaciones puede cambiar la ejecutiva asignada',
      )
    }

    const razon = (motivo ?? '').trim()
    if (!razon) {
      throw new ForbiddenException('Hay que indicar el motivo del cambio')
    }

    const cliente = await this.prisma.cliente.findFirst({
      where: { id: clienteId, organizationId },
      select: { id: true, ejecutivoId: true, ejecutivo: { select: { name: true } } },
    })
    if (!cliente) throw new NotFoundException('Cliente no encontrado')

    // La ejecutiva nueva tiene que existir y ser de la misma organización.
    const nueva = await this.prisma.user.findFirst({
      where: { id: nuevoEjecutivoId, organizationId },
      select: { id: true, name: true },
    })
    if (!nueva) throw new NotFoundException('La ejecutiva indicada no existe')

    if (cliente.ejecutivoId === nuevoEjecutivoId) {
      throw new ForbiddenException('Ese cliente ya está asignado a esa ejecutiva')
    }

    const autor = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { name: true },
    })

    const anterior = cliente.ejecutivo?.name ?? 'sin asignar'

    const [actualizado] = await this.prisma.$transaction([
      this.prisma.cliente.update({
        where: { id: clienteId },
        // ejecutivoNombre va denormalizado en la tabla y la ficha lo usa como
        // respaldo, así que hay que moverlo junto con el id o queda un nombre viejo.
        data: { ejecutivoId: nuevoEjecutivoId, ejecutivoNombre: nueva.name },
      }),
      this.prisma.notaCliente.create({
        data: {
          contenido: `Cambio de ejecutiva: ${anterior} → ${nueva.name}. Motivo: ${razon}`,
          clienteId,
          autorId: userId,
          autorNombre: autor?.name ?? null,
        },
      }),
    ])

    // Si es la PRIMERA asignacion (el cliente estaba sin ejecutiva), se abre solo
    // un requerimiento de bienvenida: verificar los datos y mandarle el correo.
    // Antes ese paso dependia de que alguien se acordara.
    //
    // Solo en la primera: un cambio posterior de ejecutiva es una reasignacion, y
    // abrir otro requerimiento ahi llenaria la bandeja de duplicados.
    if (!cliente.ejecutivoId) {
      await this.crearRequerimientoBienvenida(clienteId, nuevoEjecutivoId, nueva.name, organizationId)
    }

    return actualizado
  }

  /**
   * Abre el requerimiento de bienvenida de un cliente recien asignado.
   *
   * No revienta si algo falla: la asignacion de la ejecutiva ya se guardo y es lo
   * importante. Si el requerimiento no se pudo crear, se registra y se sigue; que
   * falle esto no debe deshacer la asignacion.
   */
  async crearRequerimientoBienvenida(
    clienteId: string,
    ejecutivoId: string,
    ejecutivoNombre: string,
    organizationId: string,
  ) {
    try {
      const cliente = await this.prisma.cliente.findUnique({
        where: { id: clienteId },
        select: { nombres: true, apellidos: true },
      })
      if (!cliente) return

      // La bienvenida es de una POLIZA, no del cliente: si mas adelante contrata
      // otro plan, ese plan tambien lleva su carta.
      const poliza = await this.prisma.poliza.findFirst({
        where: { clienteId, organizationId },
        orderBy: { createdAt: 'desc' },
        select: { id: true },
      })

      // No se duplica la de esta misma poliza.
      const yaExiste = await this.prisma.requerimiento.findFirst({
        where: {
          clienteId,
          tipo: 'BIENVENIDA' as any,
          organizationId,
          ...(poliza ? { polizaId: poliza.id } : {}),
        },
        select: { id: true },
      })
      if (yaExiste) return

      await this.prisma.requerimiento.create({
        data: {
          clienteId,
          clienteNombre: `${cliente.nombres} ${cliente.apellidos}`.trim(),
          tipo: 'BIENVENIDA' as any,
          ...(poliza ? { polizaId: poliza.id } : {}),
          requerimiento:
            'Verificar los datos del cliente y enviarle el correo de bienvenida.',
          fechaRecepcion: new Date(),
          estado: 'EN_TRAMITE' as any,
          ejecutivoId,
          ejecutivoNombre,
          organizationId,
        },
      })
    } catch (err) {
      this.logger.error(`No se pudo crear el requerimiento de bienvenida: ${err}`)
    }
  }

  /** Suma un dependiente a un cliente que ya existe (ej. le nació un hijo). */
  async agregarDependiente(
    clienteId: string,
    dto: any,
    organizationId: string,
    userId: string,
    role: string,
  ) {
    await this.findOne(clienteId, organizationId, userId, role)

    return this.prisma.dependiente.create({
      data: {
        nombres: dto.nombres,
        apellidos: dto.apellidos ?? null,
        identificacion: dto.identificacion ?? null,
        fechaNacimiento: dto.fechaNacimiento ? new Date(dto.fechaNacimiento) : null,
        parentesco: dto.parentesco ?? 'OTRO',
        clienteId,
      } as any,
    })
  }

  /**
   * Quita un dependiente. Solo jefe/admin, por la misma razón que las pólizas:
   * borrar pierde datos. Al quitarlo se elimina también su cobertura en las
   * pólizas donde estaba marcado (cascada del esquema).
   */
  async eliminarDependiente(
    clienteId: string,
    dependienteId: string,
    organizationId: string,
    userId: string,
    role: string,
  ) {
    await this.findOne(clienteId, organizationId, userId, role)

    if (!VE_TODO.includes(role)) {
      throw new ForbiddenException(
        'Solo el jefe de operaciones o un administrador pueden eliminar un dependiente.',
      )
    }

    const dep = await this.prisma.dependiente.findFirst({
      where: { id: dependienteId, clienteId },
      select: { id: true, nombres: true, apellidos: true },
    })
    if (!dep) throw new NotFoundException('Dependiente no encontrado')

    await this.prisma.dependiente.delete({ where: { id: dependienteId } })
    return { ok: true, eliminado: dep }
  }
}
