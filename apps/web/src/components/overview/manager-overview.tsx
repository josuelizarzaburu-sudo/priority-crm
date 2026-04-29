'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useQueries, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  Filter,
  RefreshCw,
  Clock,
  TrendingUp,
  Target,
  DollarSign,
} from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { api } from '@/lib/api'
import { cn, formatCurrency, getInitials } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Agent {
  id: string
  name: string
  email: string
  role: string
}

interface Stage {
  id: string
  name: string
  color: string
  position: number
}

interface Deal {
  id: string
  title: string
  value: number | null
  status: string
  stageId: string
  assignedToId: string | null
  createdAt: string
  updatedAt: string
  closedAt: string | null
  customFields: Record<string, unknown> | null
  stage: Stage
  contact: { id: string; firstName: string; lastName?: string } | null
  assignedTo: { id: string; name: string } | null
  activities: Array<{ createdAt: string }>
}

interface AgentStats {
  agent: Agent
  leadsWithoutAction: number
  dealsInProgress: number
  wonThisMonth: number
  conversionRate: number
  pipelineValue: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isThisMonth(dateStr: string) {
  const d = new Date(dateStr)
  const now = new Date()
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
}

function isThisWeek(dateStr: string) {
  const d = new Date(dateStr)
  const now = new Date()
  const weekStart = new Date(now)
  weekStart.setDate(now.getDate() - now.getDay())
  weekStart.setHours(0, 0, 0, 0)
  return d >= weekStart
}

function isToday(dateStr: string) {
  return new Date(dateStr).toDateString() === new Date().toDateString()
}

function daysSinceActivity(deal: Deal): number {
  const ref = deal.activities[0]?.createdAt ?? deal.updatedAt ?? deal.createdAt
  return Math.floor((Date.now() - new Date(ref).getTime()) / (1000 * 60 * 60 * 24))
}

function getLeadStatus(deal: Deal): string {
  return (deal.customFields?.leadStatus as string) || 'SIN_GESTION'
}

function buildAgentStats(agent: Agent, allDeals: Deal[]): AgentStats {
  const agentDeals = allDeals.filter((d) => d.assignedToId === agent.id)
  const openDeals = agentDeals.filter((d) => d.status === 'OPEN')
  const wonDeals = agentDeals.filter((d) => d.status === 'WON')
  const lostDeals = agentDeals.filter((d) => d.status === 'LOST')
  const wonThisMonth = wonDeals.filter((d) => d.closedAt && isThisMonth(d.closedAt)).length
  const leadsWithoutAction = openDeals.filter((d) => getLeadStatus(d) === 'SIN_GESTION').length
  const pipelineValue = openDeals.reduce((s, d) => s + (d.value ?? 0), 0)
  const closed = wonDeals.length + lostDeals.length
  const conversionRate = closed > 0 ? Math.round((wonDeals.length / closed) * 100) : 0

  return { agent, leadsWithoutAction, dealsInProgress: openDeals.length, wonThisMonth, conversionRate, pipelineValue }
}

// ─── Lead status badge ────────────────────────────────────────────────────────

const LEAD_STATUS_LABEL: Record<string, string> = {
  SIN_GESTION: 'Sin gestión',
  CONTACTADO: 'Contactado',
  EN_PROCESO: 'En proceso',
  CALIFICADO: 'Calificado',
  NO_CALIFICADO: 'No calificado',
  PERDIDO: 'Perdido',
}

function LeadStatusBadge({ deal }: { deal: Deal }) {
  const ls = getLeadStatus(deal)
  if (ls === 'SIN_GESTION') {
    return <Badge variant="destructive" className="text-xs font-semibold">Sin gestión</Badge>
  }
  return (
    <Badge variant="outline" className="text-xs">{LEAD_STATUS_LABEL[ls] ?? ls}</Badge>
  )
}

// ─── Days since activity cell ─────────────────────────────────────────────────

function DaysCell({ deal }: { deal: Deal }) {
  const days = daysSinceActivity(deal)
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 text-xs',
        days >= 7 ? 'font-semibold text-red-600' : days >= 3 ? 'font-medium text-yellow-600' : 'text-muted-foreground',
      )}
    >
      {days >= 7 && <Clock className="h-3 w-3" />}
      {days === 0 ? 'Hoy' : `${days}d`}
    </span>
  )
}

// ─── Metric helpers ───────────────────────────────────────────────────────────

function Metric({ label, value, urgent, icon }: { label: string; value: string; urgent?: boolean; icon?: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="flex items-center gap-1">
        {icon}
        <p className={cn('text-sm font-semibold', urgent && 'text-red-600')}>{value}</p>
      </div>
    </div>
  )
}

