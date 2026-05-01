import { create } from 'zustand'

interface UIState {
  sidebarCollapsed: boolean
  mobileMenuOpen: boolean
  commandPaletteOpen: boolean
  aiAssistantOpen: boolean
  toggleSidebar: () => void
  toggleMobileMenu: () => void
  closeMobileMenu: () => void
  toggleCommandPalette: () => void
  toggleAIAssistant: () => void
}

export const useUIStore = create<UIState>((set) => ({
  sidebarCollapsed: false,
  mobileMenuOpen: false,
  commandPaletteOpen: false,
  aiAssistantOpen: false,
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  toggleMobileMenu: () => set((s) => ({ mobileMenuOpen: !s.mobileMenuOpen })),
  closeMobileMenu: () => set({ mobileMenuOpen: false }),
  toggleCommandPalette: () => set((s) => ({ commandPaletteOpen: !s.commandPaletteOpen })),
  toggleAIAssistant: () => set((s) => ({ aiAssistantOpen: !s.aiAssistantOpen })),
}))
