import { Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'

/**
 * Registro de acceso a datos sensibles.
 *
 * Deja rastro de quien vio o exporto que. Con datos de salud, poder responder
 * "quien saco esta informacion y cuando" es clave, y el solo hecho de que exista
 * el registro desincentiva el mal uso.
 *
 * Nunca lanza: si registrar falla, se anota en el log pero NO se rompe la accion
 * del usuario. El registro es importante, pero no al punto de impedir que alguien
 * abra una ficha porque la tabla de auditoria tuvo un problema.
 */
@Injectable()
export class RegistroAccesoService {
  private readonly logger = new Logger(RegistroAccesoService.name)

  constructor(private readonly prisma: PrismaService) {}

  async registrar(params: {
    organizationId: string
    usuarioId?: string
    usuarioNombre?: string | null
    usuarioRol?: string
    accion: string
    objetoTipo?: string
    objetoId?: string
    detalle?: string
  }): Promise<void> {
    try {
      await this.prisma.registroAcceso.create({
        data: {
          organizationId: params.organizationId,
          usuarioId: params.usuarioId ?? null,
          usuarioNombre: params.usuarioNombre ?? null,
          usuarioRol: params.usuarioRol ?? null,
          accion: params.accion,
          objetoTipo: params.objetoTipo ?? null,
          objetoId: params.objetoId ?? null,
          detalle: params.detalle ?? null,
        },
      })
    } catch (e) {
      this.logger.error(`No se pudo registrar el acceso (${params.accion}): ${e}`)
    }
  }
}

/** Acciones que se registran. Constantes para no tener strings sueltos. */
export const ACCESO = {
  VER_FICHA_CLIENTE: 'VER_FICHA_CLIENTE',
  EXPORTAR_REPORTE: 'EXPORTAR_REPORTE',
  // Comparativo generado (el que se manda al cliente). Interesa el CONTEO por
  // vendedor: si alguien descarga 100 comparativos y solo tiene 5 leads, está
  // cotizando por fuera del sistema o usando mal la herramienta.
  GENERAR_COMPARATIVO: 'GENERAR_COMPARATIVO',
} as const
