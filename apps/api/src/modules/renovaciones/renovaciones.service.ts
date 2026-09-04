import { Injectable, NotFoundException, ForbiddenException, Logger } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { RenovacionesQueryDto } from './dto/renovaciones-query.dto'
import { UpdateRenovacionDto } from './dto/update-renovacion.dto'
import { NotificationsService } from '../notifications/notifications.service'
import { nombreCorto, nombreParaSaludo, paraMostrarAlCliente } from '../../common/texto'
import {
  PLANTILLAS,
  elegirPlantilla,
  ofreceDescuento,
  type DatosRenovacion,
} from './plantillas-renovacion'

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

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

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

    // La forma de pago vive en la POLIZA, no en la renovacion, asi que se saca
    // de aqui y se guarda alla. Se corrige desde esta pantalla porque cambia
    // justo al renovar y es un dato que sale en el correo al cliente; dejarla
    // solo en la ficha obligaria a salir, buscar la poliza y volver.
    // Datos de la POLIZA que se corrigen desde la renovacion: son los tres que
    // suelen cambiar de un año a otro. Se sacan de aqui y se guardan alla.
    const formaPago = data.formaPago
    const plan = data.plan
    const deducible = data.deducible
    delete data.formaPago
    delete data.plan
    delete data.deducible

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

    /**
     * Los tres datos que cambian al renovar se guardan en la POLIZA.
     *
     * Asi el año que viene la renovacion sale con la informacion correcta sola,
     * sin que nadie tenga que corregirla ficha por ficha.
     *
     * La FECHA DE EMISION no se toca: es cuando se emitio el contrato y no
     * cambia nunca. Lo que avanza año a año es la fecha de renovacion, que se
     * calcula a partir de ella al generar las renovaciones del periodo
     * siguiente.
     */
    const cambiosPoliza: Record<string, unknown> = {}
    if (formaPago) cambiosPoliza.formaPago = formaPago
    if (plan !== undefined) cambiosPoliza.plan = plan || null
    if (deducible !== undefined) cambiosPoliza.deducible = deducible || null

    if (Object.keys(cambiosPoliza).length) {
      const r = await this.prisma.renovacion.findUnique({
        where: { id },
        select: { polizaId: true },
      })
      if (r?.polizaId) {
        await this.prisma.poliza.update({
          where: { id: r.polizaId },
          data: cambiosPoliza as any,
        })
      }
    }

    // Al marcar RENOVADO se sube la prima nueva a la poliza.
    //
    // Solo en ese momento y no al enviar el correo: mientras se negocia, el
    // valor todavia puede cambiar. Cuando la renovacion se da por hecha, esa es
    // la prima con la que corre la poliza el año siguiente.
    if (dto.estado === 'RENOVADO') {
      const r = await this.prisma.renovacion.findUnique({
        where: { id },
        select: { polizaId: true, valorRenovacion: true },
      })
      if (r?.polizaId && r.valorRenovacion) {
        await this.prisma.poliza.update({
          where: { id: r.polizaId },
          data: { primaNeta: r.valorRenovacion },
        })
      }
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
  /**
   * Prepara el correo de renovación con los datos ya puestos.
   *
   * La ejecutiva no escribe nada de cero: abre, lee, corrige lo que haga falta y
   * envía. Si ya guardó una versión editada, se devuelve esa en vez de volver a
   * generarla, o perdería sus ajustes cada vez que abriera la pantalla.
   */
  async prepararCorreo(id: string, organizationId: string, plantillaPedida?: string) {
    const r: any = await this.prisma.renovacion.findFirst({
      where: { id, organizationId },
      include: {
        poliza: { include: { cliente: true } },
      },
    })
    if (!r) throw new NotFoundException('Renovación no encontrada')

    const cliente = r.poliza?.cliente
    // Orden: la que pide la pantalla (cuando la ejecutiva la elige a mano) gana
    // sobre la guardada, y esa sobre la deteccion automatica.
    const plantillaId =
      (plantillaPedida && PLANTILLAS[plantillaPedida] ? plantillaPedida : null) ??
      r.correoPlantilla ??
      elegirPlantilla(r.poliza?.aseguradora, r.poliza?.plan, r.poliza?.tipo)

    const datos = this.armarDatos(r, cliente)
    const textoGenerado = plantillaId && PLANTILLAS[plantillaId]
      ? PLANTILLAS[plantillaId].armar(datos)
      : null

    const faltantes: string[] = []
    if (!cliente) faltantes.push('La póliza no está enlazada a un cliente')
    else if (!r.correoDestinatario && !cliente.email) {
      faltantes.push('El cliente no tiene correo — complétalo en su ficha o escríbelo abajo')
    }
    if (!plantillaId) {
      faltantes.push('No se reconoció la plantilla: elígela manualmente')
    }
    if (!r.valorRenovacion) {
      faltantes.push('Falta el valor de renovación')
    }

    return {
      yaEnviado: r.envio === 'ENVIADO' ? r.fechaPrimerEnvio : null,
      destinatario: r.correoDestinatario ?? cliente?.email ?? '',
      plantilla: plantillaId,
      // El texto guardado gana sobre el generado: son las correcciones de la
      // ejecutiva y no deben perderse al recargar.
      //
      // Salvo cuando pide una plantilla concreta: ahi quiere justamente el texto
      // de esa plantilla. Sin esta excepcion, elegir una plantilla no cambiaba
      // nada y el cuadro se quedaba en blanco para siempre.
      texto: plantillaPedida ? (textoGenerado ?? '') : (r.correoTexto ?? textoGenerado ?? ''),
      // Se devuelve aparte para poder ofrecer "regenerar desde la plantilla" si
      // cambian los valores y quiere partir de cero otra vez.
      textoGenerado,
      datos,
      plantillasDisponibles: Object.entries(PLANTILLAS).map(([id, p]) => ({
        id,
        etiqueta: p.etiqueta,
      })),
      faltantes,
    }
  }

  /** Reúne los datos que rellenan la plantilla. */
  private armarDatos(r: any, cliente: any): DatosRenovacion {
    const money = (v: any) =>
      v === null || v === undefined ? '' : Number(v).toFixed(2)

    const fecha = (d: Date | null) => {
      if (!d) return ''
      // Se lee en UTC porque la fecha se guarda sin hora: en Ecuador, leerla en
      // hora local daría el día anterior.
      return new Date(d).toLocaleDateString('es-EC', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        timeZone: 'UTC',
      })
    }

    // Fecha límite para confirmar cambios: una semana antes de la renovación,
    // que es el margen que deja la aseguradora para procesar un ajuste.
    const limite = r.fechaRenovacion ? new Date(r.fechaRenovacion) : null
    if (limite) limite.setUTCDate(limite.getUTCDate() - 7)

    const prima = money(r.valorRenovacion)
    // El 5% solo lo ofrece BMI. Incluirlo en otra aseguradora sería prometerle
    // al cliente algo que no existe.
    const conDescuento =
      ofreceDescuento(r.poliza?.aseguradora) && r.valorRenovacion
        ? (Number(r.valorRenovacion) * 0.95).toFixed(2)
        : null

    return {
      // Sin "Estimado": va el nombre directo, o nada si no se sabe cual usar.
      // Ver nombreParaSaludo: con dos nombres y sin preferido se deja en blanco,
      // porque elegir mal entre "Maria" y "Fernanda" es peor que no poner nada.
      saludo: (() => {
        const n = cliente ? nombreParaSaludo(cliente.nombres, cliente.nombrePreferido) : ''
        return n ? `${n},` : ''
      })(),
      plan: paraMostrarAlCliente(r.poliza?.plan) || '',
      deducible: r.poliza?.deducible ? `USD ${r.poliza.deducible}` : '',
      // BMI, AIG y similares son siglas: se dejan como están si no tienen
      // vocales en minúscula, para no convertirlas en "Bmi".
      aseguradora: r.poliza?.aseguradora ?? '',
      fechaRenovacion: fecha(r.fechaRenovacion),
      formaPago: (r.poliza?.formaPago ?? '').toString().toLowerCase().replace(/_/g, ' '),
      prima,
      fechaLimite: fecha(limite),
      primaConDescuento: conDescuento,
      marca: r.poliza?.marca ?? '',
      modelo: r.poliza?.modelo ?? '',
      anio: r.poliza?.anio ? String(r.poliza.anio) : '',
      placa: r.poliza?.placa ?? '',
      avaluo: money(r.poliza?.sumaAsegurada),
    }
  }

  /**
   * Envía el correo de renovación al cliente.
   *
   * Se manda el texto tal como quedó en pantalla: lo que la ejecutiva revisó es
   * exactamente lo que sale.
   */
  async enviarCorreo(
    id: string,
    dto: {
      texto: string
      destinatario: string
      plantilla?: string
      adjuntos?: { filename: string; content: string }[]
      /** Copias extra que escribe la ejecutiva, separadas por coma. */
      copias?: string
    },
    organizationId: string,
    userId: string,
  ) {
    const r: any = await this.prisma.renovacion.findFirst({
      where: { id, organizationId },
      include: { poliza: { include: { cliente: true } } },
    })
    if (!r) throw new NotFoundException('Renovación no encontrada')

    if (r.envio === 'ENVIADO') {
      throw new ForbiddenException(
        'Esta renovación ya se envió el ' +
          new Date(r.fechaPrimerEnvio).toLocaleDateString('es-EC'),
      )
    }

    const destinatario = dto.destinatario?.trim()
    if (!destinatario || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(destinatario)) {
      throw new ForbiddenException('El correo del destinatario no es válido')
    }
    if (!dto.texto?.trim()) {
      throw new ForbiddenException('El correo está vacío')
    }

    const adjuntos = this.validarAdjuntos(dto.adjuntos)

    const ejecutiva = r.ejecutivoId
      ? await this.prisma.user.findFirst({
          where: { id: r.ejecutivoId, organizationId },
          select: { name: true, email: true },
        })
      : null

    await this.notifications.enviarCorreoRenovacion({
      email: destinatario,
      // El nombre va en el ASUNTO para poder buscar el correo despues. Solo
      // primer nombre y primer apellido: el nombre completo de la cedula hace el
      // asunto ilegible en la bandeja.
      asunto: `Renovación Plan Médico - ${nombreCorto(
        r.poliza?.cliente?.nombres ?? '',
        r.poliza?.cliente?.apellidos ?? '',
      )}`,
      texto: dto.texto,
      ejecutivaNombre: ejecutiva?.name ?? null,
      // Copias del correo.
      //
      // Siempre va comercial@priority.ec: es la constancia de la empresa de que
      // la renovacion se comunico y en que terminos, sin depender de que la
      // ejecutiva conserve su copia.
      //
      // Ademas la ejecutiva que lo envia y las que ella agregue a mano.
      copias: [
        'comercial@priority.ec',
        ejecutiva?.email,
        ...(dto.copias ?? '')
          .split(/[,;]/)
          .map((c) => c.trim())
          .filter((c) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(c)),
      ].filter((c): c is string => !!c),
      adjuntos,
    })

    const autor = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { name: true },
    })

    await this.prisma.notaRenovacion.create({
      data: {
        // Se anotan los nombres de los archivos aunque no se guarden: si el
        // cliente dice que no recibió el PDF, queda constancia de qué se mandó.
        contenido:
          `Correo de renovación enviado a ${destinatario}` +
          (adjuntos?.length
            ? ` con ${adjuntos.length} adjunto(s): ${adjuntos.map((a) => a.filename).join(', ')}`
            : ''),
        renovacionId: id,
        autorId: userId,
        autorNombre: autor?.name ?? null,
      },
    })

    return this.prisma.renovacion.update({
      where: { id },
      data: {
        envio: 'ENVIADO' as any,
        fechaPrimerEnvio: new Date(),
        correoTexto: dto.texto,
        correoDestinatario: destinatario,
        ...(dto.plantilla ? { correoPlantilla: dto.plantilla } : {}),
      },
    })
  }

  /**
   * Revisa los adjuntos antes de enviarlos.
   *
   * Los archivos NO se guardan en ningún lado: viajan con este envío y se
   * descartan. Son documentos que la aseguradora manda para reenviar al cliente,
   * no información que el CRM deba conservar.
   */
  private validarAdjuntos(
    adjuntos?: { filename: string; content: string }[],
  ): { filename: string; content: string }[] | undefined {
    if (!adjuntos?.length) return undefined

    if (adjuntos.length > 5) {
      throw new ForbiddenException('Máximo 5 archivos adjuntos por correo')
    }

    // 8 MB de tope. Los archivos se codifican en base64 para viajar por correo,
    // lo que los engorda cerca de un 33%: 8 MB reales llegan como ~11 MB, que
    // pasa holgado el límite de 20-25 MB de cualquier proveedor. Poner el tope
    // más alto haría que algunos correos reboten sin explicación.
    const LIMITE = 8 * 1024 * 1024
    let total = 0

    for (const a of adjuntos) {
      if (!a?.filename?.trim() || !a?.content) {
        throw new ForbiddenException('Un archivo adjunto llegó incompleto')
      }
      // Solo documentos e imágenes. Sin esta lista se podría mandar un
      // ejecutable desde el CRM, y además muchos servidores rechazan el correo
      // entero si detectan un adjunto peligroso.
      if (!/\.(pdf|jpe?g|png|docx?|xlsx?)$/i.test(a.filename.trim())) {
        throw new ForbiddenException(
          `"${a.filename}" no es un tipo de archivo permitido. Solo PDF, imágenes, Word o Excel.`,
        )
      }
      // El contenido llega en base64; su tamaño real es aproximadamente 3/4 del
      // texto codificado.
      total += Math.floor((a.content.length * 3) / 4)
    }

    if (total > LIMITE) {
      throw new ForbiddenException(
        `Los adjuntos pesan ${(total / 1024 / 1024).toFixed(1)} MB. El máximo es 8 MB en total.`,
      )
    }

    return adjuntos.map((a) => ({ filename: a.filename.trim(), content: a.content }))
  }

}
