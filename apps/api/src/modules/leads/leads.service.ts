import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PrismaService } from '../../prisma/prisma.service'
import { IngestLeadDto, LeadSource } from './dto/ingest-lead.dto'

@Injectable()
export class LeadsService {
  private readonly logger = new Logger(LeadsService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async ingestLead(dto: IngestLeadDto) {
    const orgSlug = this.config.get('ORGANIZATION_SLUG', 'acme-corp')

    const org = await this.prisma.organization.findFirst({ where: { slug: orgSlug } })
    if (!org) {
      this.logger.error(`Organization with slug "${orgSlug}" not found`)
      return { status: 'error', message: 'Organization not found' }
    }

    // Use the ADMIN user as system creator for externally-sourced leads
    const systemUser = await this.prisma.user.findFirst({
      where: { organizationId: org.id, role: 'ADMIN' },
    })
    if (!systemUser) {
      this.logger.error(`No ADMIN user found for org ${org.id}`)
      return { status: 'error', message: 'No admin user found' }
    }

    // Find first pipeline stage (Prospección = position 1)
    const firstStage = await this.prisma.pipelineStage.findFirst({
      where: { organizationId: org.id },
      orderBy: { position: 'asc' },
    })
    if (!firstStage) {
      this.logger.error(`No pipeline stages found for org ${org.id}`)
      return { status: 'error', message: 'No pipeline stages configured' }
    }

    // Upsert contact — match by phone, then email, to avoid duplicates
    let contact = await this.prisma.contact.findFirst({
      where: {
        organizationId: org.id,
        OR: [
          { phone: dto.phone },
          ...(dto.email ? [{ email: dto.email }] : []),
        ],
      },
    })

    if (!contact) {
      contact = await this.prisma.contact.create({
        data: {
          firstName: dto.firstName,
          lastName: dto.lastName,
          phone: dto.phone,
          email: dto.email,
          status: 'LEAD',
          organizationId: org.id,
          createdById: systemUser.id,
          customFields: { insuranceType: dto.insuranceType },
        },
      })
      this.logger.log(`Contact created: ${contact.id} (${contact.firstName})`)
    }

    // Always create a new deal per lead submission — the same contact can ask for multiple quotes
    const lastDeal = await this.prisma.deal.findFirst({
      where: { stageId: firstStage.id },
      orderBy: { position: 'desc' },
    })
    const position = (lastDeal?.position ?? 0) + 1000

    const insuranceLabel = dto.insuranceType === 'SALUD' ? 'Salud' : 'Auto'
    const deal = await this.prisma.deal.create({
      data: {
        title: `Seguro de ${insuranceLabel} — ${dto.firstName}${dto.lastName ? ` ${dto.lastName}` : ''}`,
        stageId: firstStage.id,
        contactId: contact.id,
        organizationId: org.id,
        createdById: systemUser.id,
        position,
        notes: `Fuente: ${dto.source ?? LeadSource.WEB} | Seguro: ${dto.insuranceType}`,
        customFields: {
          insuranceType: dto.insuranceType,
          source: dto.source ?? LeadSource.WEB,
          leadCreatedAt: new Date().toISOString(),
        },
      },
      include: {
        stage: true,
        contact: { select: { id: true, firstName: true, lastName: true, phone: true, email: true } },
      },
    })

    this.logger.log(`Lead ingested: deal ${deal.id} for contact ${contact.id}`)
    return { status: 'ok', contactId: contact.id, dealId: deal.id }
  }
}
