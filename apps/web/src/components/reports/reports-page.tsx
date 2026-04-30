'use client'

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ComposedChart,
  Line,
  PieChart,
  Pie,
  Cell,
  Legend,
  LabelList,
} from 'recharts'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay } from 'date-fns'
import { es } from 'date-fns/locale'
import { TrendingUp, DollarSign, Target, Award } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { api } from '@/lib/api'
import { formatCurrency } from '@/lib/utils'

interface Deal {
  id: string
  title: string
  value?: number
  status: string
  stageId: string
  assignedToId?: string
  closedAt?: string
  createdAt: string
  stage?: { id: string; name: string; color?: string; position: number }
  contact?: { source?: string }
}

interface User {
  id: string
  name: string
  role: string
}

interface Contact {
  id: string
  source?: string
  createdAt: string
}

function normalizeSource(src?: string): string {
  if (!src) return 'Sin fuente'
  const s = src.toLowerCase()
  if (s.includes('facebook') || s.includes('fb')) return 'Facebook'
  if (s.includes('instagram') || s.includes('ig')) return 'Instagram'
  if (s.includes('whatsapp')) return 'WhatsApp'
  if (s.includes('referido') || s.includes('referral')) return 'Referido'
  if (s.includes('web') || s.includes('sitio')) return 'Sitio Web'
  if (s.includes('llamada') || s.includes('call')) return 'Llamada'
  return src
}

const COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#3b82f6', '#8b5cf6', '#ec4899']

