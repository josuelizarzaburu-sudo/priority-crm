import { Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'

// Reset TEMPORAL del área comercial antes del lanzamiento.
// Borra: contactos, deals, actividades, conversaciones, mensajes y whatsapp
// ligado a esos deals.
// NO TOCA: usuarios, organización, columnas del pipeline (config), automatizaciones,
// calendario, capacitaciones, etiquetas, ni nada del módulo de Clientes/Pólizas.
@Injectable()
export class ResetComercialService {
  private readonly logger = new Logger(ResetComercialService.name)

  constructor(private readonly prisma: PrismaService) {}

  private async contar(organizationId: string) {
    const [contactos, deals, actividades, conversaciones, mensajes, whatsapp] =
      await Promise.all([
        this.prisma.contact.count({ where: { organizationId } }),
        this.prisma.deal.count({ where: { organizationId } }),
        this.prisma.activity.count({ where: { organizationId } }),
        this.prisma.conversation.count({ where: { organizationId } }),
        this.prisma.message.count({ where: { conversation: { organizationId } } }),
        this.prisma.whatsappMessage.count({ where: { deal: { organizationId } } }),
      ])
    return { contactos, deals, actividades, conversaciones, mensajes, whatsapp }
  }

  async simular(organizationId: string) {
    const antes = await this.contar(organizationId)
    return {
      ok: true,
      modo: 'SIMULACION — no se borró nada todavía',
      seEliminaria: antes,
      seConserva: [
        'usuarios',
        'organización',
        'columnas del pipeline (configuración)',
        'automatizaciones',
        'calendario',
        'capacitaciones',
        'etiquetas',
        'módulo de Clientes / Pólizas / Dependientes',
      ],
      siguientePaso: 'Repite la llamada agregando &confirm=si-borrar-todo para ejecutar de verdad',
    }
  }

  async ejecutar(organizationId: string) {
    const antes = await this.contar(organizationId)
    this.logger.log(`Reset comercial iniciado. Antes: ${JSON.stringify(antes)}`)

    // Orden que respeta las llaves foráneas: primero lo que depende de otra
    // cosa, al final el contacto.
    await this.prisma.$transaction([
      this.prisma.whatsappMessage.deleteMany({ where: { deal: { organizationId } } }),
      this.prisma.message.deleteMany({ where: { conversation: { organizationId } } }),
      this.prisma.activity.deleteMany({ where: { organizationId } }),
      this.prisma.conversation.deleteMany({ where: { organizationId } }),
      this.prisma.deal.deleteMany({ where: { organizationId } }),
      this.prisma.contact.deleteMany({ where: { organizationId } }),
    ])

    const despues = await this.contar(organizationId)
    this.logger.log(`Reset comercial terminado. Después: ${JSON.stringify(despues)}`)

    return { ok: true, modo: 'EJECUTADO', antes, despues }
  }
}
