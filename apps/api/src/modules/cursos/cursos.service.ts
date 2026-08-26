import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'

/** Quién crea y edita cursos. Lista blanca: un rol nuevo no lo hereda. */
const PUEDEN_ADMINISTRAR = ['SUPER_ADMIN', 'OWNER', 'MANAGER']

@Injectable()
export class CursosService {
  constructor(private readonly prisma: PrismaService) {}

  private exigirAdmin(role: string) {
    if (!PUEDEN_ADMINISTRAR.includes(role)) {
      throw new ForbiddenException('No tienes permiso para administrar cursos')
    }
  }

  /**
   * Cursos visibles con el avance de quien consulta.
   *
   * Los no publicados solo los ve quien administra: un curso a medio armar en
   * manos del equipo genera preguntas sin respuesta y certificados sin sentido.
   */
  async listar(organizationId: string, userId: string, role: string) {
    const esAdmin = PUEDEN_ADMINISTRAR.includes(role)

    const cursos = await this.prisma.curso.findMany({
      where: { organizationId, ...(esAdmin ? {} : { publicado: true }) },
      orderBy: [{ orden: 'asc' }, { createdAt: 'asc' }],
      include: {
        modulos: {
          orderBy: { orden: 'asc' },
          select: {
            id: true,
            titulo: true,
            duracionMin: true,
            orden: true,
            _count: { select: { preguntas: true } },
            avances: { where: { userId }, select: { aprobado: true } },
          },
        },
        certificados: { where: { userId }, select: { nota: true, venceEn: true, codigo: true } },
      },
    })

    return cursos.map((c) => {
      const aprobados = c.modulos.filter((m) => m.avances[0]?.aprobado).length
      const cert = c.certificados[0] ?? null
      return {
        id: c.id,
        titulo: c.titulo,
        descripcion: c.descripcion,
        aseguradora: c.aseguradora,
        publicado: c.publicado,
        totalModulos: c.modulos.length,
        modulosAprobados: aprobados,
        // Sin módulos no se puede completar: evita mostrar 0 de 0 como si
        // estuviera terminado.
        completado: c.modulos.length > 0 && aprobados === c.modulos.length,
        certificado: cert
          ? { ...cert, vencido: new Date(cert.venceEn) < new Date() }
          : null,
        modulos: c.modulos.map((m) => ({
          id: m.id,
          titulo: m.titulo,
          duracionMin: m.duracionMin,
          orden: m.orden,
          preguntas: m._count.preguntas,
          aprobado: !!m.avances[0]?.aprobado,
        })),
      }
    })
  }

  /**
   * Abre un módulo para hacerlo.
   *
   * Los módulos se recorren EN ORDEN: no se abre el tres sin aprobar el dos. Sin
   * eso, se salta al último y el certificado deja de significar nada.
   *
   * Las preguntas van SIN la respuesta correcta: si viajara al navegador,
   * cualquiera podría verla antes de responder.
   */
  async abrirModulo(moduloId: string, organizationId: string, userId: string) {
    const modulo = await this.prisma.cursoModulo.findFirst({
      where: { id: moduloId, curso: { organizationId } },
      include: {
        curso: { select: { id: true, titulo: true, notaMinima: true } },
        preguntas: {
          orderBy: { orden: 'asc' },
          select: { id: true, enunciado: true, opciones: true, orden: true },
        },
      },
    })
    if (!modulo) throw new NotFoundException('Módulo no encontrado')

    const anteriores = await this.prisma.cursoModulo.findMany({
      where: { cursoId: modulo.cursoId, orden: { lt: modulo.orden } },
      select: { id: true, titulo: true, avances: { where: { userId }, select: { aprobado: true } } },
    })
    const pendiente = anteriores.find((m) => !m.avances[0]?.aprobado)
    if (pendiente) {
      throw new ForbiddenException(`Primero tienes que aprobar "${pendiente.titulo}"`)
    }

    return {
      id: modulo.id,
      titulo: modulo.titulo,
      descripcion: modulo.descripcion,
      youtubeUrl: modulo.youtubeUrl,
      duracionMin: modulo.duracionMin,
      curso: modulo.curso,
      preguntas: modulo.preguntas,
    }
  }

