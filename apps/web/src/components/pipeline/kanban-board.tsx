'use client'

import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { GripVertical, DollarSign } from 'lucide-react'
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

  return (
    <div className="flex flex-1 gap-4 overflow-x-auto pb-4">
      {stages
        .sort((a, b) => a.position - b.position)
        .map((stage) => (
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
          <span className="font-medium text-sm">{stage.name}</span>
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
      className="cursor-pointer hover:shadow-md transition-shadow active:opacity-80"
    >
      <CardHeader className="p-3 pb-1">
        <div className="flex items-start justify-between gap-2">
          <span className="text-sm font-medium leading-tight">{deal.title}</span>
          <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground" />
        </div>
      </CardHeader>
      <CardContent className="px-3 pb-3">
        {deal.contact && (
          <p className="text-xs text-muted-foreground mb-2">
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
