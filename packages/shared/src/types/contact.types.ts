export enum ContactStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  LEAD = 'LEAD',
  CUSTOMER = 'CUSTOMER',
  CHURNED = 'CHURNED',
}

export interface Contact {
  id: string
  firstName: string
  lastName?: string
  email?: string
  phone?: string
  company?: string
  position?: string
  avatar?: string
  status: ContactStatus
  source?: string
  notes?: string
  customFields?: Record<string, unknown>
  organizationId: string
  createdById: string
  assignedToId?: string
  createdAt: string
  updatedAt: string
  tags?: Tag[]
  assignedTo?: { id: string; name: string; email: string }
}

export interface Tag {
  id: string
  name: string
  color: string
}

export interface ContactTimeline {
  activities: Activity[]
  messages: Message[]
  deals: Deal[]
}

import type { Activity } from './deal.types'
import type { Message } from './communication.types'
import type { Deal } from './deal.types'