  /**
   * Corrige las respuestas de un módulo.
   *
   * La corrección va en el SERVIDOR: si se hiciera en el navegador, la respuesta
   * correcta tendría que viajar hasta allá y el resultado sería manipulable.
   *
   * Se guarda el MEJOR intento, no el último: si alguien repasa y responde peor,
   * no debería perder lo que ya había logrado.
   */
  async responderModulo(
    moduloId: string,
    respuestas: { preguntaId: string; opcion: number }[],
    organizationId: string,
    userId: string,
  ) {
    const modulo = await this.prisma.cursoModulo.findFirst({
      where: { id: moduloId, curso: { organizationId } },
      include: {
        curso: { select: { id: true, notaMinima: true, vigenciaMeses: true, titulo: true } },
        preguntas: { select: { id: true, correcta: true, explicacion: true, enunciado: true } },
      },
    })
    if (!modulo) throw new NotFoundException('Módulo no encontrado')
    if (modulo.preguntas.length === 0) {
      throw new BadRequestException('Este módulo todavía no tiene preguntas')
    }

    const elegidas = new Map(respuestas?.map((r) => [r.preguntaId, r.opcion]) ?? [])
    const detalle = modulo.preguntas.map((p) => {
      const elegida = elegidas.get(p.id)
      return {
        preguntaId: p.id,
        enunciado: p.enunciado,
        correcta: p.correcta,
        elegida: elegida ?? null,
        acerto: elegida === p.correcta,
        explicacion: p.explicacion,
      }
    })

    const aciertos = detalle.filter((d) => d.acerto).length
    const total = modulo.preguntas.length
    const nota = Math.round((aciertos / total) * 100)
    const aprobado = nota >= modulo.curso.notaMinima

    const previo = await this.prisma.cursoAvance.findUnique({
      where: { moduloId_userId: { moduloId, userId } },
    })
    const mejora = !previo || aciertos > previo.aciertos

    await this.prisma.cursoAvance.upsert({
      where: { moduloId_userId: { moduloId, userId } },
      create: {
        moduloId,
        userId,
        aciertos,
        total,
        aprobado,
        intentos: 1,
        completadoEn: aprobado ? new Date() : null,
      },
      update: {
        intentos: { increment: 1 },
        // Solo se pisa el resultado si mejoró. Aprobado nunca se revierte: ya
        // demostró que lo sabe.
        ...(mejora ? { aciertos, total } : {}),
        ...(aprobado ? { aprobado: true, completadoEn: previo?.completadoEn ?? new Date() } : {}),
      },
    })

    const certificado = aprobado
      ? await this.emitirSiCompleto(modulo.curso.id, userId, organizationId)
      : null

    return { nota, aciertos, total, aprobado, notaMinima: modulo.curso.notaMinima, detalle, certificado }
  }

  /**
   * Emite el certificado si ya aprobó todos los módulos.
   *
   * La nota del certificado es el promedio de los módulos, no la del último:
   * refleja el curso completo.
   */
  private async emitirSiCompleto(cursoId: string, userId: string, organizationId: string) {
    const curso = await this.prisma.curso.findFirst({
      where: { id: cursoId, organizationId },
      include: { modulos: { select: { id: true } } },
    })
    if (!curso || curso.modulos.length === 0) return null

    const avances = await this.prisma.cursoAvance.findMany({
      where: { userId, moduloId: { in: curso.modulos.map((m) => m.id) } },
      select: { aprobado: true, aciertos: true, total: true },
    })
    const aprobados = avances.filter((a) => a.aprobado)
    if (aprobados.length < curso.modulos.length) return null

    const sumaAciertos = aprobados.reduce((s, a) => s + a.aciertos, 0)
    const sumaTotal = aprobados.reduce((s, a) => s + a.total, 0)
    const nota = sumaTotal > 0 ? Math.round((sumaAciertos / sumaTotal) * 100) : 0

    const venceEn = new Date()
    venceEn.setMonth(venceEn.getMonth() + curso.vigenciaMeses)

    // Código corto y legible, pensado para leerlo de un papel impreso: sin
    // caracteres que se confundan entre sí (0/O, 1/I).
    const alfabeto = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    const codigo = Array.from(
      { length: 8 },
      () => alfabeto[Math.floor(Math.random() * alfabeto.length)],
    ).join('')

    // Al renovar se reemplaza el anterior: un solo certificado vigente por curso
    // y persona.
    return this.prisma.cursoCertificado.upsert({
      where: { cursoId_userId: { cursoId, userId } },
      create: { cursoId, userId, nota, venceEn, codigo },
      update: { nota, emitidoEn: new Date(), venceEn, codigo },
      select: { nota: true, venceEn: true, codigo: true, emitidoEn: true },
    })
  }

  /** Certificados de una persona, para la sección "Mis certificados". */
  async misCertificados(organizationId: string, userId: string) {
    const certs = await this.prisma.cursoCertificado.findMany({
      where: { userId, curso: { organizationId } },
      orderBy: { emitidoEn: 'desc' },
      include: { curso: { select: { titulo: true, aseguradora: true } } },
    })
    const ahora = new Date()
    return certs.map((c) => ({
      codigo: c.codigo,
      nota: c.nota,
      emitidoEn: c.emitidoEn,
      venceEn: c.venceEn,
      curso: c.curso.titulo,
      aseguradora: c.curso.aseguradora,
      vencido: c.venceEn < ahora,
      // Aviso con margen: 30 días alcanzan para rehacer el curso sin apuro.
      porVencer:
        c.venceEn >= ahora &&
        c.venceEn.getTime() - ahora.getTime() < 30 * 24 * 60 * 60 * 1000,
    }))
  }

