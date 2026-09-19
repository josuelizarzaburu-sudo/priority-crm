import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common'
import { createHash, randomBytes } from 'crypto'
import { PrismaService } from '../../prisma/prisma.service'
import { NotificationsService } from '../notifications/notifications.service'
import { TEXTO_CONSENTIMIENTO, VERSION_TEXTO } from './texto-consentimiento'

/**
 * Consentimiento de tratamiento de datos personales (LOPDP Ecuador).
 *
 * La ley pide responsabilidad proactiva y demostrada: si la autoridad pregunta,
 * hay que poder mostrar cuándo aceptó el cliente, desde dónde y qué texto leyó.
 *
 * El consentimiento lo da EL TITULAR desde un enlace propio, no una ejecutiva
 * marcando una casilla: la ley exige que sea libre e informado, y una casilla
 * que marca otro no es ninguna de las dos cosas.
 */

const PUEDE_ADMINISTRAR = ['SUPER_ADMIN', 'OWNER', 'JEFE_OPERACIONES']

@Injectable()
export class ConsentimientosService {
  private readonly logger = new Logger(ConsentimientosService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  private exigirAdmin(role: string) {
    if (!PUEDE_ADMINISTRAR.includes(role)) {
      throw new ForbiddenException('No tienes acceso a los consentimientos')
    }
  }

  /** Huella del texto, para probar después que no se alteró. */
  private huella(texto: string): string {
    return createHash('sha256').update(texto, 'utf8').digest('hex')
  }

  /**
   * Prepara el consentimiento de un cliente y le envía el enlace.
   *
   * Si ya lo tiene otorgado no se vuelve a pedir: escribirle otra vez a alguien
   * que ya aceptó es molestarlo sin motivo.
   */
  async solicitar(clienteId: string, organizationId: string, role: string) {
    this.exigirAdmin(role)

    const cliente = await this.prisma.cliente.findFirst({
      where: { id: clienteId, organizationId },
      select: { id: true, nombres: true, apellidos: true, email: true, nombrePreferido: true },
    })
    if (!cliente) throw new NotFoundException('Cliente no encontrado')
    if (!cliente.email?.trim()) {
      throw new BadRequestException('Este cliente no tiene correo cargado')
    }

    const vigente = await this.prisma.consentimiento.findFirst({
      where: { clienteId, estado: 'OTORGADO' },
    })
    if (vigente) {
      throw new BadRequestException('Este cliente ya otorgó su consentimiento')
    }

    // Si ya se le mandó y no respondió, se reenvía el MISMO enlace: generar uno
    // nuevo invalidaría el que quizá ya tiene abierto.
    const pendiente = await this.prisma.consentimiento.findFirst({
      where: { clienteId, estado: 'PENDIENTE' },
    })

    const registro =
      pendiente ??
      (await this.prisma.consentimiento.create({
        data: {
          clienteId,
          // 32 bytes al azar: no se adivina ni se deduce del id del cliente.
          token: randomBytes(32).toString('hex'),
          correoEnviado: cliente.email.trim(),
          versionTexto: VERSION_TEXTO,
          hashTexto: this.huella(TEXTO_CONSENTIMIENTO),
          organizationId,
        },
      }))

    if (pendiente) {
      await this.prisma.consentimiento.update({
        where: { id: pendiente.id },
        data: { vecesEnviado: { increment: 1 }, ultimoEnvio: new Date() },
      })
    }

    await this.enviarCorreo(registro.token, cliente)
    return { enviado: true, veces: (pendiente?.vecesEnviado ?? 0) + 1 }
  }

  private async enviarCorreo(
    token: string,
    cliente: { nombres: string; nombrePreferido: string | null; email: string | null },
  ) {
    const base = process.env.DOMINIO_PUBLICO ?? 'https://crm.priorityhealth.ec'
    const enlace = `${base}/consentimiento/${token}`
    const saludo = (cliente.nombrePreferido || cliente.nombres || '').split(/\s+/)[0]

    await this.notifications.enviarAvisoSeguridad({
      email: cliente.email!,
      asunto: 'Autorización para el tratamiento de tus datos — Priority',
      mensaje: [
        `${saludo},`,
        '',
        'La Ley Orgánica de Protección de Datos Personales nos pide tu autorización expresa',
        'para tratar tus datos como tu bróker de seguros.',
        '',
        'Toma un minuto. En este enlace puedes leer qué datos usamos, para qué y por cuánto',
        'tiempo, y dar tu autorización:',
        '',
        enlace,
        '',
        'Puedes retirarla cuando quieras desde el mismo enlace.',
      ].join('\n'),
    })
  }

  /**
   * Lo que ve el cliente al abrir el enlace.
   *
   * No pide sesión: el token es la credencial. Solo devuelve el nombre y el
   * texto, nunca sus datos ni sus pólizas.
   */
  async verPorToken(token: string) {
    const c = await this.prisma.consentimiento.findUnique({
      where: { token },
      include: { cliente: { select: { nombres: true, apellidos: true, nombrePreferido: true } } },
    })
    if (!c) throw new NotFoundException('Este enlace no es válido')

    return {
      nombre: `${c.cliente.nombres} ${c.cliente.apellidos}`.trim(),
      estado: c.estado,
      otorgadoEn: c.otorgadoEn,
      texto: TEXTO_CONSENTIMIENTO,
      version: VERSION_TEXTO,
    }
  }

  /** El cliente acepta. Aquí se guarda la evidencia. */
  async otorgar(token: string, ip: string | undefined, navegador: string | undefined) {
    const c = await this.prisma.consentimiento.findUnique({ where: { token } })
    if (!c) throw new NotFoundException('Este enlace no es válido')
    if (c.estado === 'OTORGADO') return { ya: true, otorgadoEn: c.otorgadoEn }

    const actualizado = await this.prisma.consentimiento.update({
      where: { token },
      data: {
        estado: 'OTORGADO',
        otorgadoEn: new Date(),
        ipAceptacion: ip ?? null,
        // Se recorta: sirve para identificar el dispositivo, no para perfilar.
        navegador: navegador?.slice(0, 200) ?? null,
        // Se vuelve a guardar la huella del texto vigente AL ACEPTAR, no la del
        // envío: si la política cambió entre medio, el cliente leyó la nueva.
        hashTexto: this.huella(TEXTO_CONSENTIMIENTO),
        versionTexto: VERSION_TEXTO,
      },
    })

    this.logger.log(`[consentimientos] otorgado por el cliente ${c.clienteId}`)
    return { ya: false, otorgadoEn: actualizado.otorgadoEn }
  }

  /** El cliente retira su autorización. Es un derecho, no se le pregunta por qué. */
  async revocar(token: string) {
    const c = await this.prisma.consentimiento.findUnique({ where: { token } })
    if (!c) throw new NotFoundException('Este enlace no es válido')
    if (c.estado !== 'OTORGADO') {
      throw new BadRequestException('No hay una autorización vigente que retirar')
    }

    await this.prisma.consentimiento.update({
      where: { token },
      data: { estado: 'REVOCADO', revocadoEn: new Date() },
    })

    // Se avisa a operaciones: una revocación obliga a dejar de tratar los datos
    // y alguien tiene que encargarse.
    const admins = await this.prisma.user.findMany({
      where: {
        organizationId: c.organizationId,
        role: { in: PUEDE_ADMINISTRAR as any },
        activo: true,
      },
      select: { email: true },
    })

    for (const a of admins.filter((x) => x.email)) {
      await this.notifications
        .enviarAvisoSeguridad({
          email: a.email!,
          asunto: 'Un cliente retiró su autorización de datos',
          mensaje: `El cliente ${c.clienteId} retiró su consentimiento. Hay que revisar qué tratamiento se detiene.`,
        })
        .catch(() => undefined)
    }

    this.logger.warn(`[consentimientos] REVOCADO por el cliente ${c.clienteId}`)
    return { revocado: true }
  }

  /**
   * El tablero: quién aceptó y quién no.
   *
   * Es lo que se mira para la campaña de seguimiento y lo que se muestra si la
   * autoridad pide cuentas.
   */
  async tablero(organizationId: string, role: string, filtro?: string) {
    this.exigirAdmin(role)

    const clientes = await this.prisma.cliente.findMany({
      where: { organizationId, estado: { not: 'CANCELADO' } },
      select: {
        id: true,
        nombres: true,
        apellidos: true,
        email: true,
        celular: true,
        consentimientos: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            estado: true,
            otorgadoEn: true,
            enviadoEn: true,
            vecesEnviado: true,
            ultimoEnvio: true,
            versionTexto: true,
          },
        },
      },
      orderBy: { apellidos: 'asc' },
    })

