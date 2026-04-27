'use client'

import { useMemo, useState, useEffect } from 'react'
import { useQueries, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSession } from 'next-auth/react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import {
  Flame, Thermometer, Snowflake, DollarSign, TrendingUp,
  CheckCircle2, LayoutDashboard, Clock, CalendarDays, Activity,
  GripVertical,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { api } from '@/lib/api'
import { cn, formatCurrency } from '@/lib/utils'
import { DealStatus } from '@priority-crm/shared'
import type { PipelineStage } from '@priority-crm/shared'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ActivityRecord {
  id: string
  type: string
  description: string
  createdAt: string
}

interface MyDeal {
  id: string
  title: string
  value: number | null
  probability: number | null
  status: DealStatus
  stageId: string
  position: number
  closedAt: string | null
  createdAt: string
  updatedAt: string
  stage: PipelineStage
  contact: { id: string; firstName: string; lastName: string | null; company: string | null } | null
  activities: ActivityRecord[]
}

type Heat = 'hot' | 'warm' | 'cold'

// ─── Heat helpers ─────────────────────────────────────────────────────────────

function daysSince(dateStr: string): number {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86_400_000)
}

function calcHeat(deal: MyDeal): Heat {
  const lastActivity = deal.activities[0]
  const days = lastActivity ? daysSince(lastActivity.createdAt) : 999
  const prob = deal.probability ?? 0
  if (days <= 7 || prob >= 70) return 'hot'
  if (days <= 14 || prob >= 40) return 'warm'
  return 'cold'
}

const HEAT_META: Record<Heat, { label: string; icon: React.ElementType; className: string }> = {
  hot:  { label: 'Caliente', icon: Flame,      className: 'text-red-600 bg-red-50 border-red-200 dark:bg-red-950/30' },
  warm: { label: 'Tibio',    icon: Thermometer, className: 'text-amber-600 bg-amber-50 border-amber-200 dark:bg-amber-950/30' },
  cold: { label: 'Frío',     icon: Snowflake,   className: 'text-sky-600 bg-sky-50 border-sky-200 dark:bg-sky-950/30' },
}

// ─── Main component ───────────────────────────────────────────────────────────

