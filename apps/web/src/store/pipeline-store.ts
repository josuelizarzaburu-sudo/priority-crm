import { create } from 'zustand'
import type { Deal, PipelineStage } from '@priority-crm/shared'

interface PipelineState {
  stages: PipelineStage[]
  deals: Deal[]
  activeFilter: string | null
  searchQuery: string
  setStages: (stages: PipelineStage[]) => void
  setDeals: (deals: Deal[]) => void
  setActiveFilter: (filter: string | null) => void
  setSearchQuery: (query: string) => void
  moveDeal: (dealId: string, targetStageId: string, position: number) => void
}

export const usePipelineStore = create<PipelineState>((set) => ({
  stages: [],
  deals: [],
  activeFilter: null,
  searchQuery: '',
  setStages: (stages) => set({ stages }),
  setDeals: (deals) => set({ deals }),
  setActiveFilter: (filter) => set({ activeFilter: filter }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  moveDeal: (dealId, targetStageId, position) =>
    set((state) => ({
      deals: state.deals.map((d) =>
        d.id === dealId ? { ...d, stageId: targetStageId, position } : d,
      ),
    })),
}))
