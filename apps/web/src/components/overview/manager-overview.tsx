'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useQueries, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  AlertCircle, CheckCircle2,
  ChevronDown, Filter, RefreshCw,
} from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { api } from '@/lib/api'
import { cn, formatCurrency, formatDate, getInitials } from '@/lib/utils'
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
  customFields: Record<string, string> | null
  stage: Stage
  contact: { id: string; firstName: string; lastName?: string } | null
  assignedTo: { id: string; name: string } | null
}

// ─── Date helpers ─────────────────────────────────────────────────────────────

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
  const d = new Date(dateStr)
  const now = new Date()
  return d.toDateString() === now.toDateString()
}

// ─── Team stats ───────────────────────────────────────────────────────────────

function buildTeamStats(deals: Deal[], agents: Agent[]) {
  // Unassigned bucket
  const unassigned = deals.filter((d) => !d.assignedToId && d.status === 'OPEN')

  const agentStats = agents.map((agent) => {
    const agentDeals = deals.filter((d) => d.assignedToId === agent.id)
    const openDeals = agentDeals.filter((d) => d.status === 'OPEN')
    const wonThisMonth = agentDeals.filter(
      (d) =>
        d.status === 'WON' &&
        d.closedAt &&
        isThisMonth(d.closedAt),
    )
    const pipelineValue = openDeals.reduce((s, d) => s + (d.value ?? 0), 0)
    return { agent, openDeals: openDeals.length, pipelineValue, wonThisMonth: wonThisMonth.length }
  })

  return { agentStats, unassigned }
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ManagerOverview() {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const [agentFilter, setAgentFilter] = useState('all')
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

  const { agentStats, unassigned } = useMemo(() => buildTeamStats(deals, agents), [deals, agents])

  const assignMutation = useMutation({
    mutationFn: ({ dealId, agentId }: { dealId: string; agentId: string }) =>
      api.put(`/pipeline/deals/${dealId}/assign`, { agentId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipeline'] })
      toast({ title: 'Vendedor actualizado' })
    },
    onError: () => toast({ title: 'Error al reasignar', variant: 'destructive' }),
  })

  // Filtered deals
  const filteredDeals = useMemo(() => {
    return deals.filter((d) => {
      if (agentFilter !== 'all') {
        if (agentFilter === 'unassigned' && d.assignedToId !== null) return false
        if (agentFilter !== 'unassigned' && d.assignedToId !== agentFilter) return false
      }
      if (stageFilter !== 'all' && d.stageId !== stageFilter) return false
      if (dateFilter !== 'all') {
        const ref = d.createdAt
        if (dateFilter === 'today' && !isToday(ref)) return false
        if (dateFilter === 'week' && !isThisWeek(ref)) return false
        if (dateFilter === 'month' && !isThisMonth(ref)) return false
      }
      return true
    })
  }, [deals, agentFilter, stageFilter, dateFilter])

  const totalPipeline = deals.filter((d) => d.status === 'OPEN').reduce((s, d) => s + (d.value ?? 0), 0)
  const memberAgents = agents.filter((a) => a.role === 'MEMBER')

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Overview del equipo</h1>
          <p className="text-sm text-muted-foreground">
            Pipeline total: <span className="font-medium text-foreground">{formatCurrency(totalPipeline)}</span>
            {' · '}{deals.filter((d) => d.status === 'OPEN').length} deals abiertos
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => queryClient.invalidateQueries({ queryKey: ['pipeline'] })}
          disabled={isLoading}
        >
          <RefreshCw className={cn('mr-2 h-4 w-4', isLoading && 'animate-spin')} />
          Actualizar
        </Button>
      </div>

      {/* ── Team cards ── */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Rendimiento del equipo
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {/* Unassigned card */}
          {unassigned.length > 0 && (
            <Link href="/overview/unassigned" className="group block">
              <Card className="border-amber-200 bg-amber-50/50 transition-shadow group-hover:shadow-md dark:bg-amber-950/20">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-100">
                      <AlertCircle className="h-4 w-4 text-amber-600" />
                    </div>
                    <div>
                      <CardTitle className="text-sm group-hover:text-amber-600 transition-colors">
                        Sin asignar
                      </CardTitle>
                      <p className="text-xs text-muted-foreground">
                        Click para gestionar
                      </p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-3 pt-0">
                  <Stat
                    label="Deals abiertos"
                    value={String(unassigned.length)}
                    highlight
                    href="/overview/unassigned"
                  />
                  <Stat label="Valor pipeline" value="—" />
                  <Stat label="Cerrados/mes" value="—" />
                </CardContent>
              </Card>
            </Link>
          )}

          {/* Per-agent cards */}
          {agentStats.map(({ agent, openDeals, pipelineValue, wonThisMonth }) => (
            <Card key={agent.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <Avatar className="h-9 w-9 shrink-0">
                    <AvatarFallback className="text-sm">{getInitials(agent.name)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <CardTitle className="truncate text-sm">{agent.name}</CardTitle>
                    <p className="text-xs text-muted-foreground capitalize">
                      {agent.role === 'MEMBER' ? 'Agente' : agent.role === 'MANAGER' ? 'Manager' : 'Admin'}
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-3 pt-0">
                <Stat label="Deals abiertos" value={String(openDeals)} />
                <Stat label="Valor pipeline" value={pipelineValue > 0 ? formatCurrency(pipelineValue) : '—'} />
                <Stat
                  label="Cerrados/mes"
                  value={String(wonThisMonth)}
                  icon={wonThisMonth > 0 ? <CheckCircle2 className="h-3 w-3 text-green-500" /> : undefined}
                />
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <Separator />

      {/* ── Filters ── */}
      <section className="flex flex-wrap items-center gap-3">
        <Filter className="h-4 w-4 shrink-0 text-muted-foreground" />

        <Select value={agentFilter} onValueChange={setAgentFilter}>
          <SelectTrigger className="h-8 w-44 text-xs">
            <SelectValue placeholder="Todos los vendedores" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los vendedores</SelectItem>
            <SelectItem value="unassigned">Sin asignar</SelectItem>
            {agents.map((a) => (
              <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={stageFilter} onValueChange={setStageFilter}>
          <SelectTrigger className="h-8 w-40 text-xs">
            <SelectValue placeholder="Todas las etapas" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las etapas</SelectItem>
            {[...stages]
              .sort((a, b) => ('position' in a ? (a as any).position - (b as any).position : 0))
              .map((s) => (
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

        {(agentFilter !== 'all' || stageFilter !== 'all' || dateFilter !== 'all') && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs text-muted-foreground"
            onClick={() => { setAgentFilter('all'); setStageFilter('all'); setDateFilter('all') }}
          >
            Limpiar filtros
          </Button>
        )}

        <span className="ml-auto text-xs text-muted-foreground">
          {filteredDeals.length} deal{filteredDeals.length !== 1 ? 's' : ''}
        </span>
      </section>

      {/* ── Pipeline table ── */}
      <section>
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente / Deal</TableHead>
                <TableHead>Seguro</TableHead>
                <TableHead>Etapa</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead>Vendedor asignado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                    Cargando...
                  </TableCell>
                </TableRow>
              ) : filteredDeals.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                    No hay deals con los filtros seleccionados.
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
      </section>
    </div>
  )
}

// ─── Stat sub-component ───────────────────────────────────────────────────────

function Stat({
  label,
  value,
  highlight,
  icon,
  href,
}: {
  label: string
  value: string
  highlight?: boolean
  icon?: React.ReactNode
  href?: string
}) {
  const valueEl = (
    <div className="flex items-center gap-1">
      {icon}
      <p className={cn('text-sm font-semibold', highlight && 'text-amber-600')}>{value}</p>
    </div>
  )
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      {href ? (
        <Link href={href} className="hover:underline">{valueEl}</Link>
      ) : valueEl}
    </div>
  )
}

// ─── Deal row ─────────────────────────────────────────────────────────────────

function DealRow({
  deal,
  agents,
  onAssign,
  isAssigning,
}: {
  deal: Deal
  agents: Agent[]
  onAssign: (agentId: string) => void
  isAssigning: boolean
}) {
  const contactName = deal.contact
    ? `${deal.contact.firstName} ${deal.contact.lastName ?? ''}`.trim()
    : deal.title

  const cf = deal.customFields
  const insuranceType = cf?.insuranceType

  return (
    <TableRow>
      {/* Cliente */}
      <TableCell>
        <div className="flex items-center gap-2">
          <Avatar className="h-7 w-7">
            <AvatarFallback className="text-xs">{getInitials(contactName)}</AvatarFallback>
          </Avatar>
          <span className="text-sm font-medium">{contactName}</span>
        </div>
      </TableCell>

      {/* Seguro */}
      <TableCell>
        {insuranceType ? (
          <Badge variant="outline" className="text-xs">
            {insuranceType === 'SALUD' ? '🏥 Salud' : '🚗 Auto'}
          </Badge>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </TableCell>

      {/* Etapa */}
      <TableCell>
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium"
          style={{
            backgroundColor: `${deal.stage?.color ?? '#6366f1'}20`,
            color: deal.stage?.color ?? '#6366f1',
          }}
        >
          <span
            className="h-1.5 w-1.5 rounded-full"
            style={{ backgroundColor: deal.stage?.color ?? '#6366f1' }}
          />
          {deal.stage?.name ?? '—'}
        </span>
      </TableCell>

      {/* Valor */}
      <TableCell className="text-sm">
        {deal.value != null ? (
          <span className="font-medium">{formatCurrency(deal.value)}</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>

      {/* Fecha */}
      <TableCell className="text-xs text-muted-foreground">
        {formatDate(deal.createdAt)}
      </TableCell>

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
                    <AvatarFallback className="text-[8px]">
                      {getInitials(deal.assignedTo.name)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="truncate">{deal.assignedTo.name}</span>
                </>
              ) : (
                <span className="text-amber-600">Sin asignar</span>
              )}
            </div>
            <ChevronDown className="ml-auto h-3 w-3 shrink-0 opacity-50" />
          </SelectTrigger>
          <SelectContent>
            {deal.assignedToId && (
              <div className="px-2 py-1 text-xs font-medium text-muted-foreground">
                Reasignar a…
              </div>
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
