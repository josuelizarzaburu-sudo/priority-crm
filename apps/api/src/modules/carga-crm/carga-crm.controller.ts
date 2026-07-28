import { Controller, Get, Query } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { CargaCrmService } from './carga-crm.service'

// Endpoint TEMPORAL para cargar la base real (4 ramos).
// Protegido por CARGA_SECRET. Por defecto SIMULA; solo escribe con
// ?confirm=si-cargar. Quitar de app.module.ts cuando termine la carga.
@Controller('admin/carga-crm')
export class CargaCrmController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly service: CargaCrmService,
  ) {}

  @Get()
  async run(@Query('secret') secret: string, @Query('confirm') confirm: string) {
    const esperado = process.env.CARGA_SECRET
    if (!esperado || secret !== esperado) {
      return { ok: false, error: 'Token invalido o CARGA_SECRET no configurado' }
    }
    const orgSlug = process.env.ORGANIZATION_SLUG ?? 'acme-corp'
    const org = await this.prisma.organization.findFirst({ where: { slug: orgSlug } })
    if (!org) return { ok: false, error: `No existe la organizacion "${orgSlug}"` }

    return this.service.cargar(org.id, confirm !== 'si-cargar')
  }
}
