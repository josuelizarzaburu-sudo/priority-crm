import { create } from 'zustand'
import type { Conversation, Message } from '@priority-crm/shared'

interface CommunicationsState {
  conversations: Conversation[]
  activeConversationId: string | null
  messages: Record<string, Message[]>
  unreadCount: number
  setConversations: (conversations: Conversation[]) => void
  setActiveConversation: (id: string | null) => void
  addMessage: (conversationId: string, message: Message) => void
  setMessages: (conversationId: string, messages: Message[]) => void
  incrementUnread: () => void
  resetUnread: () => void
}

export const useCommunicationsStore = create<CommunicationsState>((set) => ({
  conversations: [],
  activeConversationId: null,
  messages: {},
  unreadCount: 0,
  setConversations: (conversations) => set({ conversations }),
  setActiveConversation: (id) => set({ activeConversationId: id }),
  addMessage: (conversationId, message) =>
    set((state) => ({
      messages: {
        ...state.messages,
        [conversationId]: [...(state.messages[conversationId] ?? []), message],
      },
    })),
  setMessages: (conversationId, messages) =>
    set((state) => ({ messages: { ...state.messages, [conversationId]: messages } })),
  incrementUnread: () => set((state) => ({ unreadCount: state.unreadCount + 1 })),
  resetUnread: () => set({ unreadCount: 0 }),
}))
