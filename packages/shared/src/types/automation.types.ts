export enum AutomationTrigger {
  DEAL_STAGE_CHANGED = 'deal.stage.changed',
  DEAL_CREATED = 'deal.created',
  DEAL_WON = 'deal.won',
  DEAL_LOST = 'deal.lost',
  CONTACT_CREATED = 'contact.created',
  MESSAGE_RECEIVED = 'message.received',
  TASK_OVERDUE = 'task.overdue',
}

export type AutomationActionType =
  | 'SEND_EMAIL'
  | 'SEND_WHATSAPP'
  | 'MOVE_DEAL'
  | 'CREATE_TASK'
  | 'NOTIFY_USER'
  | 'ADD_TAG'
  | 'UPDATE_FIELD'

export interface AutomationAction {
  type: AutomationActionType
  config: Record<string, unknown>
}

export interface AutomationCondition {
  field: string
  operator: 'eq' | 'neq' | 'gt' | 'lt' | 'contains' | 'in'
  value: unknown
}

export interface Automation {
  id: string
  name: string
  description?: string
  trigger: string
  conditions?: AutomationCondition[]
  actions: AutomationAction[]
  isActive: boolean
  organizationId: string
  createdById: string
  createdAt: string
  updatedAt: string
}
