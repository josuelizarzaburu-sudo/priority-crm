export enum DealStatus {
  OPEN = 'OPEN',
  WON = 'WON',
  LOST = 'LOST',
}

export enum ActivityType {
  NOTE = 'NOTE',
  CALL = 'CALL',
  EMAIL = 'EMAIL',
  MEETING = 'MEETING',
  TASK = 'TASK',
  STAGE_CHANGE = 'STAGE_CHANGE',
  DEAL_CREATED = 'DEAL_CREATED',
  CONTACT_CREATED = 'CONTACT_CREATED',
  MESSAGE_SENT = 'MESSAGE_SENT',
  MESSAGE_RECEIVED = 'MESSAGE_RECEIVED',
}

export interface PipelineStage {
  id: string
  name: string
  color: string
  position: number
  probability: number
  organizationId: string
  deals?: Deal[]
}

export interface Deal {
  id: string
  title: string
  value?: number
  currency: string
  probability?: number
  expectedCloseDate?: string
  closedAt?: string
  status: DealStatus
  notes?: string
  position: number
  stageId: string
  contactId?: string
  organizationId: string
  createdById: string
  assignedToId?: string
  createdAt: string
  updatedAt: string
  stage?: PipelineStage
  contact?: { id: string; firstName: string; lastName?: string; company?: string }
  assignedTo?: { id: string; name: string }
}

export interface Activity {
  id: string
  type: ActivityType
  description: string
  metadata?: Record<string, unknown>
  contactId?: string
  dealId?: string
  userId?: string
  organizationId: string
  createdAt: string
}
