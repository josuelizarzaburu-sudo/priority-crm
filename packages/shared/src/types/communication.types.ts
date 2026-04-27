export enum CommunicationChannel {
  WHATSAPP = 'WHATSAPP',
  EMAIL = 'EMAIL',
  VOIP = 'VOIP',
  SMS = 'SMS',
}

export enum MessageDirection {
  INBOUND = 'INBOUND',
  OUTBOUND = 'OUTBOUND',
}

export enum MessageType {
  TEXT = 'TEXT',
  IMAGE = 'IMAGE',
  DOCUMENT = 'DOCUMENT',
  AUDIO = 'AUDIO',
  VIDEO = 'VIDEO',
  TEMPLATE = 'TEMPLATE',
}

export interface Conversation {
  id: string
  channel: CommunicationChannel
  status: 'OPEN' | 'CLOSED' | 'PENDING'
  externalId?: string
  contactId?: string
  organizationId: string
  createdAt: string
  updatedAt: string
  contact?: { id: string; firstName: string; lastName?: string; phone?: string; email?: string }
  messages?: Message[]
  _count?: { messages: number }
}

export interface Message {
  id: string
  conversationId: string
  content: string
  type: MessageType
  direction: MessageDirection
  read: boolean
  externalId?: string
  metadata?: Record<string, unknown>
  sentById?: string
  createdAt: string
  conversation?: { channel: CommunicationChannel }
}
