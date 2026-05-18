'use client'

import { useMemo } from 'react'
import { useQueries } from '@tanstack/react-query'
import { useSession } from 'next-auth/react'
import {
  TrendingUp,
  DollarSign,
  CheckCircle2,
  LayoutDashboard,
  Phone,
  MessageSquare,
  FileText,
  Activity,
  Clock,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { api } from '@/lib/api'
import { cn, formatCurrency } from '@/lib/utils'
import { DealStatus } from '@priority-crm/shared'
import type { PipelineStage } from '@priority-crm/shared'
import { formatDistanceToNow, startOfWeek, isAfter } from 'date-fns'
import { es } from 'date-fns/locale'

interface ActivityRecord {
  id: string
  type: string
  description: string
  createdAt: string
  user?: { id: string; name: string }
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

const ACTIVITY_ICON: Record<string, React.ReactNode> = {
  CALL:         <Phone className="h-3.5 w-3.5 text-blue-500" />,
  EMAIL:        <MessageSquare className="h-3.5 w-3.5 text-amber-500" />,
  NOTE:         <FileText className="h-3.5 w-3.5 text-gray-500" />,
  STAGE_CHANGE: <Activity className="h-3.5 w-3.5 text-yellow-500" />,
  MEETING:      <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />,
}

const ACTIVITY_LABEL: Record<string, string> = {
  CALL:         'Llamada',
  EMAIL:        'Email',
  NOTE:         'Nota / WhatsApp',
  STAGE_CHANGE: 'Cambio de etapa',
  MEETING:      'Reunión',
}

export function MyPerformancePage() {
  const { data: session } = useSession()
  const userName = session?.user?.name ?? 'tú'

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
    return (Array.isArray(stagesQuery.data) ? stagesQuery.data : []).sort(
      (a, b) => a.position - b.position,
    )
  }, [stagesQuery.data])

  const deals: MyDeal[] = useMemo(
    () => (Array.isArray(dealsQuery.data) ? dealsQuery.data : []),
    [dealsQuery.data],
  )

  const metrics = useMemo(() => {
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const weekStart = startOfWeek(now, { locale: es })

    const open = deals.filter((d) => d.status === DealStatus.OPEN)
    const won = deals.filter((d) => d.status === DealStatus.WON)
    const lost = deals.filter((d) => d.status === DealStatus.LOST)

    const wonThisMonth = won.filter((d) => d.closedAt && new Date(d.closedAt) >= startOfMonth)
    const leadsThisMonth = deals.filter((d) => new Date(d.createdAt) >= startOfMonth)

    const totalPipelineValue = open.reduce((s, d) => s + (d.value ?? 0), 0)
    const closedTotal = won.length + lost.length
    const conversionRate = closedTotal > 0 ? Math.round((won.length / closedTotal) * 100) : 0

    // All activities from all deals, flattened and sorted desc
    const allActivities = deals
      .flatMap((d) =>
        d.activities.map((a) => ({
          ...a,
          dealTitle: d.title,
          contactName: d.contact
            ? [d.contact.firstName, d.contact.lastName].filter(Boolean).join(' ')
            : null,
        })),
      )
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

    const thisWeekActivities = allActivities.filter((a) =>
      isAfter(new Date(a.createdAt), weekStart),
    )

    const callsThisWeek = thisWeekActivities.filter((a) => a.type === 'CALL').length
    const notesThisWeek = thisWeekActivities.filter((a) => a.type === 'NOTE').length
    const whatsappsThisWeek = notesThisWeek // notes include WhatsApp

    const last5Activities = allActivities.slice(0, 5)

    // Deals by stage (open only)
    const dealsByStage = stages.map((s) => ({
      stage: s,
      count: open.filter((d) => d.stageId === s.id).length,
      value: open.filter((d) => d.stageId === s.id).reduce((sum, d) => sum + (d.value ?? 0), 0),
    }))
    const maxCount = Math.max(...dealsByStage.map((d) => d.count), 1)

    return {
      open: open.length,
      wonThisMonth: wonThisMonth.length,
      leadsThisMonth: leadsThisMonth.length,
      totalPipelineValue,
      conversionRate,
      callsThisWeek,
      notesThisWeek,
      whatsappsThisWeek,
      last5Activities,
      dealsByStage,
      maxCount,
    }
  }, [deals, stages])

  const isLoading = stagesQuery.isLoading || dealsQuery.isLoading

  if (isLoading) return <LoadingSkeleton />

  return (
    <div className="flex flex-col gap-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold">Mi Rendimiento</h1>
        <p className="text-sm text-muted-foreground">
          Estadísticas personales de {userName}
        </p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Leads este mes"
          value={String(metrics.leadsThisMonth)}
          icon={<LayoutDashboard className="h-4 w-4 text-primary" />}
          sub="deals creados en el mes"
        />
        <StatCard
          label="Ganados este mes"
          value={String(metrics.wonThisMonth)}
          icon={<CheckCircle2 className="h-4 w-4 text-emerald-600" />}
          sub="deals cerrados como ganados"
          highlight={metrics.wonThisMonth > 0}
        />
        <StatCard
          label="Tasa de conversión"
          value={`${metrics.conversionRate}%`}
          icon={<TrendingUp className="h-4 w-4 text-[#d3ac76]" />}
          sub="ganados / (ganados + perdidos)"
          highlight={metrics.conversionRate >= 50}
        />
        <StatCard
          label="Valor del pipeline"
          value={formatCurrency(metrics.totalPipelineValue)}
          icon={<DollarSign className="h-4 w-4 text-green-600" />}
          sub={`${metrics.open} deals abiertos`}
        />
      </div>

      {/* Activity this week + deals by stage */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Weekly activity */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Actividad de la semana</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-3">
              <ActivityStat
                icon={<Phone className="h-5 w-5 text-blue-500" />}
                label="Llamadas"
                count={metrics.callsThisWeek}
                color="bg-blue-500"
              />
              <ActivityStat
                icon={<MessageSquare className="h-5 w-5 text-green-500" />}
                label="Notas / WhatsApps"
                count={metrics.notesThisWeek}
                color="bg-green-500"
              />
              <ActivityStat
                icon={<Activity className="h-5 w-5 text-[#d3ac76]" />}
                label="Total actividades"
                count={metrics.callsThisWeek + metrics.notesThisWeek}
                color="bg-[#d3ac76]"
              />
            </div>
          </CardContent>
        </Card>

        {/* Deals by stage */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Mis deals por etapa</CardTitle>
          </CardHeader>
          <CardContent>
            {metrics.dealsByStage.every((d) => d.count === 0) ? (
              <p className="text-sm text-muted-foreground">Sin deals abiertos en el pipeline.</p>
            ) : (
              <div className="flex flex-col gap-3">
                {metrics.dealsByStage
                  .filter((d) => d.count > 0)
                  .map(({ stage, count, value }) => (
                    <div key={stage.id} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <span
                            className="h-2.5 w-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: stage.color ?? '#25324b' }}
                          />
                          <span className="font-medium">{stage.name}</span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span>{count} deal{count !== 1 ? 's' : ''}</span>
                          <span className="font-medium text-foreground">{formatCurrency(value)}</span>
                        </div>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${Math.round((count / metrics.maxCount) * 100)}%`,
                            backgroundColor: stage.color ?? '#25324b',
                          }}
                        />
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Last 5 activities */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Últimas actividades</CardTitle>
        </CardHeader>
        <CardContent>
          {metrics.last5Activities.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin actividades registradas aún.</p>
          ) : (
            <div className="flex flex-col divide-y">
              {metrics.last5Activities.map((act) => (
                <div key={act.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
                    {ACTIVITY_ICON[act.type] ?? <FileText className="h-3.5 w-3.5 text-gray-400" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-semibold text-muted-foreground">
                        {ACTIVITY_LABEL[act.type] ?? act.type}
                      </span>
                      {act.contactName && (
                        <span className="text-xs text-muted-foreground">· {act.contactName}</span>
                      )}
                    </div>
                    <p className="mt-0.5 text-sm leading-snug line-clamp-2">{act.description}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {act.dealTitle} ·{' '}
                      {formatDistanceToNow(new Date(act.createdAt), { addSuffix: true, locale: es })}
                    </p>
                  </div>
                  <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function StatCard({
  label,
  value,
  icon,
  sub,
  highlight,
}: {
  label: string
  value: string
  icon: React.ReactNode
  sub: string
  highlight?: boolean
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-muted-foreground leading-tight">{label}</span>
          {icon}
        </div>
        <p className={cn('text-xl font-bold', highlight && 'text-emerald-600')}>{value}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
      </CardContent>
    </Card>
  )
}

function ActivityStat({
  icon,
  label,
  count,
  color,
}: {
  icon: React.ReactNode
  label: string
  count: number
  color: string
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted">
        {icon}
      </div>
      <div className="flex-1">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">{label}</span>
          <span className="text-sm font-bold">{count}</span>
        </div>
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className={cn('h-full rounded-full transition-all duration-500', color)}
            style={{ width: count > 0 ? `${Math.min(count * 20, 100)}%` : '0%' }}
          />
        </div>
      </div>
    </div>
  )
}

function LoadingSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-4 w-56 mt-1" />
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <Skeleton className="h-16 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Skeleton className="h-48 rounded-lg" />
        <Skeleton className="h-48 rounded-lg" />
      </div>
      <Skeleton className="h-64 rounded-lg" />
    </div>
  )
}