  // ─── Administración ──────────────────────────────────────────────────────

  async crearCurso(dto: any, organizationId: string, userId: string, role: string) {
    this.exigirAdmin(role)
    if (!dto?.titulo?.trim()) throw new BadRequestException('El curso necesita un título')
    return this.prisma.curso.create({
      data: {
        titulo: dto.titulo.trim(),
        descripcion: dto.descripcion?.trim() || null,
        aseguradora: dto.aseguradora?.trim() || null,
        notaMinima: dto.notaMinima ?? 80,
        vigenciaMeses: dto.vigenciaMeses ?? 12,
        orden: dto.orden ?? 0,
        organizationId,
        createdById: userId,
      },
    })
  }

  async actualizarCurso(id: string, dto: any, organizationId: string, role: string) {
    this.exigirAdmin(role)
    const curso = await this.prisma.curso.findFirst({ where: { id, organizationId } })
    if (!curso) throw new NotFoundException('Curso no encontrado')

    // No se publica un curso vacío: quien entrara vería una lista sin nada y un
    // certificado que se emitiría sin haber aprendido nada.
    if (dto.publicado === true) {
      const modulos = await this.prisma.cursoModulo.count({ where: { cursoId: id } })
      if (modulos === 0) {
        throw new BadRequestException('Agrega al menos un módulo antes de publicar el curso')
      }
      const sinPreguntas = await this.prisma.cursoModulo.findFirst({
        where: { cursoId: id, preguntas: { none: {} } },
        select: { titulo: true },
      })
      if (sinPreguntas) {
        throw new BadRequestException(
          `El módulo "${sinPreguntas.titulo}" no tiene preguntas. Agrégalas antes de publicar.`,
        )
      }
    }

    return this.prisma.curso.update({
      where: { id },
      data: {
        ...(dto.titulo !== undefined ? { titulo: dto.titulo.trim() } : {}),
        ...(dto.descripcion !== undefined ? { descripcion: dto.descripcion?.trim() || null } : {}),
        ...(dto.aseguradora !== undefined ? { aseguradora: dto.aseguradora?.trim() || null } : {}),
        ...(dto.notaMinima !== undefined ? { notaMinima: dto.notaMinima } : {}),
        ...(dto.vigenciaMeses !== undefined ? { vigenciaMeses: dto.vigenciaMeses } : {}),
        ...(dto.publicado !== undefined ? { publicado: dto.publicado } : {}),
        ...(dto.orden !== undefined ? { orden: dto.orden } : {}),
      },
    })
  }

  async eliminarCurso(id: string, organizationId: string, role: string) {
    this.exigirAdmin(role)
    const curso = await this.prisma.curso.findFirst({
      where: { id, organizationId },
      include: { _count: { select: { certificados: true } } },
    })
    if (!curso) throw new NotFoundException('Curso no encontrado')
    // Borrarlo se llevaría por delante los certificados ya emitidos, que son la
    // constancia de que alguien se capacitó.
    if (curso._count.certificados > 0) {
      throw new BadRequestException(
        `Este curso ya emitió ${curso._count.certificados} certificado(s). Despublícalo en vez de borrarlo.`,
      )
    }
    return this.prisma.curso.delete({ where: { id } })
  }

