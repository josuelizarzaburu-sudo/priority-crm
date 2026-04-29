'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { useQuery } from '@tanstack/react-query'
import { KanbanBoard } from '@/components/pipeline/kanban-board'
import { PipelineHeader } from '@/components/pipeline/pipeline-header'
import { DealPanel } from '@/components/pipeline/deal-panel'
import { api } from '@/lib/api'

interface TeamMember {
  id: string
  name: string
  email: string
  role: string
}

export function PipelineClient() {
  const { data: session } = useSession()
  const userRole = session?.user?.role?.toUpperCase() ?? ''
  const currentUserId = session?.user?.id ?? ''
  const isAdminOrManager = userRole === 'ADMIN' || userRole === 'MANAGER'

  // null means "not yet overridden by user" — computed default reacts to session load
  const [viewModeOverride, setViewModeOverride] = useState<'mine' | 'all' | null>(null)
  const viewMode = viewModeOverride ?? (isAdminOrManager ? 'all' : 'mine')

  const [filterUserId, setFilterUserId] = useState<string | null>(null)
  const [selectedDealId, setSelectedDealId] = useState<string | null>(null)

  const { data: users = [] } = useQuery<TeamMember[]>({
    queryKey: ['users'],
    queryFn: () => api.get('/users').then((r) => r.data),
    enabled: isAdminOrManager,
  })

  return (
    <div className="flex h-full flex-col gap-4">
      <PipelineHeader
        viewMode={viewMode}
        setViewMode={setViewModeOverride}
        filterUserId={filterUserId}
        setFilterUserId={setFilterUserId}
        users={users}
        isAdminOrManager={isAdminOrManager}
      />
      <KanbanBoard
        viewMode={viewMode}
        filterUserId={filterUserId}
        currentUserId={currentUserId}
        onSelectDeal={setSelectedDealId}
      />

      <DealPanel
        dealId={selectedDealId}
        onClose={() => setSelectedDealId(null)}
        userRole={userRole}
        users={users}
      />
    </div>
  )
}