export function MyPipelineBoard() {
  const { data: session } = useSession()
  const userName = session?.user?.name ?? 'tú'
  const queryClient = useQueryClient()

  const [stagesQuery, dealsQuery] = useQueries({
    queries: [
      {
        queryKey: ['pipeline', 'stages'],
        queryFn: () => api.get('/pipeline/stages').then((r) => r.data as PipelineStage[]),
      },
      {
        queryKey: ['pipeline', 'my-deals'],
        queryFn: () => api.get('/pipeline/my-deals').then((r) => r.data as MyDeal[]),
      },
    ],
  })

  const stages: PipelineStage[] = useMemo(() => {
    if (!stagesQuery.data) return []
    return (Array.isArray(stagesQuery.data) ? stagesQuery.data : [])
      .map(({ id, name, color, position, probability, organizationId }) => ({
        id, name, color, position, probability, organizationId,
      }))
      .sort((a, b) => a.position - b.position)
  }, [stagesQuery.data])

  // Local deals for optimistic updates
  const [localDeals, setLocalDeals] = useState<MyDeal[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)

  useEffect(() => {
    if (dealsQuery.data) {
      setLocalDeals(Array.isArray(dealsQuery.data) ? dealsQuery.data : [])
    }
  }, [dealsQuery.data])

  // ── Metrics ───────────────────────────────────────────────────────────────
  const metrics = useMemo(() => {
    const open  = localDeals.filter((d) => d.status === DealStatus.OPEN)
    const won   = localDeals.filter((d) => d.status === DealStatus.WON)
    const lost  = localDeals.filter((d) => d.status === DealStatus.LOST)
    const now   = new Date()
    const wonThisMonth = won.filter((d) => {
      if (!d.closedAt) return false
      const c = new Date(d.closedAt)
      return c.getFullYear() === now.getFullYear() && c.getMonth() === now.getMonth()
    })
    const totalValue     = open.reduce((s, d) => s + (d.value ?? 0), 0)
    const closedTotal    = won.length + lost.length
    const conversionRate = closedTotal > 0 ? Math.round((won.length / closedTotal) * 100) : 0
    return { open, totalValue, wonThisMonth, conversionRate, wonTotal: won.length }
  }, [localDeals])

  function getStageDeals(stageId: string) {
    return metrics.open
      .filter((d) => d.stageId === stageId)
      .sort((a, b) => a.position - b.position)
  }

  // ── Move mutation ─────────────────────────────────────────────────────────
  const moveMutation = useMutation({
    mutationFn: ({ dealId, stageId, position }: { dealId: string; stageId: string; position: number }) => {
      console.log('[DnD] calling PUT /pipeline/deals/:id/move', { dealId, stageId, position })
      return api.put(`/pipeline/deals/${dealId}/move`, { stageId, position })
    },
    onSuccess: () => {
      console.log('[DnD] move succeeded — refreshing my-deals')
      queryClient.invalidateQueries({ queryKey: ['pipeline', 'my-deals'] })
    },
    onError: (error: unknown) => {
      console.error('[DnD] move failed — reverting optimistic update', error)
      queryClient.invalidateQueries({ queryKey: ['pipeline', 'my-deals'] })
    },
  })

  // ── DnD sensors ──────────────────────────────────────────────────────────
  // PointerSensor with a small distance so accidental clicks don't start drags.
  // KeyboardSensor for a11y.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
  )

  function handleDragStart(event: DragStartEvent) {
    const id = event.active.id as string
    console.log('[DnD] dragStart:', id)
    setActiveId(id)
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    console.log('[DnD] dragEnd — active:', active.id, '| over:', over?.id ?? 'null (no target)')
    setActiveId(null)

    if (!over) {
      console.warn('[DnD] dropped outside any column — no-op')
      return
    }

    const dealId  = active.id as string
    const stageId = over.id  as string

    const deal = localDeals.find((d) => d.id === dealId)
    if (!deal) {
      console.error('[DnD] could not find deal in localDeals for id:', dealId)
      return
    }
    if (deal.stageId === stageId) {
      console.log('[DnD] same stage — no-op')
      return
    }

    // Optimistic: move deal into new stage locally
    const targetDeals = localDeals.filter(
      (d) => d.stageId === stageId && d.status === DealStatus.OPEN,
    )
    const position =
      targetDeals.length > 0
        ? Math.max(...targetDeals.map((d) => d.position)) + 1000
        : 1000

    console.log('[DnD] moving deal optimistically', { dealId, from: deal.stageId, to: stageId, position })
    setLocalDeals((prev) =>
      prev.map((d) => (d.id === dealId ? { ...d, stageId, position } : d)),
    )

    moveMutation.mutate({ dealId, stageId, position })
  }

  const activeDeal = activeId ? (localDeals.find((d) => d.id === activeId) ?? null) : null

  if (stagesQuery.isLoading || dealsQuery.isLoading) return <LoadingSkeleton />

  return (
    <div className="flex flex-col gap-6 h-full">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Mi Pipeline</h1>
        <p className="text-sm text-muted-foreground">Solo tus deals asignados, {userName}</p>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MetricCard
          label="Deals abiertos"
          value={String(metrics.open.length)}
          icon={<LayoutDashboard className="h-4 w-4 text-primary" />}
          sub="en tu pipeline"
        />
        <MetricCard
          label="Valor total"
          value={formatCurrency(metrics.totalValue)}
          icon={<DollarSign className="h-4 w-4 text-green-600" />}
          sub="suma de deals abiertos"
        />
        <MetricCard
          label="Ganados este mes"
          value={String(metrics.wonThisMonth.length)}
          icon={<CheckCircle2 className="h-4 w-4 text-emerald-600" />}
          sub={`de ${metrics.wonTotal} ganados en total`}
        />
        <MetricCard
          label="Tasa de conversión"
          value={`${metrics.conversionRate}%`}
          icon={<TrendingUp className="h-4 w-4 text-violet-600" />}
          sub="ganados / (ganados + perdidos)"
          highlight={metrics.conversionRate >= 50}
        />
      </div>

      {/* Kanban */}
      {stages.length === 0 ? (
        <div className="flex flex-1 items-center justify-center text-muted-foreground">
          No hay etapas configuradas.
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="flex flex-1 gap-4 overflow-x-auto pb-4">
            {stages.map((stage) => {
              const deals = getStageDeals(stage.id)
              return (
                <KanbanColumn
                  key={stage.id}
                  stage={stage}
                  deals={deals}
                  totalValue={deals.reduce((s, d) => s + (d.value ?? 0), 0)}
                  isDragging={activeId !== null}
                />
              )
            })}
          </div>

          <DragOverlay>
            {activeDeal ? <DealCardDisplay deal={activeDeal} isOverlay /> : null}
          </DragOverlay>
        </DndContext>
      )}
    </div>
  )
}

// ─── Kanban column ─────────────────────────────────────────────────────────────
// The entire column body is the droppable target so you can drop anywhere in it,
// even if the column is empty.

