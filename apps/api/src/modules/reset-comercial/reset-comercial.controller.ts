import { Controller, Get, Query } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { ResetComercialService } from './reset-comercial.service'

// Endpoint TEMPORAL. Protegido por RESET_SECRET (env). Por defecto SIMULA
// (no borra nada); solo ejecuta de verdad con ?confirm=si-borrar-todo.
// Quitar este modulo de app.module.ts una vez usado.
@Controller('admin/reset-comercial')
export class ResetComercialController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly service: ResetComercialService,
  ) {}

  @Get()
  async run(@Query('secret') secret: string, @Query('confirm') confirm: string) {
    const esperado = process.env.RESET_SECRET
    if (!esperado || secret !== esperado) {
      return { ok: false, error: 'Token invalido o RESET_SECRET no configurado' }
    }

    const orgSlug = process.env.ORGANIZATION_SLUG ?? 'acme-corp'
    const org = await this.prisma.organization.findFirst({ where: { slug: orgSlug } })
    if (!org) return { ok: false, error: `No existe la organizacion "${orgSlug}"` }

    if (confirm !== 'si-borrar-todo') {
      return this.service.simular(org.id)
    }
    return this.service.ejecutar(org.id)
  }
}
