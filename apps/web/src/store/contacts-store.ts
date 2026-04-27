import { create } from 'zustand'
import type { Contact } from '@priority-crm/shared'

interface ContactsState {
  contacts: Contact[]
  selectedContactId: string | null
  searchQuery: string
  filters: Record<string, string>
  setContacts: (contacts: Contact[]) => void
  setSelectedContact: (id: string | null) => void
  setSearchQuery: (query: string) => void
  setFilter: (key: string, value: string) => void
  clearFilters: () => void
}

export const useContactsStore = create<ContactsState>((set) => ({
  contacts: [],
  selectedContactId: null,
  searchQuery: '',
  filters: {},
  setContacts: (contacts) => set({ contacts }),
  setSelectedContact: (id) => set({ selectedContactId: id }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  setFilter: (key, value) =>
    set((state) => ({ filters: { ...state.filters, [key]: value } })),
  clearFilters: () => set({ filters: {} }),
}))
