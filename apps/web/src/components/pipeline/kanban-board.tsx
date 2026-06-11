'use client'

import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { GripVertical, DollarSign, Bell, Lock } from 'lucide-react'
import { WonDealModal, type WonInsuranceData } from './won-deal-modal'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { usePipelineStore } from '@/store'
import { api } from '@/lib/api'
import { cn, formatCurrency } from '@/lib/utils'
import type { Deal, PipelineStage } from '@priority-crm/shared'
import { DealStatus } from '@priority-crm/shared'

type ProfileType = 'A' | 'B' | 'C' | 'D'

const PROFILES: Record<ProfileType, { label: string; emoji: string; className: string }> = {
  A: { label: 'Deportista con seguro',   emoji: '🏃🛡️', className: 'bg-green-100 text-green-700 border-green-200' },
  B: { label: 'Deportista sin seguro',   emoji: '🏃🔍', className: 'bg-orange-100 text-orange-700 border-orange-200' },
  C: { label: 'Sin deporte con seguro',  emoji: '🛋️🛡️', className: 'bg-blue-100 text-blue-700 border-blue-200' },
  D: { label: 'Sin deporte sin seguro',  emoji: '🛋️🔍', className: 'bg-violet-100 text-violet-700 border-violet-200' },
}

function getProfile(customFields?: Record<string, unknown> | null) {
  const pt = customFields?.profileType as ProfileType | undefined
  return pt ? (PROFILES[pt] ?? null) : null
}

interface KanbanBoardProps {
  viewMode: 'mine' | 'all'
  filterUserId: string | null
  currentUserId: string
  userRole: string
  onSelectDeal: (id: string) => void
}

const WON_STAGE_ID = 'cmohtra9r000bz5t3q407kx05'