function KpiCard({
  title,
  value,
  sub,
  icon: Icon,
  color = 'text-primary',
}: {
  title: string
  value: string
  sub?: string
  icon: React.ElementType
  color?: string
}) {
  return (
    <Card>
      <CardContent className="pt-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="mt-1 text-2xl font-bold">{value}</p>
            {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
          </div>
          <div className={`rounded-lg bg-primary/10 p-2 ${color}`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export function ReportsPage() {
  const now = new Date()
  const monthStart = startOfMonth(now)
  const monthEnd = endOfMonth(now)

  const { data: deals = [] } = useQuery<Deal[]>({
    queryKey: ['pipeline', 'deals-all'],
    queryFn: () => api.get('/pipeline/deals').then((r) => r.data),
    staleTime: 60_000,
  })

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ['users'],
    queryFn: () => api.get('/users').then((r) => r.data),
    staleTime: 60_000,
  })

  const { data: contactsData } = useQuery<{ data: Contact[] }>({
    queryKey: ['contacts', 'all-sources'],
    queryFn: () => api.get('/contacts?limit=500').then((r) => r.data),
    staleTime: 60_000,
  })
  const contacts: Contact[] = contactsData?.data ?? (Array.isArray(contactsData) ? (contactsData as any) : [])

  // KPIs
  const kpis = useMemo(() => {
    const dealsThisMonth = deals.filter((d) => {
      const created = new Date(d.createdAt)
      return created >= monthStart && created <= monthEnd
    })
    const wonThisMonth = deals.filter((d) => {
      if (d.status !== 'WON') return false
      const closed = d.closedAt ? new Date(d.closedAt) : null
      return closed && closed >= monthStart && closed <= monthEnd
    })
    const closedValue = wonThisMonth.reduce((s, d) => s + (d.value ?? 0), 0)
    const openDeals = deals.filter((d) => d.status === 'OPEN')
    const totalClosed = deals.filter((d) => d.status === 'WON' || d.status === 'LOST').length
    const convRate = totalClosed > 0 ? Math.round((deals.filter((d) => d.status === 'WON').length / totalClosed) * 100) : 0

    return {
      dealsThisMonth: dealsThisMonth.length,
      wonThisMonth: wonThisMonth.length,
      closedValue,
      openDeals: openDeals.length,
      convRate,
    }
  }, [deals, monthStart, monthEnd])

  // Embudo de conversión — stages sorted by position
  const funnelData = useMemo(() => {
    const stageMap = new Map<string, { name: string; color: string; position: number; count: number }>()
    deals.filter((d) => d.status === 'OPEN' && d.stage).forEach((d) => {
      const s = d.stage!
      if (!stageMap.has(s.id)) {
        stageMap.set(s.id, { name: s.name, color: s.color ?? '#6366f1', position: s.position, count: 0 })
      }
      stageMap.get(s.id)!.count++
    })
    return [...stageMap.values()].sort((a, b) => a.position - b.position)
  }, [deals])

  // Ventas del mes — daily bar + cumulative line
  const salesData = useMemo(() => {
    const days = eachDayOfInterval({ start: monthStart, end: monthEnd })
    let cumValue = 0
    return days.map((day) => {
      const won = deals.filter((d) => {
        if (d.status !== 'WON') return false
        const closed = d.closedAt ? new Date(d.closedAt) : null
        return closed && isSameDay(closed, day)
      })
      const dayValue = won.reduce((s, d) => s + (d.value ?? 0), 0)
      cumValue += dayValue
      return {
        day: format(day, 'd', { locale: es }),
        count: won.length,
        value: dayValue,
        cumulative: cumValue,
      }
    })
  }, [deals, monthStart, monthEnd])

  // Rendimiento por vendedor
  const vendorData = useMemo(() => {
    const members = users.filter((u) => u.role === 'MEMBER')
    return members.map((u) => {
      const myDeals = deals.filter((d) => d.assignedToId === u.id)
      const won = myDeals.filter((d) => d.status === 'WON')
      const wonMonth = won.filter((d) => {
        const closed = d.closedAt ? new Date(d.closedAt) : null
        return closed && closed >= monthStart && closed <= monthEnd
      })
      const closed = myDeals.filter((d) => d.status === 'WON' || d.status === 'LOST')
      const conv = closed.length > 0 ? Math.round((won.length / closed.length) * 100) : 0
      const totalValue = won.reduce((s, d) => s + (d.value ?? 0), 0)
      const open = myDeals.filter((d) => d.status === 'OPEN')
      return {
        name: u.name,
        asignados: myDeals.length,
        ganados: wonMonth.length,
        conv,
        totalValue,
        abiertos: open.length,
      }
    })
  }, [users, deals, monthStart, monthEnd])

  // Leads por fuente
  const sourceData = useMemo(() => {
    const map = new Map<string, number>()
    contacts.forEach((c) => {
      const src = normalizeSource(c.source)
      map.set(src, (map.get(src) ?? 0) + 1)
    })
    return [...map.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)
  }, [contacts])

  return (
    <div className="space-y-8 p-6">
      <div>
        <h1 className="text-2xl font-bold">Reportes</h1>
        <p className="text-sm text-muted-foreground">
          {format(now, "MMMM yyyy", { locale: es })} — métricas en tiempo real
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard
          title="Deals este mes"
          value={String(kpis.dealsThisMonth)}
          sub="nuevos en el período"
          icon={Target}
        />
        <KpiCard
          title="Ganados este mes"
          value={String(kpis.wonThisMonth)}
          sub={`${kpis.openDeals} abiertos actualmente`}
          icon={Award}
          color="text-green-600"
        />
        <KpiCard
          title="Valor cerrado"
          value={formatCurrency(kpis.closedValue)}
          sub="deals ganados este mes"
          icon={DollarSign}
          color="text-emerald-600"
        />
        <KpiCard
          title="Tasa de conversión"
          value={`${kpis.convRate}%`}
          sub="ganados / (ganados + perdidos)"
          icon={TrendingUp}
          color="text-blue-600"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {/* Embudo de conversión */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Embudo de Conversión</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart
                layout="vertical"
                data={funnelData}
                margin={{ top: 4, right: 40, left: 8, bottom: 4 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 12 }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={90} />
                <Tooltip
                  formatter={(v: number) => [v, 'Deals']}
                  contentStyle={{ fontSize: 12 }}
                />
                <Bar dataKey="count" radius={[0, 4, 4, 0]} name="Deals">
                  {funnelData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                  <LabelList dataKey="count" position="right" style={{ fontSize: 12 }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Leads por fuente */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Leads por Fuente</CardTitle>
          </CardHeader>
          <CardContent>
            {sourceData.length === 0 ? (
              <div className="flex h-[260px] items-center justify-center text-sm text-muted-foreground">
                Sin datos de fuente
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={sourceData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {sourceData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => [v, 'Leads']} contentStyle={{ fontSize: 12 }} />
                  <Legend iconSize={10} wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Ventas del mes */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Ventas del Mes</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={240}>
            <ComposedChart data={salesData} margin={{ top: 4, right: 24, left: 8, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="day" tick={{ fontSize: 11 }} />
              <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
              <YAxis
                yAxisId="right"
                orientation="right"
                tick={{ fontSize: 11 }}
                tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
              />
              <Tooltip
                formatter={(v: number, name: string) =>
                  name === 'Acumulado' ? [formatCurrency(v), name] : [v, name]
                }
                contentStyle={{ fontSize: 12 }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar yAxisId="left" dataKey="count" name="Deals ganados" fill="#6366f1" radius={[3, 3, 0, 0]} />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="cumulative"
                name="Acumulado"
                stroke="#22c55e"
                strokeWidth={2}
                dot={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Rendimiento por vendedor */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Rendimiento por Vendedor</CardTitle>
        </CardHeader>
        <CardContent>
          {vendorData.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Sin vendedores registrados</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="pb-2 font-medium">Vendedor</th>
                    <th className="pb-2 text-right font-medium">Asignados</th>
                    <th className="pb-2 text-right font-medium">Abiertos</th>
                    <th className="pb-2 text-right font-medium">Ganados (mes)</th>
                    <th className="pb-2 text-right font-medium">Conversión</th>
                    <th className="pb-2 text-right font-medium">Valor total</th>
                  </tr>
                </thead>
                <tbody>
                  {vendorData.map((v) => (
                    <tr key={v.name} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="py-2.5 font-medium">{v.name}</td>
                      <td className="py-2.5 text-right">{v.asignados}</td>
                      <td className="py-2.5 text-right">{v.abiertos}</td>
                      <td className="py-2.5 text-right">{v.ganados}</td>
                      <td className="py-2.5 text-right">
                        <span
                          className={
                            v.conv >= 50
                              ? 'text-green-600 font-semibold'
                              : v.conv >= 25
                                ? 'text-yellow-600 font-semibold'
                                : 'text-red-600 font-semibold'
                          }
                        >
                          {v.conv}%
                        </span>
                      </td>
                      <td className="py-2.5 text-right font-medium">{formatCurrency(v.totalValue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
