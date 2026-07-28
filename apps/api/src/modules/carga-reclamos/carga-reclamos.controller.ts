import { Controller, Get, Query } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { CargaReclamosService } from './carga-reclamos.service'

// Endpoint TEMPORAL para cargar el historico de reclamos.
// Protegido por CARGA_SECRET. Simula por defecto.
@Controller('admin/carga-reclamos')
export class CargaReclamosController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly service: CargaReclamosService,
  ) {}

  @Get()
  async run(@Query('secret') secret: string, @Query('confirm') confirm: string) {
    if (!process.env.CARGA_SECRET || secret !== process.env.CARGA_SECRET) {
      return { ok: false, error: 'Token invalido o CARGA_SECRET no configurado' }
    }
    const slug = process.env.ORGANIZATION_SLUG ?? 'acme-corp'
    const org = await this.prisma.organization.findFirst({ where: { slug } })
    if (!org) return { ok: false, error: 'No existe la organizacion' }
    return this.service.cargar(org.id, confirm !== 'si-cargar')
  }
}
