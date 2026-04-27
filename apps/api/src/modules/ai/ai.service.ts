import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import Anthropic from '@anthropic-ai/sdk'
import { PrismaService } from '../../prisma/prisma.service'

@Injectable()
export class AiService {
  private readonly anthropic: Anthropic

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.anthropic = new Anthropic({ apiKey: config.get('ANTHROPIC_API_KEY') })
  }

  private get model() {
    return this.config.get('ANTHROPIC_MODEL', 'claude-sonnet-4-6')
  }

  async summarizeContact(contactId: string, organizationId: string) {
    const contact = await this.prisma.contact.findFirst({
      where: { id: contactId, organizationId },
      include: {
        deals: { include: { stage: true } },
        activities: { orderBy: { createdAt: 'desc' }, take: 10 },
      },
    })
    if (!contact) return null

    const { content } = await this.anthropic.messages.create({
      model: this.model,
      max_tokens: 500,
      system: `You are a CRM assistant. Summarize customer information concisely for sales teams.`,
      messages: [
        {
          role: 'user',
          content: `Summarize this contact in 2-3 sentences for a sales rep:
Name: ${contact.firstName} ${contact.lastName ?? ''}
Company: ${contact.company ?? 'N/A'}
Open deals: ${contact.deals.length} (total value: ${contact.deals.reduce((s: number, d: any) => s + (d.value ?? 0), 0)})
Recent activities: ${contact.activities.map((a: any) => a.type).join(', ')}`,
        },
      ],
    })

    return (content[0] as any).text
  }

  async suggestNextAction(dealId: string, organizationId: string) {
    const deal = await this.prisma.deal.findFirst({
      where: { id: dealId, organizationId },
      include: {
        stage: true,
        contact: true,
        activities: { orderBy: { createdAt: 'desc' }, take: 5 },
      },
    })
    if (!deal) return null

    const { content } = await this.anthropic.messages.create({
      model: this.model,
      max_tokens: 300,
      system: `You are a sales coach. Suggest the single most impactful next action for this deal. Be specific and actionable. Return JSON: { action: string, reason: string, priority: 'high'|'medium'|'low' }`,
      messages: [
        {
          role: 'user',
          content: `Deal: "${deal.title}" | Stage: ${deal.stage.name} | Value: $${deal.value ?? 0}
Contact: ${deal.contact?.firstName} ${deal.contact?.lastName ?? ''}
Last activities: ${deal.activities.map((a: { description: string }) => a.description).join('; ')}`,
        },
      ],
    })

    try {
      return JSON.parse((content[0] as any).text)
    } catch {
      return { action: (content[0] as any).text, reason: '', priority: 'medium' }
    }
  }

  async draftMessage(params: {
    contactId: string
    channel: string
    intent: string
    organizationId: string
  }) {
    const contact = await this.prisma.contact.findFirst({
      where: { id: params.contactId, organizationId: params.organizationId },
    })

    const { content } = await this.anthropic.messages.create({
      model: this.model,
      max_tokens: 400,
      system: `You are a professional sales communication assistant. Draft messages that are personalized, concise, and action-oriented. Adapt tone to the channel (WhatsApp=casual, Email=professional).`,
      messages: [
        {
          role: 'user',
          content: `Draft a ${params.channel} message to ${contact?.firstName ?? 'the contact'} for: ${params.intent}`,
        },
      ],
    })

    return { draft: (content[0] as any).text }
  }

  async chat(messages: Array<{ role: 'user' | 'assistant'; content: string }>, context?: string) {
    const systemPrompt = [
      'You are Priority, an AI assistant embedded in a CRM platform.',
      'Help sales teams with: contact insights, deal coaching, message drafting, and data analysis.',
      context ? `Context: ${context}` : '',
    ]
      .filter(Boolean)
      .join('\n')

    const stream = await this.anthropic.messages.create({
      model: this.model,
      max_tokens: 1024,
      system: systemPrompt,
      messages,
      stream: true,
    })

    return stream
  }
}
