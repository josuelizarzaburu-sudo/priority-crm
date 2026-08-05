import { Controller, Get, Post, Body, Query, Req, UseGuards, ForbiddenException } from '@nestjs/common'
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { RegistroAccesoService, ACCESO } from './registro-acceso.service'
import { PrismaService } from '../../prisma/prisma.service'

// Quien puede LEER el historial de acceso. Es informacion sensible en si misma
// (revela que clientes se consultan), asi que solo administracion.
const PUEDE_AUDITAR = ['SUPER_ADMIN', 'OWNER']

@ApiTags('Registro de acceso')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('registro-acceso')
export class RegistroAccesoController {
  constructor(
    private readonly registro: RegistroAccesoService,
    private readonly prisma: PrismaService,
  ) {}

  @Post('exportacion')
  @ApiOperation({ summary: 'Registrar que un usuario exportó un reporte' })
  registrarExportacion(
    @Body() dto: { reporte?: string; registros?: number },
    @Req() req: any,
  ) {
    return this.registro.registrar({
      organizationId: req.user.organizationId,
      usuarioId: req.user.id,
      usuarioNombre: req.user.name ?? null,
      usuarioRol: req.user.role,
      accion: ACCESO.EXPORTAR_REPORTE,
      objetoTipo: 'Reporte',
      objetoId: dto?.reporte,
      detalle: dto?.reporte
        ? `${dto.reporte}${dto.registros != null ? ` · ${dto.registros} registros` : ''}`
        : undefined,
    })
  }

  @Post('comparativo')
  @ApiOperation({ summary: 'Registrar que un usuario generó un comparativo' })
  registrarComparativo(
    @Body() dto: { categoria?: string; planes?: number; cliente?: string },
    @Req() req: any,
  ) {
    const partes = [
      dto?.categoria,
      dto?.planes != null ? `${dto.planes} planes` : null,
      dto?.cliente,
    ].filter(Boolean)
    return this.registro.registrar({
      organizationId: req.user.organizationId,
      usuarioId: req.user.id,
      usuarioNombre: req.user.name ?? null,
      usuarioRol: req.user.role,
      accion: ACCESO.GENERAR_COMPARATIVO,
      objetoTipo: 'Comparativo',
      objetoId: dto?.categoria,
      detalle: partes.length ? partes.join(' · ') : undefined,
    })
  }

  /**
   * Conteo de comparativos por vendedor, para detectar mal uso: si alguien genera
   * 100 comparativos y tiene 5 leads, está cotizando por fuera del sistema.
   */
  @Get('comparativos-por-usuario')
  @ApiOperation({ summary: 'Cuántos comparativos generó cada usuario (solo admin)' })
  async comparativosPorUsuario(@Req() req: any, @Query('desde') desde?: string) {
    if (!PUEDE_AUDITAR.includes(req.user.role)) {
      throw new ForbiddenException('No tienes permiso para ver esta información')
    }

    const where: any = {
      organizationId: req.user.organizationId,
      accion: ACCESO.GENERAR_COMPARATIVO,
    }
    if (desde) where.createdAt = { gte: new Date(desde) }

    const [porUsuario, deals] = await Promise.all([
      this.prisma.registroAcceso.groupBy({
        by: ['usuarioId', 'usuarioNombre'],
        where,
        _count: { _all: true },
      }),
      // Deals asignados en el mismo periodo, para poder comparar comparativos
      // contra leads reales.
      this.prisma.deal.groupBy({
        by: ['assignedToId'],
        where: {
          organizationId: req.user.organizationId,
          ...(desde ? { createdAt: { gte: new Date(desde) } } : {}),
        },
        _count: { _all: true },
      }),
    ])

    const dealsPorUsuario = new Map<string | null, number>(
      deals.map((d: any) => [d.assignedToId, d._count._all as number]),
    )

    return porUsuario
      .map((u: any) => {
        const comparativos = u._count._all
        const leads: number = dealsPorUsuario.get(u.usuarioId) ?? 0
        return {
          usuarioId: u.usuarioId,
          nombre: u.usuarioNombre ?? 'Usuario eliminado',
          comparativos,
          leads,
          // Cuántos comparativos por cada lead. Un número alto es la señal de
          // alarma; null cuando no tiene leads y sí comparativos.
          porLead: leads > 0 ? Math.round((comparativos / leads) * 10) / 10 : null,
        }
      })
      .sort((a, b) => b.comparativos - a.comparativos)
  }

  @Get()
  @ApiOperation({ summary: 'Historial de acceso a datos sensibles (solo admin)' })
  async listar(
    @Req() req: any,
    @Query('accion') accion?: string,
    @Query('usuarioId') usuarioId?: string,
    @Query('page') page = '1',
  ) {
    if (!PUEDE_AUDITAR.includes(req.user.role)) {
      throw new ForbiddenException('No tienes permiso para ver el registro de acceso')
    }

    const limit = 50
    const pagina = Math.max(1, parseInt(page, 10) || 1)
    const where: any = { organizationId: req.user.organizationId }
    if (accion) where.accion = accion
    if (usuarioId) where.usuarioId = usuarioId

    const [data, total] = await Promise.all([
      this.prisma.registroAcceso.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (pagina - 1) * limit,
        take: limit,
      }),
      this.prisma.registroAcceso.count({ where }),
    ])

    return { data, total, page: pagina, limit, totalPages: Math.ceil(total / limit) }
  }
}