function BigMetric({ icon, label, value, iconClass, valueClass }: {
  icon: React.ReactNode; label: string; value: string; iconClass?: string; valueClass?: string
}) {
  return (
    <div className="flex items-center gap-2.5">
      <div className={cn('shrink-0', iconClass)}>{icon}</div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={cn('text-base font-bold tabular-nums', valueClass)}>{value}</p>
      </div>
    </div>
  )
}

// ─── Agent compact card (grid in "Todos") ─────────────────────────────────────

function AgentCard({ stats }: { stats: AgentStats }) {
  const { agent, leadsWithoutAction, dealsInProgress, wonThisMonth, conversionRate, pipelineValue } = stats
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <Avatar className="h-9 w-9 shrink-0">
            <AvatarFallback className="text-sm">{getInitials(agent.name)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <CardTitle className="truncate text-sm">{agent.name}</CardTitle>
            <p className="text-xs text-muted-foreground">
              {agent.role === 'MEMBER' ? 'Agente' : agent.role === 'MANAGER' ? 'Manager' : 'Admin'}
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
          <Metric label="Sin gestión" value={String(leadsWithoutAction)} urgent={leadsWithoutAction > 0} />
          <Metric label="En proceso" value={String(dealsInProgress)} />
          <Metric label="Ganados/mes" value={String(wonThisMonth)}
            icon={wonThisMonth > 0 ? <CheckCircle2 className="h-3 w-3 text-green-500" /> : undefined}
          />
          <Metric label="Conversión" value={`${conversionRate}%`} />
          <div className="col-span-2 border-t pt-2">
            <Metric label="Pipeline total" value={pipelineValue > 0 ? formatCurrency(pipelineValue) : '—'} />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Agent detail panel (single vendor tab) ───────────────────────────────────

function AgentDetailPanel({ stats }: { stats: AgentStats }) {
  const { agent, leadsWithoutAction, dealsInProgress, wonThisMonth, conversionRate, pipelineValue } = stats
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex flex-wrap items-center gap-6">
          <div className="flex items-center gap-3">
            <Avatar className="h-12 w-12">
              <AvatarFallback className="text-base font-semibold">{getInitials(agent.name)}</AvatarFallback>
            </Avatar>
            <div>
              <p className="font-semibold">{agent.name}</p>
              <p className="text-xs text-muted-foreground">{agent.email}</p>
            </div>
          </div>

          <Separator orientation="vertical" className="hidden h-12 md:block" />

          <div className="flex flex-wrap gap-6">
            <BigMetric
              icon={<AlertCircle className="h-4 w-4" />}
              label="Sin gestión"
              value={String(leadsWithoutAction)}
              iconClass={leadsWithoutAction > 0 ? 'text-red-500' : 'text-muted-foreground'}
              valueClass={leadsWithoutAction > 0 ? 'text-red-600' : undefined}
            />
            <BigMetric icon={<Target className="h-4 w-4 text-blue-500" />} label="En proceso" value={String(dealsInProgress)} />
            <BigMetric icon={<CheckCircle2 className="h-4 w-4 text-green-500" />} label="Ganados este mes" value={String(wonThisMonth)} />
            <BigMetric icon={<TrendingUp className="h-4 w-4 text-purple-500" />} label="Tasa de conversión" value={`${conversionRate}%`} />
            <BigMetric
              icon={<DollarSign className="h-4 w-4 text-emerald-500" />}
              label="Pipeline total"
              value={pipelineValue > 0 ? formatCurrency(pipelineValue) : '—'}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ManagerOverview() {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const [selectedVendor, setSelectedVendor] = useState('all')
  const [stageFilter, setStageFilter] = useState('all')
  const [dateFilter, setDateFilter] = useState('all')

  const results = useQueries({
    queries: [
      { queryKey: ['pipeline', 'deals-all'], queryFn: () => api.get('/pipeline/deals').then((r) => r.data as Deal[]) },
      { queryKey: ['users'], queryFn: () => api.get('/users').then((r) => r.data as Agent[]) },
      { queryKey: ['pipeline', 'stages'], queryFn: () => api.get('/pipeline/stages').then((r) => r.data as Stage[]) },
    ],
  })

  const deals: Deal[] = results[0].data ?? []
  const agents: Agent[] = results[1].data ?? []
  const stages: Stage[] = results[2].data ?? []
  const isLoading = results.some((r) => r.isLoading)

  const memberAgents = agents.filter((a) => a.role === 'MEMBER')
  const allAgentStats = useMemo(() => memberAgents.map((a) => buildAgentStats(a, deals)), [memberAgents, deals])
  const unassigned = useMemo(() => deals.filter((d) => !d.assignedToId && d.status === 'OPEN'), [deals])
  const totalPipeline = deals.filter((d) => d.status === 'OPEN').reduce((s, d) => s + (d.value ?? 0), 0)

  const assignMutation = useMutation({
    mutationFn: ({ dealId, agentId }: { dealId: string; agentId: string }) =>
      api.put(`/pipeline/deals/${dealId}/assign`, { agentId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipeline'] })
      toast({ title: 'Vendedor actualizado' })
    },
    onError: () => toast({ title: 'Error al reasignar', variant: 'destructive' }),
  })

  const filteredDeals = useMemo(() => {
    return deals.filter((d) => {
      if (d.status !== 'OPEN') return false
      if (selectedVendor !== 'all' && d.assignedToId !== selectedVendor) return false
      if (stageFilter !== 'all' && d.stageId !== stageFilter) return false
      if (dateFilter === 'today' && !isToday(d.createdAt)) return false
      if (dateFilter === 'week' && !isThisWeek(d.createdAt)) return false
      if (dateFilter === 'month' && !isThisMonth(d.createdAt)) return false
      return true
    })
  }, [deals, selectedVendor, stageFilter, dateFilter])

  const sinGestionCount = filteredDeals.filter((d) => getLeadStatus(d) === 'SIN_GESTION').length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Overview del equipo</h1>
          <p className="text-sm text-muted-foreground">
            Pipeline total:{' '}
            <span className="font-medium text-foreground">{formatCurrency(totalPipeline)}</span>
            {' · '}
            {deals.filter((d) => d.status === 'OPEN').length} deals activos
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => queryClient.invalidateQueries({ queryKey: ['pipeline'] })} disabled={isLoading}>
          <RefreshCw className={cn('mr-2 h-4 w-4', isLoading && 'animate-spin')} />
          Actualizar
        </Button>
      </div>

      {/* Vendor tabs + metrics */}
      <Tabs value={selectedVendor} onValueChange={(v) => { setSelectedVendor(v) }}>
        <TabsList className="h-auto flex-wrap gap-1">
          <TabsTrigger value="all">Todos</TabsTrigger>
          {memberAgents.map((agent) => {
            const sinGestion = allAgentStats.find((s) => s.agent.id === agent.id)?.leadsWithoutAction ?? 0
            return (
              <TabsTrigger key={agent.id} value={agent.id} className="gap-1.5">
                {agent.name.split(' ')[0]}
                {sinGestion > 0 && (
                  <span className="flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                    {sinGestion}
                  </span>
                )}
              </TabsTrigger>
            )
          })}
        </TabsList>

        {/* "Todos" — agent grid */}
        <TabsContent value="all" className="mt-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {unassigned.length > 0 && (
              <Link href="/overview/unassigned" className="group block">
                <Card className="border-amber-200 bg-amber-50/50 transition-shadow group-hover:shadow-md dark:bg-amber-950/20">
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-2">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-100">
                        <AlertCircle className="h-4 w-4 text-amber-600" />
                      </div>
                      <div>
                        <CardTitle className="text-sm transition-colors group-hover:text-amber-600">Sin asignar</CardTitle>
                        <p className="text-xs text-muted-foreground">Click para gestionar</p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
                      <Metric label="Sin gestión" value={String(unassigned.length)} urgent />
                      <Metric label="En proceso" value="—" />
                      <Metric label="Ganados/mes" value="—" />
                      <Metric label="Conversión" value="—" />
                      <div className="col-span-2 border-t pt-2">
                        <Metric label="Pipeline total" value="—" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            )}
            {allAgentStats.map((stats) => (
              <AgentCard key={stats.agent.id} stats={stats} />
            ))}
          </div>
        </TabsContent>

        {/* Per-agent — detail panel */}
        {memberAgents.map((agent) => {
          const stats = allAgentStats.find((s) => s.agent.id === agent.id)
          if (!stats) return null
          return (
            <TabsContent key={agent.id} value={agent.id} className="mt-4">
              <AgentDetailPanel stats={stats} />
            </TabsContent>
          )
        })}
      </Tabs>

      <Separator />

      {/* Filters + summary */}
      <div className="flex flex-wrap items-center gap-3">
        <Filter className="h-4 w-4 shrink-0 text-muted-foreground" />

        <Select value={stageFilter} onValueChange={setStageFilter}>
          <SelectTrigger className="h-8 w-44 text-xs">
            <SelectValue placeholder="Todas las etapas" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las etapas</SelectItem>
            {[...stages].sort((a, b) => a.position - b.position).map((s) => (
              <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={dateFilter} onValueChange={setDateFilter}>
          <SelectTrigger className="h-8 w-36 text-xs">
            <SelectValue placeholder="Período" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todo el tiempo</SelectItem>
            <SelectItem value="today">Hoy</SelectItem>
            <SelectItem value="week">Esta semana</SelectItem>
            <SelectItem value="month">Este mes</SelectItem>
          </SelectContent>
        </Select>

        {(stageFilter !== 'all' || dateFilter !== 'all') && (
          <Button variant="ghost" size="sm" className="h-8 text-xs text-muted-foreground"
            onClick={() => { setStageFilter('all'); setDateFilter('all') }}>
            Limpiar
          </Button>
        )}

        <span className="ml-auto text-xs text-muted-foreground">
          {filteredDeals.length} deal{filteredDeals.length !== 1 ? 's' : ''} activos
          {sinGestionCount > 0 && (
            <span className="ml-2 font-semibold text-red-600">· {sinGestionCount} sin gestión</span>
          )}
        </span>
      </div>

      {/* Deals table */}
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Lead / Deal</TableHead>
              <TableHead>Etapa</TableHead>
              <TableHead>Valor</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Sin actividad</TableHead>
              <TableHead>Vendedor</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">Cargando...</TableCell>
              </TableRow>
            ) : filteredDeals.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                  No hay deals activos con los filtros seleccionados.
                </TableCell>
              </TableRow>
            ) : (
              filteredDeals.map((deal) => (
                <DealRow
                  key={deal.id}
                  deal={deal}
                  agents={memberAgents}
                  onAssign={(agentId) => assignMutation.mutate({ dealId: deal.id, agentId })}
                  isAssigning={assignMutation.isPending}
                />
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

// ─── Deal row ─────────────────────────────────────────────────────────────────

function DealRow({ deal, agents, onAssign, isAssigning }: {
  deal: Deal; agents: Agent[]; onAssign: (agentId: string) => void; isAssigning: boolean
}) {
  const contactName = deal.contact
    ? `${deal.contact.firstName} ${deal.contact.lastName ?? ''}`.trim()
    : deal.title
  const isSinGestion = getLeadStatus(deal) === 'SIN_GESTION'

  return (
    <TableRow className={cn(isSinGestion && 'bg-red-50/40 hover:bg-red-50/60 dark:bg-red-950/10')}>
      {/* Lead / Deal */}
      <TableCell>
        <div className="flex items-center gap-2">
          <Avatar className="h-7 w-7 shrink-0">
            <AvatarFallback className="text-xs">{getInitials(contactName)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="text-sm font-medium leading-none">{contactName}</p>
            {deal.contact && deal.title !== contactName && (
              <p className="mt-0.5 truncate text-xs text-muted-foreground">{deal.title}</p>
            )}
          </div>
        </div>
      </TableCell>

      {/* Etapa */}
      <TableCell>
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium"
          style={{ backgroundColor: `${deal.stage?.color ?? '#6366f1'}20`, color: deal.stage?.color ?? '#6366f1' }}
        >
          <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: deal.stage?.color ?? '#6366f1' }} />
          {deal.stage?.name ?? '—'}
        </span>
      </TableCell>

      {/* Valor */}
      <TableCell className="text-sm">
        {deal.value != null
          ? <span className="font-medium">{formatCurrency(deal.value)}</span>
          : <span className="text-muted-foreground">—</span>}
      </TableCell>

      {/* Estado del lead */}
      <TableCell><LeadStatusBadge deal={deal} /></TableCell>

      {/* Días sin actividad */}
      <TableCell><DaysCell deal={deal} /></TableCell>

      {/* Vendedor — inline reassignment */}
      <TableCell>
        <Select
          value={deal.assignedToId ?? 'unassigned'}
          onValueChange={(val) => val !== 'unassigned' && onAssign(val)}
          disabled={isAssigning}
        >
          <SelectTrigger className="h-7 w-40 border-0 bg-transparent px-2 text-xs shadow-none hover:bg-accent focus:ring-0">
            <div className="flex items-center gap-1.5 truncate">
              {deal.assignedTo ? (
                <>
                  <Avatar className="h-4 w-4 shrink-0">
                    <AvatarFallback className="text-[8px]">{getInitials(deal.assignedTo.name)}</AvatarFallback>
                  </Avatar>
                  <span className="truncate">{deal.assignedTo.name}</span>
                </>
              ) : (
                <span className="font-medium text-amber-600">Sin asignar</span>
              )}
            </div>
            <ChevronDown className="ml-auto h-3 w-3 shrink-0 opacity-50" />
          </SelectTrigger>
          <SelectContent>
            {deal.assignedToId && (
              <div className="px-2 py-1 text-xs font-medium text-muted-foreground">Reasignar a…</div>
            )}
            {agents.map((agent) => (
              <SelectItem key={agent.id} value={agent.id}>
                <div className="flex items-center gap-2">
                  <Avatar className="h-5 w-5">
                    <AvatarFallback className="text-[9px]">{getInitials(agent.name)}</AvatarFallback>
                  </Avatar>
                  {agent.name}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </TableCell>
    </TableRow>
  )
}