    const filas = clientes.map((c) => {
      const ult = c.consentimientos[0]
      return {
        id: c.id,
        nombre: `${c.nombres} ${c.apellidos}`.trim(),
        email: c.email,
        celular: c.celular,
        // Sin correo no se le puede pedir: es su propio estado, no "pendiente".
        estado: !c.email?.trim() ? 'SIN_CORREO' : (ult?.estado ?? 'NO_SOLICITADO'),
        otorgadoEn: ult?.otorgadoEn ?? null,
        vecesEnviado: ult?.vecesEnviado ?? 0,
        ultimoEnvio: ult?.ultimoEnvio ?? ult?.enviadoEn ?? null,
        version: ult?.versionTexto ?? null,
      }
    })

    const cuenta = (e: string) => filas.filter((f) => f.estado === e).length

    return {
      total: filas.length,
      otorgados: cuenta('OTORGADO'),
      pendientes: cuenta('PENDIENTE'),
      noSolicitados: cuenta('NO_SOLICITADO'),
      revocados: cuenta('REVOCADO'),
      sinCorreo: cuenta('SIN_CORREO'),
      filas: filtro ? filas.filter((f) => f.estado === filtro) : filas,
    }
  }

  /**
   * La evidencia de un cliente, como se le presenta a la autoridad.
   *
   * Incluye la huella del texto: permite demostrar que el documento que se
   * muestra hoy es exactamente el que el cliente aceptó ese día.
   */
  async evidencia(clienteId: string, organizationId: string, role: string) {
    this.exigirAdmin(role)

    const registros = await this.prisma.consentimiento.findMany({
      where: { clienteId, organizationId },
      orderBy: { createdAt: 'desc' },
      include: {
        cliente: { select: { nombres: true, apellidos: true, identificacion: true } },
      },
    })
    if (!registros.length) throw new NotFoundException('Este cliente no tiene consentimientos')

    return registros.map((r) => ({
      titular: `${r.cliente.nombres} ${r.cliente.apellidos}`.trim(),
      identificacion: r.cliente.identificacion,
      estado: r.estado,
      correoAlQueSeEnvio: r.correoEnviado,
      otorgadoEn: r.otorgadoEn,
      revocadoEn: r.revocadoEn,
      desdeIp: r.ipAceptacion,
      dispositivo: r.navegador,
      versionDelTexto: r.versionTexto,
      huellaDelTexto: r.hashTexto,
      // Para comprobar en el momento que el texto no cambió desde entonces.
      huellaActual: this.huella(TEXTO_CONSENTIMIENTO),
      coincide: r.hashTexto === this.huella(TEXTO_CONSENTIMIENTO),
    }))
  }

  /** Envía el enlace a todos los que aún no lo tienen. Para la campaña inicial. */
  async solicitarMasivo(organizationId: string, role: string, limite = 50) {
    this.exigirAdmin(role)

    const clientes = await this.prisma.cliente.findMany({
      where: {
        organizationId,
        estado: { not: 'CANCELADO' },
        email: { not: null },
        // Nadie que ya haya aceptado o revocado.
        consentimientos: { none: { estado: { in: ['OTORGADO', 'REVOCADO'] } } },
      },
      select: { id: true },
      // De a poco: mandar 1.450 correos de golpe hace que el proveedor los
      // marque como spam y no llegue ninguno.
      take: limite,
    })

    let enviados = 0
    for (const c of clientes) {
      try {
        await this.solicitar(c.id, organizationId, role)
        enviados++
      } catch (e) {
        this.logger.error(`[consentimientos] no se pudo enviar a ${c.id}: ${e}`)
      }
    }

    return { revisados: clientes.length, enviados }
  }
}
