import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PrismaService } from '../../prisma/prisma.service'
import { IngestLeadDto, LeadSource, InsuranceType } from './dto/ingest-lead.dto'
import { NotificationsService } from '../notifications/notifications.service'

@Injectable()
export class LeadsService {
  private readonly logger = new Logger(LeadsService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly notifications: NotificationsService,
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
      where: { organizationId: org.id, role: 'SUPER_ADMIN' },
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

    // For AUTO leads, always assign to Josue
    let autoAssignee: { id: string; email: string; phone: string | null; name: string } | null = null
    if (dto.insuranceType === InsuranceType.AUTO) {
      autoAssignee = await this.prisma.user.findFirst({
        where: { organizationId: org.id, email: 'josuex_99@hotmail.com' },
        select: { id: true, email: true, phone: true, name: true },
      })
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

    const sport = dto.sport ?? false
    const insured = dto.insured ?? false

    // profileType only applies to Salud Vitality — when sport AND insured were explicitly answered
    const hasSurvey = dto.insuranceType === InsuranceType.SALUD &&
      dto.sport !== undefined && dto.insured !== undefined
    let profileType: string | null = null
    if (hasSurvey) {
      if (sport && insured) profileType = 'A'
      else if (sport && !insured) profileType = 'B'
      else if (!sport && insured) profileType = 'C'
      else profileType = 'D'
    }

    const insuranceLabel = dto.insuranceType === 'SALUD' ? 'Salud' : 'Auto'
    const deal = await this.prisma.deal.create({
      data: {
        title: `Seguro de ${insuranceLabel} — ${dto.firstName}${dto.lastName ? ` ${dto.lastName}` : ''}`,
        stageId: firstStage.id,
        contactId: contact.id,
        organizationId: org.id,
        createdById: systemUser.id,
        assignedToId: autoAssignee?.id ?? undefined,
        position,
        notes: `Fuente: ${dto.source ?? LeadSource.WEB} | Seguro: ${dto.insuranceType}`,
        customFields: {
          insuranceType: dto.insuranceType,
          source: dto.source ?? LeadSource.WEB,
          leadOrigin: 'PRIORITY_HEALTH',
          leadCreatedAt: new Date().toISOString(),
          sport,
          insured,
          ...(profileType ? { profileType } : {}),
          ...(dto.sessionId ? { chatSessionId: dto.sessionId } : {}),
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          ...(dto.autoData ? { autoData: JSON.parse(JSON.stringify(dto.autoData)) } : {}),
        },
      },
      include: {
        contact: true,
        stage: true,
        assignedTo: true,
      },
    })

    this.logger.log(`Lead ingested: deal ${deal.id} for contact ${contact.id}`)
    console.log('Deal contact:', deal.contact)
    console.log('Calling notifyNewLead...')

    const contactName = `${dto.firstName}${dto.lastName ? ` ${dto.lastName}` : ''}`
    console.log(`[LeadsService] Enviando notificación para deal ${deal.id} — contacto: ${contactName}`)
    const leadNotifData = {
      dealId: deal.id,
      orgId: org.id,
      contactName,
      phone: dto.phone,
      email: dto.email ?? undefined,
      profileType,
      insuranceType: dto.insuranceType as string,
      sport: hasSurvey ? sport : undefined,
      insured: hasSurvey ? insured : undefined,
      autoData: dto.autoData ? { ...dto.autoData } : undefined,
      notes: dto.notes,
      source: String(dto.source ?? LeadSource.WEB),
      arrivalTime: new Date(),
    }

    this.notifications
      .notifyNewLead(leadNotifData)
      .catch(err => this.logger.error(`Notification error: ${err}`))

    // For AUTO leads, send an extra assigned-notification to Josue with vehicle data
    if (dto.insuranceType === InsuranceType.AUTO && autoAssignee) {
      const ad = dto.autoData
      const vehicleInfo = ad
        ? `🚗 Vehículo: ${[ad.marca, ad.modelo, ad.anio].filter(Boolean).join(' ')}\n` +
          `🪪 Placa: ${ad.placa ?? '—'} | Ciudad: ${ad.ciudad ?? '—'}\n` +
          `📋 Cédula/RUC: ${ad.cedulaRuc ?? '—'}`
        : undefined
      this.notifications
        .notifyDealAssigned(autoAssignee, { ...leadNotifData, notes: vehicleInfo })
        .catch(err => this.logger.error(`Auto assign notification error: ${err}`))
    }

    return { status: 'ok', contactId: contact.id, dealId: deal.id }
  }

  /**
   * Punto de entrada para el chat del sitio web: si ya existe un lead para esta
   * sesión de chat, lo actualiza con la info nueva. Si no existe, crea uno nuevo
   * (etiquetado con el sessionId para futuras actualizaciones). Así una misma
   * conversación nunca genera leads duplicados.
   */
  async upsertLeadFromChat(
    lead: {
      name: string
      phone: string
      email?: string
      interest?: string
      cedula?: string
      placa?: string
      marca_modelo?: string
    },
    sessionId?: string,
  ) {
    const orgSlug = this.config.get('ORGANIZATION_SLUG', 'acme-corp')
    const org = await this.prisma.organization.findFirst({ where: { slug: orgSlug } })
    if (!org) {
      this.logger.error(`Organization with slug "${orgSlug}" not found`)
      return { status: 'error', message: 'Organization not found' }
    }

    if (sessionId) {
      const existingDeal = await this.prisma.deal.findFirst({
        where: {
          organizationId: org.id,
          customFields: { path: ['chatSessionId'], equals: sessionId },
        },
        include: { contact: true },
      })
      if (existingDeal) {
        return this.applyLeadUpdate(existingDeal, lead)
      }
    }

    const [firstName, ...rest] = lead.name.trim().split(/\s+/)
    const lastName = rest.length ? rest.join(' ') : undefined
    const isAuto = /auto/i.test(lead.interest ?? '')
    const insuranceType = isAuto ? InsuranceType.AUTO : InsuranceType.SALUD

    const notesParts = [
      lead.interest,
      lead.cedula ? `Cédula: ${lead.cedula}` : null,
      lead.placa ? `Placa: ${lead.placa}` : null,
      lead.marca_modelo ? `Vehículo: ${lead.marca_modelo}` : null,
    ].filter(Boolean)

    return this.ingestLead({
      firstName,
      lastName,
      phone: lead.phone,
      email: lead.email,
      insuranceType,
      source: LeadSource.CHAT_WEB,
      notes: notesParts.join(' | ') || undefined,
      sessionId,
      autoData: isAuto
        ? {
            placa: lead.placa,
            marca: lead.marca_modelo?.split(' ')[0],
            modelo: lead.marca_modelo?.split(' ').slice(1).join(' '),
            cedulaRuc: lead.cedula,
            nombrePropietario: lead.name,
          }
        : undefined,
    })
  }

  private async applyLeadUpdate(
    deal: { id: string; notes: string | null; customFields: unknown; contactId: string | null; contact: { id: string; email: string | null } | null },
    lead: { name: string; phone: string; email?: string; interest?: string; cedula?: string; placa?: string; marca_modelo?: string },
  ) {
    const cf = (deal.customFields as Record<string, unknown>) ?? {}
    const notesParts = [
      deal.notes,
      lead.interest ? `Interés: ${lead.interest}` : null,
      lead.cedula ? `Cédula: ${lead.cedula}` : null,
      lead.placa ? `Placa: ${lead.placa}` : null,
      lead.marca_modelo ? `Vehículo: ${lead.marca_modelo}` : null,
    ].filter((x): x is string => Boolean(x))
    // Evita repetir la misma línea si el bot manda la misma info dos veces
    const uniqueNotes = Array.from(new Set(notesParts)).join(' | ')

    const updated = await this.prisma.deal.update({
      where: { id: deal.id },
      data: {
        notes: uniqueNotes || undefined,
        customFields: { ...cf, lastChatUpdate: new Date().toISOString() },
      },
    })

    if (lead.email && deal.contact && !deal.contact.email) {
      await this.prisma.contact.update({
        where: { id: deal.contact.id },
        data: { email: lead.email },
      })
    }

    this.logger.log(`Lead updated from chat: deal ${deal.id}`)
    return { status: 'ok', contactId: deal.contactId, dealId: updated.id, updated: true }
  }
}
