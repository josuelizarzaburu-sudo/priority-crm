import { Controller, Get, Query } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { CargaCrmService } from './carga-crm.service'

// Endpoints TEMPORALES para poner la base en su estado real.
// Ambos protegidos por CARGA_SECRET y ambos SIMULAN por defecto.
// Quitar de app.module.ts cuando termine la carga.
@Controller('admin/carga-crm')
export class CargaCrmController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly service: CargaCrmService,
  ) {}

  private async org() {
    const slug = process.env.ORGANIZATION_SLUG ?? 'acme-corp'
    return this.prisma.organization.findFirst({ where: { slug } })
  }

  // Carga la base real de los 4 ramos. Aditiva: no duplica lo ya existente.
  @Get()
  async cargar(@Query('secret') secret: string, @Query('confirm') confirm: string) {
    if (!process.env.CARGA_SECRET || secret !== process.env.CARGA_SECRET) {
      return { ok: false, error: 'Token invalido o CARGA_SECRET no configurado' }
    }
    const org = await this.org()
    if (!org) return { ok: false, error: 'No existe la organizacion' }
    return this.service.cargar(org.id, confirm !== 'si-cargar')
  }

  // Borra los clientes de la carga de prueba inicial (cedulas inventadas),
  // dejando solo los de la base real.
  @Get('limpiar')
  async limpiar(@Query('secret') secret: string, @Query('confirm') confirm: string) {
    if (!process.env.CARGA_SECRET || secret !== process.env.CARGA_SECRET) {
      return { ok: false, error: 'Token invalido o CARGA_SECRET no configurado' }
    }
    const org = await this.org()
    if (!org) return { ok: false, error: 'No existe la organizacion' }
    return this.service.limpiarPrueba(org.id, confirm !== 'si-borrar')
  }
}
