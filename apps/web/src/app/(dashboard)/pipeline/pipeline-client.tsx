'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { useQuery } from '@tanstack/react-query'
import { KanbanBoard } from '@/components/pipeline/kanban-board'
import { PipelineHeader, type OriginFilter, type InsuranceFilter, type MesFilter } from '@/components/pipeline/pipeline-header'
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
  const isAdminOrManager = ['SUPER_ADMIN', 'OWNER', 'MANAGER'].includes(userRole)

  console.log('Current user role (raw):', session?.user?.role)
  console.log('Current user role (normalized):', userRole)
  console.log('Is sales rep:', userRole === 'SALES_REP')

  // null means "not yet overridden by user" — computed default reacts to session load
  const [viewModeOverride, setViewModeOverride] = useState<'mine' | 'all' | null>(null)
  const viewMode = viewModeOverride ?? (isAdminOrManager ? 'all' : 'mine')

  const [filterUserId, setFilterUserId] = useState<string | null>(null)
  const [originFilter, setOriginFilter] = useState<OriginFilter>('ALL')
  const [insuranceFilter, setInsuranceFilter] = useState<InsuranceFilter>('ALL')
  // Arranca en 'ALL' para no cambiarle el tablero a nadie sin avisar: quien no
  // toque el filtro sigue viendo exactamente lo mismo que antes.
  const [mesFilter, setMesFilter] = useState<MesFilter>('ALL')
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
        originFilter={originFilter}
        setOriginFilter={setOriginFilter}
        insuranceFilter={insuranceFilter}
        setInsuranceFilter={setInsuranceFilter}
        mesFilter={mesFilter}
        setMesFilter={setMesFilter}
        users={users}
        isAdminOrManager={isAdminOrManager}
        userRole={userRole}
      />
      <KanbanBoard
        viewMode={viewMode}
        filterUserId={filterUserId}
        originFilter={originFilter}
        insuranceFilter={insuranceFilter}
        mesFilter={mesFilter}
        currentUserId={currentUserId}
        userRole={userRole}
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
