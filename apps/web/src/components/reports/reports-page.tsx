'use client'

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  ComposedChart,
  Bar,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  Label,
} from 'recharts'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay } from 'date-fns'
import { es } from 'date-fns/locale'
import { api } from '@/lib/api'
import { formatCurrency } from '@/lib/utils'

// ─── Brand tokens ─────────────────────────────────────────────────────────────
const NAVY   = '#25324b'
const GOLD   = '#d3ac76'
const NAVY15 = 'rgba(37,50,75,0.12)'
const GOLD12 = 'rgba(211,172,118,0.12)'

const SOURCE_COLORS = [NAVY, GOLD, '#3b82f6', '#22c55e', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6']

// ─── Types ────────────────────────────────────────────────────────────────────
interface Deal {
  id: string
  value?: number
  status: string
  stageId: string
  assignedToId?: string
  closedAt?: string
  createdAt: string
  stage?: { id: string; name: string; color?: string; position: number }
}
interface User    { id: string; name: string; role: string }
interface Contact { id: string; source?: string }

// ─── Helpers ──────────────────────────────────────────────────────────────────
function normalizeSource(src?: string): string {
  if (!src) return 'Sin fuente'
  const s = src.toLowerCase()
  if (s.includes('facebook') || s.includes('fb'))        return 'Facebook'
  if (s.includes('instagram') || s.includes('ig'))       return 'Instagram'
  if (s.includes('whatsapp'))                            return 'WhatsApp'
  if (s.includes('referido') || s.includes('referral'))  return 'Referido'
  if (s.includes('web') || s.includes('sitio'))          return 'Web'
  if (s.includes('llamada') || s.includes('call'))       return 'Llamada'
  return src
}

function initials(name: string) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

// ─── Primitive building blocks ────────────────────────────────────────────────
function Panel({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-2xl bg-white ${className}`}
      style={{ boxShadow: '0 1px 3px rgba(37,50,75,0.07), 0 4px 16px rgba(37,50,75,0.05)' }}
    >
      {children}
    </div>
  )
}

function BigKpi({
  label,
  value,
  sub,
}: { label: string; value: string | number; sub: string }) {
  return (
    <div className="mb-6">
      <p
        className="mb-1 text-[10px] font-bold uppercase tracking-[0.14em]"
        style={{ color: GOLD }}
      >
        {label}
      </p>
      <p className="text-[2.6rem] font-extrabold leading-none tracking-tight" style={{ color: NAVY }}>
        {value}
      </p>
      <p className="mt-1.5 text-[13px]" style={{ color: '#8a96a8' }}>{sub}</p>
    </div>
  )
}

function ConvPill({ pct }: { pct: number }) {
  const [bg, fg] =
    pct >= 50 ? ['#dcfce7', '#15803d'] :
    pct >= 25 ? ['#fef3c7', '#b45309'] :
               ['#fee2e2', '#b91c1c']
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold"
      style={{ background: bg, color: fg }}
    >
      {pct}%
    </span>
  )
}

// ─── Funnel (pure HTML – gives full design control) ──────────────────────────
function FunnelBars({ data }: { data: Array<{ name: string; count: number }> }) {
  if (!data.length) {
    return (
      <div className="flex h-40 items-center justify-center text-sm" style={{ color: '#c5cad4' }}>
        Sin datos de pipeline
      </div>
    )
  }
  const maxCount = Math.max(...data.map(d => d.count), 1)

  return (
    <div className="space-y-0.5">
      {data.map((item, i) => {
        const next = data[i + 1]
        const conv  = next ? Math.round((next.count / Math.max(item.count, 1)) * 100) : null
        const width = Math.max(Math.round((item.count / maxCount) * 100), 6)

        return (
          <div key={item.name}>
            {/* Bar row */}
            <div className="flex items-center gap-3 py-0.5">
              <span
                className="w-[7.5rem] shrink-0 truncate text-right text-[12px]"
                style={{ color: '#6b7585' }}
              >
                {item.name}
              </span>

              <div className="relative flex-1 h-9 rounded-lg overflow-hidden" style={{ background: '#f4f5f7' }}>
                <div
                  className="h-full rounded-lg"
                  style={{
                    width: `${width}%`,
                    background: `linear-gradient(90deg, ${NAVY} 0%, #3d5278 100%)`,
                    transition: 'width 0.6s cubic-bezier(.4,0,.2,1)',
                  }}
                />
                {/* Count label — white inside bar if wide enough, else dark outside */}
                {width >= 20 ? (
                  <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-[12px] font-bold text-white">
                    {item.count}
                  </span>
                ) : (
                  <span
                    className="pointer-events-none absolute inset-y-0 flex items-center text-[12px] font-bold"
                    style={{ left: `${width + 2}%`, color: NAVY }}
                  >
                    {item.count}
                  </span>
                )}
              </div>
            </div>

            {/* Conversion arrow between stages */}
            {conv !== null && (
              <div className="flex items-center gap-3 py-0.5">
                <span className="w-[7.5rem] shrink-0" />
                <div className="flex items-center gap-1.5">
                  {/* SVG downward arrow */}
                  <svg width="9" height="11" viewBox="0 0 9 11" fill="none">
                    <path
                      d="M4.5 0v8M1.5 6l3 4.5 3-4.5"
                      stroke={GOLD}
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <span
                    className="text-[11px] font-semibold"
                    style={{ color: GOLD }}
                  >
                    {conv}% avanzó a la siguiente etapa
                  </span>
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Custom tooltip for sales chart ──────────────────────────────────────────
function SalesTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div
      className="rounded-xl px-4 py-3"
      style={{
        background: '#fff',
        border: '1px solid #eaecf0',
        boxShadow: '0 8px 24px rgba(37,50,75,0.12)',
      }}
    >
      <p className="mb-2 text-[11px] font-bold uppercase tracking-wider" style={{ color: NAVY }}>
        Día {label}
      </p>
      {payload.map((p: any) => (
        <p key={p.name} className="text-[12px]" style={{ color: '#6b7585' }}>
          <span className="font-semibold" style={{ color: p.color }}>{p.name}: </span>
          {p.dataKey === 'cumulative' ? formatCurrency(p.value) : p.value}
        </p>
      ))}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────
export function ReportsPage() {
  const now        = new Date()
  const monthStart = startOfMonth(now)
  const monthEnd   = endOfMonth(now)

  const { data: deals = [] } = useQuery<Deal[]>({
    queryKey: ['pipeline', 'deals-all'],
    queryFn: () => api.get('/pipeline/deals').then(r => r.data),
    staleTime: 60_000,
  })

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ['users'],
    queryFn: () => api.get('/users').then(r => r.data),
    staleTime: 60_000,
  })

  const { data: contactsRaw } = useQuery({
    queryKey: ['contacts', 'all-sources'],
    queryFn: () => api.get('/contacts?limit=500').then(r => r.data),
    staleTime: 60_000,
  })
  const contacts: Contact[] = Array.isArray(contactsRaw)
    ? contactsRaw
    : ((contactsRaw as any)?.data ?? [])

  // ── KPIs ────────────────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const wonMonth = deals.filter(d => {
      if (d.status !== 'WON') return false
      const c = d.closedAt ? new Date(d.closedAt) : null
      return c && c >= monthStart && c <= monthEnd
    })
    const newMonth   = deals.filter(d => {
      const c = new Date(d.createdAt)
      return c >= monthStart && c <= monthEnd
    })
    const closedAll  = deals.filter(d => d.status === 'WON' || d.status === 'LOST').length
    const wonAll     = deals.filter(d => d.status === 'WON').length
    const conv       = closedAll > 0 ? Math.round((wonAll / closedAll) * 100) : 0
    const openDeals  = deals.filter(d => d.status === 'OPEN').length
    const closedVal  = wonMonth.reduce((s, d) => s + (d.value ?? 0), 0)
    return { wonMonth: wonMonth.length, newMonth: newMonth.length, closedVal, conv, openDeals }
  }, [deals, monthStart, monthEnd])

  // ── Funnel ──────────────────────────────────────────────────────────────
  const funnelData = useMemo(() => {
    const map = new Map<string, { name: string; count: number; position: number }>()
    deals.filter(d => d.status === 'OPEN' && d.stage).forEach(d => {
      const s = d.stage!
      if (!map.has(s.id)) map.set(s.id, { name: s.name, count: 0, position: s.position })
      map.get(s.id)!.count++
    })
    return [...map.values()].sort((a, b) => a.position - b.position)
  }, [deals])

  // ── Sales daily ─────────────────────────────────────────────────────────
  const salesData = useMemo(() => {
    const cap  = now < monthEnd ? now : monthEnd
    const days = eachDayOfInterval({ start: monthStart, end: cap })
    let cum = 0
    return days.map(day => {
      const won    = deals.filter(d => {
        if (d.status !== 'WON') return false
        const c = d.closedAt ? new Date(d.closedAt) : null
        return c && isSameDay(c, day)
      })
      const dayVal = won.reduce((s, d) => s + (d.value ?? 0), 0)
      cum += dayVal
      return { day: format(day, 'd'), count: won.length, cumulative: cum }
    })
  }, [deals, monthStart, monthEnd]) // eslint-disable-line react-hooks/exhaustive-deps

  const cumulativeVal = salesData[salesData.length - 1]?.cumulative ?? 0

  // ── Vendors ─────────────────────────────────────────────────────────────
  const vendorData = useMemo(() => {
    const members = users.filter(u => u.role === 'MEMBER')
    return members
      .map(u => {
        const mine     = deals.filter(d => d.assignedToId === u.id)
        const won      = mine.filter(d => d.status === 'WON')
        const wonMonth = won.filter(d => {
          const c = d.closedAt ? new Date(d.closedAt) : null
          return c && c >= monthStart && c <= monthEnd
        })
        const closed   = mine.filter(d => d.status === 'WON' || d.status === 'LOST')
        const conv     = closed.length > 0 ? Math.round((won.length / closed.length) * 100) : 0
        const totalVal = won.reduce((s, d) => s + (d.value ?? 0), 0)
        return {
          name: u.name,
          asignados: mine.length,
          abiertos:  mine.filter(d => d.status === 'OPEN').length,
          wonMonth:  wonMonth.length,
          conv,
          totalVal,
        }
      })
      .sort((a, b) => b.totalVal - a.totalVal)
  }, [users, deals, monthStart, monthEnd])

  const maxVendorVal = Math.max(...vendorData.map(v => v.totalVal), 1)
  const avgConv      = vendorData.length
    ? Math.round(vendorData.reduce((s, v) => s + v.conv, 0) / vendorData.length)
    : 0

  // ── Sources ─────────────────────────────────────────────────────────────
  const sourceData = useMemo(() => {
    const map = new Map<string, number>()
    contacts.forEach(c => {
      const src = normalizeSource(c.source)
      map.set(src, (map.get(src) ?? 0) + 1)
    })
    return [...map.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)
  }, [contacts])

  const totalContacts = contacts.length

  // ─── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen p-6 lg:p-8" style={{ background: '#f4f5f7' }}>

      {/* Page header */}
      <div className="mb-8">
        <p
          className="mb-1 text-[10px] font-bold uppercase tracking-[0.18em]"
          style={{ color: GOLD }}
        >
          Priority CRM
        </p>
        <h1 className="text-[1.85rem] font-extrabold tracking-tight" style={{ color: NAVY }}>
          Reportes
        </h1>
        <p className="mt-1 text-sm capitalize" style={{ color: '#8a96a8' }}>
          {format(monthStart, "MMMM yyyy", { locale: es })}
          {' · '}actualizado hoy {format(now, "HH:mm")}
        </p>
      </div>

      {/* ── KPI strip ───────────────────────────────────────────────────── */}
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {([
          {
            label:  'Deals nuevos',
            value:  kpis.newMonth,
            sub:    'creados este mes',
            accent: NAVY,
          },
          {
            label:  'Deals ganados',
            value:  kpis.wonMonth,
            sub:    'cerrados este mes',
            accent: '#22c55e',
          },
          {
            label:  'Valor cerrado',
            value:  formatCurrency(kpis.closedVal),
            sub:    'revenue este mes',
            accent: GOLD,
          },
          {
            label:  'Conversión',
            value:  `${kpis.conv}%`,
            sub:    'ganados / cerrados',
            accent: kpis.conv >= 50 ? '#22c55e' : kpis.conv >= 25 ? '#f59e0b' : '#ef4444',
          },
        ] as const).map(({ label, value, sub, accent }) => (
          <Panel key={label} className="p-5">
            {/* Brand accent line */}
            <div className="mb-4 h-[3px] w-8 rounded-full" style={{ background: accent }} />
            <p
              className="text-[10px] font-bold uppercase tracking-[0.14em]"
              style={{ color: '#8a96a8' }}
            >
              {label}
            </p>
            <p
              className="mt-1.5 text-3xl font-extrabold tracking-tight"
              style={{ color: NAVY }}
            >
              {value}
            </p>
            <p className="mt-1 text-[12px]" style={{ color: '#b0b8c6' }}>{sub}</p>
          </Panel>
        ))}
      </div>

      {/* ── Funnel + Donut ──────────────────────────────────────────────── */}
      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">

        {/* Embudo */}
        <Panel className="p-6">
          <BigKpi
            label="Embudo de Conversión"
            value={kpis.openDeals}
            sub="deals activos en pipeline"
          />
          <FunnelBars data={funnelData} />
        </Panel>

        {/* Donut */}
        <Panel className="p-6">
          <BigKpi
            label="Leads por Fuente"
            value={totalContacts}
            sub="contactos registrados"
          />
          {sourceData.length === 0 ? (
            <div
              className="flex h-48 items-center justify-center text-sm"
              style={{ color: '#c5cad4' }}
            >
              Sin datos de fuente
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={210}>
              <PieChart>
                <defs>
                  <filter id="pieShadow" x="-20%" y="-20%" width="140%" height="140%">
                    <feDropShadow dx="0" dy="2" stdDeviation="4" floodColor={NAVY} floodOpacity="0.08" />
                  </filter>
                </defs>
                <Pie
                  data={sourceData}
                  cx="42%"
                  cy="50%"
                  innerRadius={62}
                  outerRadius={90}
                  paddingAngle={3}
                  dataKey="value"
                  filter="url(#pieShadow)"
                >
                  {sourceData.map((_, i) => (
                    <Cell key={i} fill={SOURCE_COLORS[i % SOURCE_COLORS.length]} />
                  ))}
                  <Label
                    value={totalContacts}
                    position="center"
                    dy={-8}
                    style={{ fontSize: 26, fontWeight: 800, fill: NAVY }}
                  />
                  <Label
                    value="total"
                    position="center"
                    dy={14}
                    style={{ fontSize: 11, fill: '#9ca3af', fontWeight: 500 }}
                  />
                </Pie>
                <Tooltip
                  formatter={(v: number, name: string) => [v, name]}
                  contentStyle={{
                    fontSize: 12,
                    borderRadius: 12,
                    border: 'none',
                    boxShadow: '0 8px 24px rgba(37,50,75,0.14)',
                  }}
                />
                <Legend
                  layout="vertical"
                  align="right"
                  verticalAlign="middle"
                  iconType="circle"
                  iconSize={8}
                  wrapperStyle={{ fontSize: 11, color: '#6b7585', lineHeight: '1.8' }}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Panel>
      </div>

      {/* ── Ventas del mes ──────────────────────────────────────────────── */}
      <Panel className="mb-6 p-6">
        <BigKpi
          label="Ventas del Mes"
          value={formatCurrency(cumulativeVal)}
          sub={`valor acumulado · ${kpis.wonMonth} deals ganados`}
        />
        <ResponsiveContainer width="100%" height={210}>
          <ComposedChart data={salesData} margin={{ top: 4, right: 20, left: 4, bottom: 0 }}>
            <defs>
              <linearGradient id="goldAreaGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor={GOLD} stopOpacity={0.22} />
                <stop offset="100%" stopColor={GOLD} stopOpacity={0}    />
              </linearGradient>
              <linearGradient id="navyBarGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor={NAVY} stopOpacity={0.22} />
                <stop offset="100%" stopColor={NAVY} stopOpacity={0.06} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#eaecf0" vertical={false} />
            <XAxis
              dataKey="day"
              tick={{ fontSize: 11, fill: '#9ca3af' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              yAxisId="bars"
              tick={{ fontSize: 11, fill: '#9ca3af' }}
              axisLine={false}
              tickLine={false}
              allowDecimals={false}
              width={24}
            />
            <YAxis
              yAxisId="line"
              orientation="right"
              tick={{ fontSize: 11, fill: '#9ca3af' }}
              axisLine={false}
              tickLine={false}
              tickFormatter={v => `$${(v / 1000).toFixed(0)}k`}
              width={40}
            />
            <Tooltip content={<SalesTooltip />} />
            <Bar
              yAxisId="bars"
              dataKey="count"
              name="Deals ganados"
              fill="url(#navyBarGrad)"
              radius={[4, 4, 0, 0]}
              barSize={12}
            />
            <Area
              yAxisId="line"
              type="monotone"
              dataKey="cumulative"
              name="Valor acumulado"
              stroke={GOLD}
              strokeWidth={2.5}
              fill="url(#goldAreaGrad)"
              dot={false}
              activeDot={{ r: 5, fill: GOLD, stroke: '#fff', strokeWidth: 2.5 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </Panel>

      {/* ── Rendimiento por vendedor ─────────────────────────────────────── */}
      <Panel className="p-6">
        <BigKpi
          label="Rendimiento por Vendedor"
          value={`${avgConv}%`}
          sub="conversión promedio del equipo"
        />

        {vendorData.length === 0 ? (
          <p className="py-8 text-center text-sm" style={{ color: '#c5cad4' }}>
            Sin vendedores registrados
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px]">
              <thead>
                <tr style={{ borderBottom: `2px solid ${NAVY15}` }}>
                  {['Vendedor', 'Asignados', 'Abiertos', 'Ganados (mes)', 'Conversión', 'Valor ganado'].map(h => (
                    <th
                      key={h}
                      className="pb-3 pr-5 text-left text-[10px] font-bold uppercase tracking-[0.12em] last:pr-0"
                      style={{ color: '#9ca3af' }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {vendorData.map((v) => (
                  <tr
                    key={v.name}
                    className="group transition-colors"
                    style={{ borderBottom: `1px solid ${NAVY15}` }}
                  >
                    {/* Vendedor */}
                    <td className="py-3.5 pr-5">
                      <div className="flex items-center gap-2.5">
                        <div
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-extrabold text-white"
                          style={{ background: `linear-gradient(135deg, ${NAVY} 0%, #3d5278 100%)` }}
                        >
                          {initials(v.name)}
                        </div>
                        <span
                          className="text-[13px] font-semibold"
                          style={{ color: NAVY }}
                        >
                          {v.name}
                        </span>
                      </div>
                    </td>

                    {/* Asignados */}
                    <td className="py-3.5 pr-5 text-[13px]" style={{ color: '#6b7585' }}>
                      {v.asignados}
                    </td>

                    {/* Abiertos */}
                    <td className="py-3.5 pr-5 text-[13px]" style={{ color: '#6b7585' }}>
                      {v.abiertos}
                    </td>

                    {/* Ganados mes */}
                    <td className="py-3.5 pr-5">
                      <span
                        className="text-[13px] font-bold"
                        style={{ color: v.wonMonth > 0 ? '#15803d' : '#9ca3af' }}
                      >
                        {v.wonMonth}
                      </span>
                    </td>

                    {/* Conversión */}
                    <td className="py-3.5 pr-5">
                      <ConvPill pct={v.conv} />
                    </td>

                    {/* Valor + mini bar */}
                    <td className="py-3.5">
                      <div className="flex flex-col gap-1.5">
                        <span
                          className="text-[13px] font-bold"
                          style={{ color: NAVY }}
                        >
                          {formatCurrency(v.totalVal)}
                        </span>
                        <div
                          className="h-[3px] w-24 overflow-hidden rounded-full"
                          style={{ background: GOLD12 }}
                        >
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${Math.round((v.totalVal / maxVendorVal) * 100)}%`,
                              background: GOLD,
                            }}
                          />
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {/* Footer */}
      <p className="mt-8 text-center text-[11px]" style={{ color: '#c5cad4' }}>
        Priority CRM &middot; datos en tiempo real
      </p>
    </div>
  )
}