function KanbanColumn({
  stage,
  deals,
  totalValue,
  isDragging,
}: {
  stage: PipelineStage
  deals: MyDeal[]
  totalValue: number
  isDragging: boolean
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id })

  return (
    <div className="flex w-72 shrink-0 flex-col rounded-lg border">
      {/* Column header */}
      <div className="flex items-center justify-between border-b px-3 py-2.5 bg-muted/30 rounded-t-lg">
        <div className="flex items-center gap-2">
          <span
            className="h-2.5 w-2.5 rounded-full shrink-0"
            style={{ backgroundColor: stage.color ?? '#6366f1' }}
          />
          <span className="font-medium text-sm">{stage.name}</span>
          <Badge variant="secondary" className="h-5 text-xs">{deals.length}</Badge>
        </div>
        <span className="text-xs text-muted-foreground">{formatCurrency(totalValue)}</span>
      </div>

      {/* Droppable body — setNodeRef goes here, not on an inner div */}
      <div
        ref={setNodeRef}
        className={cn(
          'flex-1 p-2 min-h-[200px] rounded-b-lg transition-colors overflow-y-auto',
          isOver
            ? 'bg-primary/8 ring-1 ring-inset ring-primary/40'
            : 'bg-muted/20',
        )}
      >
        {deals.length === 0 ? (
          <div
            className={cn(
              'h-full min-h-[160px] rounded-md border-2 border-dashed flex items-center justify-center transition-colors',
              isOver ? 'border-primary/60 bg-primary/5' : 'border-muted-foreground/20',
            )}
          >
            <span className="text-xs text-muted-foreground">
              {isDragging ? 'Suelta aquí' : 'Sin deals'}
            </span>
          </div>
        ) : (
          <div className="space-y-2">
            {deals.map((deal) => (
              <DraggableDealCard key={deal.id} deal={deal} />
            ))}
            {/* Extra drop target at the bottom so you can drop after the last card */}
            {isDragging && (
              <div className="h-2 rounded" />
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Draggable deal card ───────────────────────────────────────────────────────
// setNodeRef, listeners, AND attributes are all on the same element so dnd-kit
// can reliably detect pointer events and apply the transform.

function DraggableDealCard({ deal }: { deal: MyDeal }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: deal.id,
  })

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={{
        transform: transform
          ? `translate3d(${transform.x}px, ${transform.y}px, 0)`
          : undefined,
        opacity: isDragging ? 0.3 : 1,
        // Required for pointer events to reach dnd-kit on touch devices
        touchAction: 'none',
        // Prevent text selection while dragging
        userSelect: 'none',
        cursor: isDragging ? 'grabbing' : 'grab',
        // Keep the placeholder in the original position during drag
        zIndex: isDragging ? 0 : undefined,
      }}
    >
      <DealCardDisplay deal={deal} />
    </div>
  )
}

// ─── Deal card display ─────────────────────────────────────────────────────────
// Pure display component — no drag logic here.

function DealCardDisplay({
  deal,
  isOverlay,
}: {
  deal: MyDeal
  isOverlay?: boolean
}) {
  const heat = calcHeat(deal)
  const { label: heatLabel, icon: HeatIcon, className: heatClass } = HEAT_META[heat]
  const lastActivity = deal.activities[0]
  const daysIdle = lastActivity ? daysSince(lastActivity.createdAt) : null
  const clientName = deal.contact
    ? [deal.contact.firstName, deal.contact.lastName].filter(Boolean).join(' ')
    : null

  return (
    <Card
      className={cn(
        'transition-shadow select-none',
        isOverlay
          ? 'shadow-2xl rotate-2 cursor-grabbing'
          : 'hover:shadow-md cursor-grab',
      )}
    >
      <CardHeader className="p-3 pb-1">
        <div className="flex items-start gap-2">
          <GripVertical className="h-4 w-4 shrink-0 mt-0.5 text-muted-foreground/50" />
          <span className="flex-1 text-sm font-medium leading-tight">{deal.title}</span>
          <span
            className={cn(
              'flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-xs font-medium shrink-0',
              heatClass,
            )}
          >
            <HeatIcon className="h-3 w-3" />
            {heatLabel}
          </span>
        </div>
      </CardHeader>

      <CardContent className="px-3 pb-3 space-y-2">
        {clientName && (
          <p className="text-xs text-muted-foreground">
            {clientName}
            {deal.contact?.company ? ` · ${deal.contact.company}` : ''}
          </p>
        )}

        <div className="flex items-center justify-between">
          {deal.value ? (
            <span className="flex items-center gap-1 text-xs font-semibold text-primary">
              <DollarSign className="h-3 w-3" />
              {formatCurrency(deal.value)}
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">Sin valor</span>
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

        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Clock className="h-3 w-3 shrink-0" />
          {daysIdle === null ? (
            <span>Sin actividad registrada</span>
          ) : daysIdle === 0 ? (
            <span>Actividad hoy</span>
          ) : (
            <span className={cn(daysIdle > 14 && 'text-red-500 font-medium')}>
              {daysIdle}d sin actividad
            </span>
          )}
        </div>

        {lastActivity ? (
          <div className="flex items-start gap-1 text-xs text-muted-foreground">
            <Activity className="h-3 w-3 shrink-0 mt-0.5" />
            <span className="line-clamp-2">{lastActivity.description}</span>
          </div>
        ) : (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <CalendarDays className="h-3 w-3 shrink-0" />
            <span>Programa una actividad</span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ─── Metric card ───────────────────────────────────────────────────────────────

function MetricCard({
  label, value, icon, sub, highlight,
}: {
  label: string; value: string; icon: React.ReactNode; sub: string; highlight?: boolean
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-muted-foreground">{label}</span>
          {icon}
        </div>
        <p className={cn('text-xl font-bold', highlight && 'text-emerald-600')}>{value}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
      </CardContent>
    </Card>
  )
}

// ─── Loading skeleton ──────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-4 w-56 mt-1" />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <Skeleton className="h-16 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="flex gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-64 w-72 shrink-0 rounded-lg" />
        ))}
      </div>
    </div>
  )
}