  /**
   * Extrae el id de un enlace de YouTube.
   *
   * Se acepta cualquier forma en que se copie —youtu.be, watch?v=, embed— porque
   * nadie deberia tener que recortar la URL a mano.
   */
  private idDeYoutube(url: string): string | null {
    const m = (url ?? '').match(
      /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/))([A-Za-z0-9_-]{11})/,
    )
    return m?.[1] ?? null
  }

  async crearModulo(cursoId: string, dto: any, organizationId: string, role: string) {
    this.exigirAdmin(role)
    const curso = await this.prisma.curso.findFirst({ where: { id: cursoId, organizationId } })
    if (!curso) throw new NotFoundException('Curso no encontrado')
    if (!dto?.titulo?.trim()) throw new BadRequestException('El módulo necesita un título')

    const videoId = this.idDeYoutube(dto.youtubeUrl)
    if (!videoId) {
      throw new BadRequestException(
        'El enlace de YouTube no es válido. Pega la dirección completa del video.',
      )
    }

    const ultimo = await this.prisma.cursoModulo.findFirst({
      where: { cursoId },
      orderBy: { orden: 'desc' },
      select: { orden: true },
    })

    return this.prisma.cursoModulo.create({
      data: {
        cursoId,
        titulo: dto.titulo.trim(),
        descripcion: dto.descripcion?.trim() || null,
        // Se guarda normalizado: asi el reproductor no tiene que interpretar
        // cinco formatos distintos de URL.
        youtubeUrl: `https://www.youtube.com/embed/${videoId}`,
        duracionMin: dto.duracionMin ?? null,
        orden: dto.orden ?? (ultimo ? ultimo.orden + 1 : 0),
      },
    })
  }

  async actualizarModulo(id: string, dto: any, organizationId: string, role: string) {
    this.exigirAdmin(role)
    const modulo = await this.prisma.cursoModulo.findFirst({
      where: { id, curso: { organizationId } },
    })
    if (!modulo) throw new NotFoundException('Módulo no encontrado')

    let youtubeUrl: string | undefined
    if (dto.youtubeUrl !== undefined) {
      const videoId = this.idDeYoutube(dto.youtubeUrl)
      if (!videoId) throw new BadRequestException('El enlace de YouTube no es válido')
      youtubeUrl = `https://www.youtube.com/embed/${videoId}`
    }

    return this.prisma.cursoModulo.update({
      where: { id },
      data: {
        ...(dto.titulo !== undefined ? { titulo: dto.titulo.trim() } : {}),
        ...(dto.descripcion !== undefined ? { descripcion: dto.descripcion?.trim() || null } : {}),
        ...(youtubeUrl ? { youtubeUrl } : {}),
        ...(dto.duracionMin !== undefined ? { duracionMin: dto.duracionMin } : {}),
        ...(dto.orden !== undefined ? { orden: dto.orden } : {}),
      },
    })
  }

  async eliminarModulo(id: string, organizationId: string, role: string) {
    this.exigirAdmin(role)
    const modulo = await this.prisma.cursoModulo.findFirst({
      where: { id, curso: { organizationId } },
    })
    if (!modulo) throw new NotFoundException('Módulo no encontrado')
    return this.prisma.cursoModulo.delete({ where: { id } })
  }

  /** Preguntas de un módulo, CON la respuesta correcta. Solo para administrar. */
  async preguntasDeModulo(moduloId: string, organizationId: string, role: string) {
    this.exigirAdmin(role)
    return this.prisma.cursoPregunta.findMany({
      where: { moduloId, modulo: { curso: { organizationId } } },
      orderBy: { orden: 'asc' },
    })
  }

  async guardarPreguntas(
    moduloId: string,
    preguntas: {
      enunciado: string
      opciones: string[]
      correcta: number
      explicacion?: string
    }[],
    organizationId: string,
    role: string,
  ) {
    this.exigirAdmin(role)
    const modulo = await this.prisma.cursoModulo.findFirst({
      where: { id: moduloId, curso: { organizationId } },
    })
    if (!modulo) throw new NotFoundException('Módulo no encontrado')

    const lista = preguntas ?? []
    for (const [i, p] of lista.entries()) {
      if (!p?.enunciado?.trim()) {
        throw new BadRequestException(`La pregunta ${i + 1} no tiene enunciado`)
      }
      const ops = (p.opciones ?? []).map((o) => (o ?? '').trim()).filter(Boolean)
      if (ops.length < 2) {
        throw new BadRequestException(`La pregunta ${i + 1} necesita al menos 2 opciones`)
      }
      if (p.correcta < 0 || p.correcta >= ops.length) {
        throw new BadRequestException(`La pregunta ${i + 1} no tiene marcada la respuesta correcta`)
      }
    }

    // Se reemplazan todas de una vez: editarlas de a una obligaría a llevar la
    // cuenta de cuáles se borraron, y el formulario ya las envía completas.
    await this.prisma.cursoPregunta.deleteMany({ where: { moduloId } })
    if (lista.length === 0) return { total: 0 }

    await this.prisma.cursoPregunta.createMany({
      data: lista.map((p, i) => ({
        moduloId,
        enunciado: p.enunciado.trim(),
        opciones: (p.opciones ?? []).map((o) => (o ?? '').trim()).filter(Boolean),
        correcta: p.correcta,
        explicacion: p.explicacion?.trim() || null,
        orden: i,
      })),
    })
    return { total: lista.length }
  }

  /** Quién completó qué, para administración. */
  async reporte(organizationId: string, role: string) {
    this.exigirAdmin(role)
    const certs = await this.prisma.cursoCertificado.findMany({
      where: { curso: { organizationId } },
      orderBy: { emitidoEn: 'desc' },
      include: {
        curso: { select: { titulo: true } },
        user: { select: { id: true, name: true } },
      },
    })
    const ahora = new Date()
    return certs.map((c) => ({
      usuario: c.user.name,
      usuarioId: c.user.id,
      curso: c.curso.titulo,
      nota: c.nota,
      emitidoEn: c.emitidoEn,
      venceEn: c.venceEn,
      vencido: c.venceEn < ahora,
    }))
  }
}
