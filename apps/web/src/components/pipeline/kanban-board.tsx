'use client'

import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { GripVertical, DollarSign, Bell } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { usePipelineStore } from '@/store'
import { api } from '@/lib/api'
import { cn, formatCurrency } from '@/lib/utils'
import type { Deal, PipelineStage } from '@priority-crm/shared'
import { DealStatus } from '@priority-crm/shared'

interface KanbanBoardProps {
  viewMode: 'mine' | 'all'
  filterUserId: string | null
  currentUserId: string
  onSelectDeal: (id: string) => void
}

function getInitials(name: string) {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export function KanbanBoard({ viewMode, filterUserId, currentUserId, onSelectDeal }: KanbanBoardProps) {
  const { stages, deals, setStages, setDeals, searchQuery, moveDeal } = usePipelineStore()
  const [mobileStageIndex, setMobileStageIndex] = useState(0)

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
      (d) => d.stageId === stageId && d.status === DealStatus.OPEN,
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
      <div className="flex flex-1 items-center justify-center text-muted-foreground">
        No hay etapas configuradas en el pipeline.
      </div>
    )
  }

  const sortedStages = [...stages].sort((a, b) => a.position - b.position)
  const activeMobileStage = sortedStages[Math.min(mobileStageIndex, sortedStages.length - 1)]
  const activeMobileDeals = activeMobileStage ? getStageDeals(activeMobileStage.id) : []

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
                active ? 'text-white shadow-sm' : 'bg-muted/60 text-muted-foreground',
              )}
              style={active ? { backgroundColor: stage.color ?? '#6366f1' } : {}}
            >
              <span
                className="h-2 w-2 rounded-full"
                style={{
                  backgroundColor: active ? 'rgba(255,255,255,0.7)' : (stage.color ?? '#6366f1'),
                }}
              />
              {stage.name}
              <span
                className={cn(
                  'flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold',
                  active ? 'bg-white/25' : 'bg-background',
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
            <DealCard key={deal.id} deal={deal} onSelect={onSelectDeal} />
          ))
        ) : (
          <div className="rounded-xl border-2 border-dashed px-4 py-12 text-center text-sm text-muted-foreground">
            No hay deals en esta etapa
          </div>
        )}
      </div>

      {/* ── Desktop: horizontal kanban ───────────────────────────────── */}
      <div className="hidden flex-1 gap-4 overflow-x-auto pb-4 md:flex">
        {sortedStages.map((stage) => (
          <KanbanColumn
            key={stage.id}
            stage={stage}
            deals={getStageDeals(stage.id)}
            totalValue={getStageValue(stage.id)}
            onDrop={(dealId) => moveDeal(dealId, stage.id, getStageDeals(stage.id).length)}
            onSelectDeal={onSelectDeal}
          />
        ))}
      </div>
    </div>
  )
}

function KanbanColumn({
  stage,
  deals,
  totalValue,
  onDrop,
  onSelectDeal,
}: {
  stage: PipelineStage
  deals: Deal[]
  totalValue: number
  onDrop: (dealId: string) => void
  onSelectDeal: (id: string) => void
}) {
  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
  }

  function handleDrop(e: React.DragEvent) {
    const dealId = e.dataTransfer.getData('dealId')
    if (dealId) onDrop(dealId)
  }

  return (
    <div
      className="flex w-72 shrink-0 flex-col rounded-lg border bg-muted/30"
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <div className="flex items-center justify-between border-b px-3 py-2.5">
        <div className="flex items-center gap-2">
          <span
            className="h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: stage.color ?? '#6366f1' }}
          />
          <span className="text-sm font-medium">{stage.name}</span>
          <Badge variant="secondary" className="h-5 text-xs">
            {deals.length}
          </Badge>
        </div>
        <span className="text-xs text-muted-foreground">{formatCurrency(totalValue)}</span>
      </div>

      <ScrollArea className="flex-1 p-2">
        <div className="space-y-2">
          {deals.map((deal) => (
            <DealCard key={deal.id} deal={deal} onSelect={onSelectDeal} />
          ))}
        </div>
      </ScrollArea>
    </div>
  )
}

function DealCard({ deal, onSelect }: { deal: Deal; onSelect: (id: string) => void }) {
  function handleDragStart(e: React.DragEvent) {
    e.dataTransfer.setData('dealId', deal.id)
  }

  return (
    <Card
      draggable
      onDragStart={handleDragStart}
      onClick={() => onSelect(deal.id)}
      className="cursor-pointer transition-shadow active:opacity-80 hover:shadow-md"
    >
      <CardHeader className="p-3 pb-1">
        <div className="flex items-start justify-between gap-2">
          <span className="text-sm font-medium leading-tight">{deal.title}</span>
          <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground" />
        </div>
      </CardHeader>
      <CardContent className="px-3 pb-3">
        {deal.contact && (
          <p className="mb-2 text-xs text-muted-foreground">
            {deal.contact.firstName} {deal.contact.lastName}
            {deal.contact.company ? ` · ${deal.contact.company}` : ''}
          </p>
        )}

        <div className="flex items-center justify-between">
          {deal.value ? (
            <span className="flex items-center gap-1 text-xs font-medium text-primary">
              <DollarSign className="h-3 w-3" />
              {formatCurrency(deal.value)}
            </span>
          ) : (
            <span />
          )}
          {deal.probability != null && (
            <span
              className={cn(
                'text-xs font-medium',
                deal.probability >= 70
                  ? 'text-green-600'
                  : deal.probability >= 40
                    ? 'text-yellow-600'
                    : 'text-red-600',
              )}
            >
              {deal.probability}%
            </span>
          )}
        </div>

        {/* Follow-up overdue indicator */}
        {(() => {
          const fua = (deal as any).customFields?.followUpAt as string | undefined
          if (!fua) return null
          const isOverdue = new Date(fua) < new Date()
          if (!isOverdue) return null
          return (
            <div className="mt-1.5 flex items-center gap-1 rounded bg-red-50 px-1.5 py-0.5 text-[11px] font-semibold text-red-600 dark:bg-red-950/30">
              <Bell className="h-3 w-3" />
              Seguimiento vencido
            </div>
          )
        })()}

        {/* Owner */}
        <div className="mt-2 flex items-center gap-1.5 border-t pt-2">
          {deal.assignedTo ? (
            <>
              <Avatar className="h-5 w-5">
                <AvatarFallback className="bg-primary/10 text-[9px] font-semibold text-primary">
                  {getInitials(deal.assignedTo.name)}
                </AvatarFallback>
              </Avatar>
              <span className="truncate text-xs text-muted-foreground">
                {deal.assignedTo.name}
              </span>
            </>
          ) : (
            <span className="text-xs font-medium text-red-500">Sin asignar</span>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