function getInitials(name: string) {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export function KanbanBoard({ viewMode, filterUserId, currentUserId, userRole, onSelectDeal }: KanbanBoardProps) {
  const { stages, deals, setStages, setDeals, searchQuery, moveDeal } = usePipelineStore()
  const [mobileStageIndex, setMobileStageIndex] = useState(0)
  const [pendingMove, setPendingMove] = useState<{ dealId: string; stageId: string; position: number } | null>(null)
  const [showWonModal, setShowWonModal] = useState(false)
  const queryClient = useQueryClient()

  const moveDealMutation = useMutation({
    mutationFn: ({ dealId, stageId, position, insuranceData }: {
      dealId: string; stageId: string; position: number; insuranceData?: WonInsuranceData[]
    }) => api.put(`/pipeline/deals/${dealId}/move`, { stageId, position, insuranceData }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipeline'] })
      setShowWonModal(false)
      setPendingMove(null)
    },
    onError: () => {
      queryClient.invalidateQueries({ queryKey: ['pipeline'] })
      setShowWonModal(false)
      setPendingMove(null)
    },
  })

  function handleMove(dealId: string, stageId: string, position: number) {
    const deal = deals.find((d) => d.id === dealId)
    if (!deal || (deal as any).customFields?.locked) return

    if (stageId === WON_STAGE_ID) {
      setPendingMove({ dealId, stageId, position })
      setShowWonModal(true)
      return
    }

    moveDeal(dealId, stageId, position)
    moveDealMutation.mutate({ dealId, stageId, position })
  }

  function handleWonConfirm(entries: WonInsuranceData[]) {
    if (!pendingMove) return
    const { dealId, stageId, position } = pendingMove
    moveDeal(dealId, stageId, position)
    moveDealMutation.mutate({ dealId, stageId, position, insuranceData: entries })
  }

  const { data: stagesData } = useQuery({
    queryKey: ['pipeline', 'stages'],
    queryFn: () => api.get('/pipeline/stages').then((r) => r.data),
  })

  const { data: dealsData } = useQuery({
    queryKey: ['pipeline', 'deals'],
    queryFn: () => api.get('/pipeline/deals').then((r) => r.data),
  })

  useEffect(() => {
    if (stagesData) setStages(stagesData)
  }, [stagesData, setStages])

  useEffect(() => {
    if (dealsData) setDeals(dealsData)
  }, [dealsData, setDeals])

  const searchFiltered = searchQuery
    ? deals.filter((d) => d.title.toLowerCase().includes(searchQuery.toLowerCase()))
    : deals

  function getStageDeals(stageId: string) {
    let result = searchFiltered.filter(
      (d) => d.stageId === stageId && d.status !== DealStatus.LOST,
    )
    if (filterUserId) {
      result = result.filter((d) => d.assignedToId === filterUserId)
    } else if (viewMode === 'mine') {
      result = result.filter((d) => d.assignedToId === currentUserId)
    }
    return result.sort((a, b) => a.position - b.position)
  }

  function getStageValue(stageId: string) {
    return getStageDeals(stageId).reduce((sum, d) => sum + (d.value ?? 0), 0)
  }

  if (!stages.length) {
    return (
      <div className="flex flex-1 items-center justify-center text-[#25324b]/50">
        No hay etapas configuradas en el pipeline.
      </div>
    )
  }

  const sortedStages = [...stages].sort((a, b) => a.position - b.position)
  const activeMobileStage = sortedStages[Math.min(mobileStageIndex, sortedStages.length - 1)]
  const activeMobileDeals = activeMobileStage ? getStageDeals(activeMobileStage.id) : []
  const allowDrag = userRole === 'SUPER_ADMIN' || (viewMode === 'mine' && userRole !== 'SALES_REP')
  const allowClick = userRole !== 'SALES_REP'

  console.log('[KanbanBoard] userRole:', userRole, '| viewMode:', viewMode, '| allowDrag:', allowDrag, '| allowClick:', allowClick)

  return (
    <div className="flex flex-1 flex-col overflow-hidden">

      {/* ── Mobile: stage selector tabs ──────────────────────────────── */}
      <div className="flex gap-2 overflow-x-auto pb-2 md:hidden">
        {sortedStages.map((stage, i) => {
          const count = getStageDeals(stage.id).length
          const active = mobileStageIndex === i
          return (
            <button
              key={stage.id}
              onClick={() => setMobileStageIndex(i)}
              className={cn(
                'flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-all',
                active ? 'text-white shadow-md' : 'bg-[#f0f2f7] text-[#25324b]/60',
              )}
              style={active ? { backgroundColor: stage.color ?? '#25324b' } : {}}
            >
              <span
                className="h-2 w-2 rounded-full"
                style={{
                  backgroundColor: active ? 'rgba(255,255,255,0.7)' : (stage.color ?? '#25324b'),
                }}
              />
              {stage.name}
              <span
                className={cn(
                  'flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold',
                  active ? 'bg-white/25' : 'bg-white text-[#25324b]',
                )}
              >
                {count}
              </span>
            </button>
          )
        })}
      </div>

      {/* ── Mobile: single-column deal list ──────────────────────────── */}
      <div className="flex flex-col gap-3 overflow-y-auto pb-4 md:hidden">
        {activeMobileDeals.length > 0 ? (
          activeMobileDeals.map((deal) => (
            <DealCard key={deal.id} deal={deal} onSelect={onSelectDeal} stageColor={activeMobileStage?.color} allowDrag={false} />
          ))
        ) : (
          <div className="rounded-xl border-2 border-dashed border-[#25324b]/12 px-4 py-12 text-center text-sm text-[#25324b]/40">
            No hay deals en esta etapa
          </div>
        )}
      </div>

      {/* ── Desktop: horizontal kanban ───────────────────────────────── */}
      <div className="hidden flex-1 gap-4 overflow-x-auto pb-4 kanban-scroll md:flex">
        {sortedStages.map((stage) => (
          <KanbanColumn
            key={stage.id}
            stage={stage}
            deals={getStageDeals(stage.id)}
            totalValue={getStageValue(stage.id)}
            allowDrag={allowDrag}
            allowClick={allowClick}
            onDrop={(dealId) => handleMove(dealId, stage.id, getStageDeals(stage.id).length)}
            onSelectDeal={onSelectDeal}
          />
        ))}
      </div>

      <WonDealModal
        open={showWonModal}
        onConfirm={handleWonConfirm}
        onCancel={() => { setShowWonModal(false); setPendingMove(null) }}
        loading={moveDealMutation.isPending}
      />
    </div>
  )
}

function KanbanColumn({
  stage,
  deals,
  totalValue,
  allowDrag,
  allowClick,
  onDrop,
  onSelectDeal,
}: {
  stage: PipelineStage
  deals: Deal[]
  totalValue: number
  allowDrag: boolean
  allowClick: boolean
  onDrop: (dealId: string) => void
  onSelectDeal: (id: string) => void
}) {
  function handleDragOver(e: React.DragEvent) {
    if (!allowDrag) return
    e.preventDefault()
  }

  function handleDrop(e: React.DragEvent) {
    if (!allowDrag) return
    const dealId = e.dataTransfer.getData('dealId')
    if (dealId) onDrop(dealId)
  }

  return (
    <div
      className="flex w-[288px] shrink-0 flex-col rounded-xl bg-[#f0f2f7] shadow-sm"
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Column header — navy background */}
      <div
        className="flex items-center justify-between rounded-t-xl px-4 py-3"
        style={{ backgroundColor: '#25324b' }}
      >
        <div className="flex items-center gap-2.5">
          <span
            className="h-2.5 w-2.5 rounded-full ring-2 ring-white/20"
            style={{ backgroundColor: stage.color ?? '#d3ac76' }}
          />
          <span className="text-sm font-semibold text-white">{stage.name}</span>
          <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-white/15 px-1.5 text-[11px] font-bold text-white">
            {deals.length}
          </span>
        </div>
        <span className="text-xs font-medium text-[#d3ac76]">{formatCurrency(totalValue)}</span>
      </div>

      <ScrollArea className="flex-1 p-2">
        <div className="space-y-2.5 py-0.5">
          {deals.map((deal) => (
            <DealCard key={deal.id} deal={deal} onSelect={onSelectDeal} stageColor={stage.color} allowDrag={allowDrag} allowClick={allowClick} />
          ))}
          {deals.length === 0 && (
            <div className="rounded-lg border-2 border-dashed border-[#25324b]/12 px-3 py-8 text-center text-xs text-[#25324b]/35">
              Sin deals
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}

function DealCard({
  deal,
  onSelect,
  stageColor,
  allowDrag = true,
  allowClick = true,
}: {
  deal: Deal
  onSelect: (id: string) => void
  stageColor?: string | null
  allowDrag?: boolean
  allowClick?: boolean
}) {
  const isLocked = !!(deal as any).customFields?.locked
  const canDrag = allowDrag && !isLocked

  function handleDragStart(e: React.DragEvent) {
    e.dataTransfer.setData('dealId', deal.id)
  }

  const borderColor = stageColor ?? '#25324b'

  return (
    <div
      draggable={canDrag}
      onDragStart={canDrag ? handleDragStart : undefined}
      onClick={allowClick ? () => onSelect(deal.id) : undefined}
      className={cn(
        'rounded-lg bg-white shadow-sm transition-all duration-150',
        allowClick
          ? 'cursor-pointer hover:shadow-md hover:-translate-y-px active:opacity-75'
          : 'cursor-default select-none opacity-80',
      )}
      style={{ borderLeft: `4px solid ${borderColor}`, touchAction: 'manipulation' }}
    >
      {/* Card body */}
      <div className="px-3.5 pb-3 pt-3">
        {/* Title + grip */}
        <div className="flex items-start justify-between gap-2 pb-1.5">
          <span className="text-[13.5px] font-semibold leading-snug text-[#25324b]">
            {deal.title}
          </span>
          {allowDrag && <GripVertical className="mt-0.5 h-4 w-4 shrink-0 text-[#25324b]/25" />}
        </div>

        {/* Contact */}
        {deal.contact && (
          <p className="mb-2.5 text-xs leading-tight text-[#25324b]/55">
            {deal.contact.firstName} {deal.contact.lastName ?? ''}
            {deal.contact.company ? ` · ${deal.contact.company}` : ''}
          </p>
        )}

        {/* Value + probability */}
        <div className="flex items-center justify-between">
          {deal.value ? (
            <span className="flex items-center gap-1 text-xs font-bold text-[#d3ac76]">
              <DollarSign className="h-3.5 w-3.5" />
              {formatCurrency(deal.value)}
            </span>
          ) : (
            <span />
          )}
          {deal.probability != null && (
            <span
              className={cn(
                'rounded-full px-2 py-0.5 text-[11px] font-semibold',
                deal.probability >= 70
                  ? 'bg-emerald-50 text-emerald-700'
                  : deal.probability >= 40
                    ? 'bg-amber-50 text-amber-700'
                    : 'bg-red-50 text-red-600',
              )}
            >
              {deal.probability}%
            </span>
          )}
        </div>

        {/* Lead profile badge */}
        {(() => {
          const profile = getProfile((deal as any).customFields)
          if (!profile) return null
          return (
            <div className={cn('mt-2 flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium', profile.className)}>
              <span>{profile.emoji}</span>
              <span>{profile.label}</span>
            </div>
          )
        })()}

        {/* Locked badge */}
        {isLocked && (
          <div className="mt-2 flex items-center gap-1 rounded-md bg-gray-100 px-2 py-1 text-[11px] font-semibold text-gray-500">
            <Lock className="h-3 w-3" />
            Cerrado
          </div>
        )}

        {/* Follow-up overdue */}
        {(() => {
          const fua = (deal as any).customFields?.followUpAt as string | undefined
          if (!fua) return null
          const isOverdue = new Date(fua) < new Date()
          if (!isOverdue) return null
          return (
            <div className="mt-2 flex items-center gap-1 rounded-md bg-red-50 px-2 py-1 text-[11px] font-semibold text-red-600">
              <Bell className="h-3 w-3" />
              Seguimiento vencido
            </div>
          )
        })()}

        {/* Owner */}
        <div className="mt-2.5 flex items-center gap-1.5 border-t border-[#25324b]/6 pt-2.5">
          {deal.assignedTo ? (
            <>
              <Avatar className="h-5 w-5">
                <AvatarFallback className="bg-[#25324b]/10 text-[9px] font-semibold text-[#25324b]">
                  {getInitials(deal.assignedTo.name)}
                </AvatarFallback>
              </Avatar>
              <span className="truncate text-[11px] font-medium text-[#25324b]/55">
                {deal.assignedTo.name}
              </span>
            </>
          ) : (
            <span className="text-[11px] font-semibold text-red-500">Sin asignar</span>
          )}
        </div>
      </div>
    </div>
  )
}
