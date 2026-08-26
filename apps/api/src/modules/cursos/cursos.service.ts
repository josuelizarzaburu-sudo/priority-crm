import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'

/** Quién crea y edita cursos. Lista blanca: un rol nuevo no lo hereda. */
const PUEDEN_ADMINISTRAR = ['SUPER_ADMIN', 'OWNER', 'MANAGER']

/** Hoy en Ecuador como YYYY-MM-DD. */
function hoyEnEcuador(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Guayaquil',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

/**
 * Baraja una lista sin tocar la original.
 *
 * Se usa para que las preguntas y sus opciones cambien de orden en cada intento:
 * si el orden fuera fijo, memorizar "la B, la A, la C" bastaria para aprobar sin
 * haber visto el video.
 */
function barajar<T>(lista: readonly T[]): T[] {
  const r = [...lista]
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[r[i], r[j]] = [r[j], r[i]]
  }
  return r
}

@Injectable()
export class CursosService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Comprueba si puede intentar ahora, y devuelve por qué no si no puede.
   *
   * Los dos límites existen porque, sin ellos, el quiz se pasa a fuerza de
   * probar: reintentar al instante y con las preguntas en el mismo orden permite
   * ir cambiando de opción hasta acertar, sin ver el video.
   *
   * Quien ya aprobó no tiene límite: puede repasar cuando quiera.
   */
  private revisarLimites(
    avance: { ultimoIntentoEn: Date | null; intentosHoy: number; diaDeIntentos: string | null; aprobado: boolean } | null,
    curso: { esperaMinutos: number; intentosPorDia: number },
  ): { puede: boolean; motivo?: string; segundosRestantes?: number } {
    if (!avance || avance.aprobado) return { puede: true }

    if (curso.esperaMinutos > 0 && avance.ultimoIntentoEn) {
      const pasados = Date.now() - new Date(avance.ultimoIntentoEn).getTime()
      const faltan = curso.esperaMinutos * 60_000 - pasados
      if (faltan > 0) {
        const min = Math.ceil(faltan / 60_000)
        return {
          puede: false,
          motivo: `Espera ${min} minuto${min === 1 ? '' : 's'} antes de volver a intentar. Aprovecha para repasar el video.`,
          segundosRestantes: Math.ceil(faltan / 1000),
        }
      }
    }

    if (curso.intentosPorDia > 0 && avance.diaDeIntentos === hoyEnEcuador()) {
      if (avance.intentosHoy >= curso.intentosPorDia) {
        return {
          puede: false,
          motivo: `Ya usaste tus ${curso.intentosPorDia} intentos de hoy en este módulo. Vuelve mañana con el video repasado.`,
        }
      }
    }

    return { puede: true }
  }

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
        curso: {
          select: {
            id: true,
            titulo: true,
            notaMinima: true,
            esperaMinutos: true,
            intentosPorDia: true,
          },
        },
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

    const avance = await this.prisma.cursoAvance.findUnique({
      where: { moduloId_userId: { moduloId, userId } },
      select: { ultimoIntentoEn: true, intentosHoy: true, diaDeIntentos: true, aprobado: true },
    })
    const limite = this.revisarLimites(avance, modulo.curso)

    // Las preguntas y sus opciones se barajan EN CADA APERTURA. Con orden fijo,
    // memorizar posiciones basta para aprobar sin haber visto el video.
    //
    // Cada opcion viaja con su POSICION ORIGINAL (`valor`), que es contra lo que
    // corrige el servidor. Sin eso, al barajar el indice que elige la persona
    // dejaria de corresponder al guardado y se marcarian errores donde no los
    // hay. El indice correcto nunca sale de aqui: `valor` por si solo no dice
    // cual es.
    const preguntas = barajar<(typeof modulo.preguntas)[number]>(modulo.preguntas).map((p) => ({
      id: p.id,
      enunciado: p.enunciado,
      opciones: barajar(
        ((p.opciones as string[]) ?? []).map((texto, valor) => ({ texto, valor })),
      ),
    }))

    const hoy = hoyEnEcuador()
    const usadosHoy = avance?.diaDeIntentos === hoy ? avance.intentosHoy : 0

    return {
      id: modulo.id,
      titulo: modulo.titulo,
      descripcion: modulo.descripcion,
      youtubeUrl: modulo.youtubeUrl,
      duracionMin: modulo.duracionMin,
      curso: modulo.curso,
      preguntas,
      // Estado de los limites, para que la pantalla lo muestre antes de que
      // conteste y no despues de haber respondido todo.
      puedeIntentar: limite.puede,
      motivoBloqueo: limite.motivo ?? null,
      segundosRestantes: limite.segundosRestantes ?? null,
      intentosRestantesHoy:
        modulo.curso.intentosPorDia > 0
          ? Math.max(0, modulo.curso.intentosPorDia - usadosHoy)
          : null,
      yaAprobado: !!avance?.aprobado,
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
        curso: {
          select: {
            id: true,
            notaMinima: true,
            vigenciaMeses: true,
            titulo: true,
            esperaMinutos: true,
            intentosPorDia: true,
          },
        },
        preguntas: { select: { id: true, correcta: true, explicacion: true, enunciado: true } },
      },
    })
    if (!modulo) throw new NotFoundException('Módulo no encontrado')
    if (modulo.preguntas.length === 0) {
      throw new BadRequestException('Este módulo todavía no tiene preguntas')
    }

    // Los limites se comprueban AQUI y no solo al abrir: si estuvieran solo en
    // la apertura, bastaria con dejar la pantalla abierta y reenviar respuestas
    // para saltarselos.
    const avancePrevio = await this.prisma.cursoAvance.findUnique({
      where: { moduloId_userId: { moduloId, userId } },
    })
    const limite = this.revisarLimites(avancePrevio, modulo.curso)
    if (!limite.puede) throw new ForbiddenException(limite.motivo)

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

    const previo = avancePrevio
    const mejora = !previo || aciertos > previo.aciertos
    const hoy = hoyEnEcuador()
    // El contador se reinicia al cambiar de dia: si no, los intentos de ayer
    // seguirian contando hoy.
    const intentosHoy = previo?.diaDeIntentos === hoy ? previo.intentosHoy + 1 : 1

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
        ultimoIntentoEn: new Date(),
        intentosHoy: 1,
        diaDeIntentos: hoy,
      },
      update: {
        intentos: { increment: 1 },
        ultimoIntentoEn: new Date(),
        intentosHoy,
        diaDeIntentos: hoy,
        // Solo se pisa el resultado si mejoró. Aprobado nunca se revierte: ya
        // demostró que lo sabe.
        ...(mejora ? { aciertos, total } : {}),
        ...(aprobado ? { aprobado: true, completadoEn: previo?.completadoEn ?? new Date() } : {}),
      },
    })

    const certificado = aprobado
      ? await this.emitirSiCompleto(modulo.curso.id, userId, organizationId)
      : null

    // Al REPROBAR no se dice cual era la correcta ni se muestra la explicacion:
    // eso seria el machete para el siguiente intento —solo habria que memorizar
    // y pasar—. Se dice unicamente cuales fallo, para saber que repasar.
    // Al aprobar si va el repaso completo: ahi ya demostro que lo sabe, y las
    // explicaciones son donde de verdad se aprende.
    const detalleVisible = aprobado
      ? detalle
      : detalle.map((d) => ({
          preguntaId: d.preguntaId,
          enunciado: d.enunciado,
          acerto: d.acerto,
          correcta: null,
          elegida: null,
          explicacion: null,
        }))

    const restantesHoy =
      modulo.curso.intentosPorDia > 0
        ? Math.max(0, modulo.curso.intentosPorDia - intentosHoy)
        : null

    return {
      nota,
      aciertos,
      total,
      aprobado,
      notaMinima: modulo.curso.notaMinima,
      detalle: detalleVisible,
      certificado,
      intentosRestantesHoy: restantesHoy,
      esperaMinutos: modulo.curso.esperaMinutos,
    }
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
