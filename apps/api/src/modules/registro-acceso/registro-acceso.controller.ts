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
