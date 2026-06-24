'use client'

import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns'
import { es } from 'date-fns/locale'
import { Download, Calendar } from 'lucide-react'
import * as XLSX from 'xlsx'
import { api } from '@/lib/api'
import { formatCurrency } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { LeadOriginBadge } from '@/components/pipeline/lead-origin-badge'

// ─── Brand tokens ─────────────────────────────────────────────────────────────
const NAVY   = '#25324b'
const GOLD   = '#d3ac76'
const NAVY15 = 'rgba(37,50,75,0.12)'

// ─── Types ────────────────────────────────────────────────────────────────────
type LeadOrigin = 'PRIORITY_HEALTH' | 'PROPIO'

interface InsuranceEntry {
  aseguradora?: string
  netPremium?: number
  paymentFrequency?: string
}

interface Deal {
  id: string
  value?: number
  closedAt?: string
  customFields?: {
    leadOrigin?: string
    insuranceData?: InsuranceEntry[] | InsuranceEntry
    prima?: number
  }
  contact?: { id: string; firstName: string; lastName?: string }
  assignedTo?: { id: string; name: string }
  assignedToId?: string
}

interface User { id: string; name: string; role: string }

type Period = 'thisMonth' | 'lastMonth' | 'custom'

// ─── Helpers ──────────────────────────────────────────────────────────────────
function toInsuranceEntries(raw: unknown): InsuranceEntry[] {
  if (Array.isArray(raw)) return raw as InsuranceEntry[]
  if (raw && typeof raw === 'object') return [raw as InsuranceEntry]
  return []
}

function dealPremium(d: Deal): number {
  const entries = toInsuranceEntries(d.customFields?.insuranceData)
  const total = entries.reduce((s, e) => s + (typeof e.netPremium === 'number' ? e.netPremium : 0), 0)
  if (total > 0) return total
  if (typeof d.value === 'number' && d.value > 0) return d.value
  if (typeof d.customFields?.prima === 'number') return d.customFields.prima
  return 0
}

function dealInsurers(d: Deal): string {
  const entries = toInsuranceEntries(d.customFields?.insuranceData)
  const names = [...new Set(entries.map((e) => e.aseguradora).filter(Boolean))] as string[]
  return names.length ? names.join(' / ') : '—'
}

function formatPaymentFrequency(val?: string): string | undefined {
  if (!val) return undefined
  const map: Record<string, string> = {
    'pago-contado': 'Pago contado',
    'debito-mensual': 'Débito mensual',
    'diferido-especial': 'Diferido especial',
    'mensual': 'Mensual',
    'trimestral': 'Trimestral',
    'semestral': 'Semestral',
    'anual': 'Anual',
  }
  return map[val] ?? val.charAt(0).toUpperCase() + val.slice(1)
}

function dealPaymentMethod(d: Deal): string {
  const entries = toInsuranceEntries(d.customFields?.insuranceData)
  const freqs = [...new Set(entries.map((e) => formatPaymentFrequency(e.paymentFrequency)).filter(Boolean))] as string[]
  return freqs.length ? freqs.join(' / ') : '—'
}

function dealOrigin(d: Deal): LeadOrigin {
  return d.customFields?.leadOrigin === 'PROPIO' ? 'PROPIO' : 'PRIORITY_HEALTH'
}

function contactName(d: Deal): string {
  if (!d.contact) return '—'
  return `${d.contact.firstName} ${d.contact.lastName ?? ''}`.trim()
}

function getPeriodRange(period: Period, customStart: string, customEnd: string, now: Date) {
  if (period === 'thisMonth') {
    return { start: startOfMonth(now), end: endOfMonth(now) }
  }
  if (period === 'lastMonth') {
    const prev = subMonths(now, 1)
    return { start: startOfMonth(prev), end: endOfMonth(prev) }
  }
  return {
    start: customStart ? new Date(customStart + 'T00:00:00') : startOfMonth(now),
    end:   customEnd   ? new Date(customEnd   + 'T23:59:59') : endOfMonth(now),
  }
}

function periodLabel(period: Period, start: Date, end: Date) {
  if (period === 'thisMonth') return format(start, 'MMMM yyyy', { locale: es })
  if (period === 'lastMonth') return format(start, 'MMMM yyyy', { locale: es })
  return `${format(start, 'd MMM yyyy', { locale: es })} – ${format(end, 'd MMM yyyy', { locale: es })}`
}

function initials(name: string) {
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
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

function TotalCard({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <Panel className="p-5">
      <div className="mb-3 h-[3px] w-8 rounded-full" style={{ background: accent }} />
      <p className="text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: '#8a96a8' }}>
        {label}
      </p>
      <p className="mt-1.5 text-2xl font-extrabold tracking-tight" style={{ color: NAVY }}>
        {formatCurrency(value)}
      </p>
    </Panel>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────
export function CommissionsPage() {
  const now = new Date()

  const [period, setPeriod] = useState<Period>('thisMonth')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')
  const [vendorFilter, setVendorFilter] = useState('ALL')
  const [originFilter, setOriginFilter] = useState<'ALL' | LeadOrigin>('ALL')

  const { start: periodStart, end: periodEnd } = useMemo(
    () => getPeriodRange(period, customStart, customEnd, now),
    [period, customStart, customEnd], // eslint-disable-line react-hooks/exhaustive-deps
  )

  const { data: deals = [], isLoading } = useQuery<Deal[]>({
    queryKey: ['pipeline', 'commissions'],
    queryFn: () => api.get('/pipeline/commissions').then((r) => r.data),
    staleTime: 0,
  })

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ['users'],
    queryFn: () => api.get('/users').then((r) => r.data),
    staleTime: 60_000,
  })

  const vendors = useMemo(() => users.filter((u) => u.role === 'SALES_REP'), [users])

  const filteredDeals = useMemo(() => {
    return deals.filter((d) => {
      if (!d.closedAt) return false
      const date = new Date(d.closedAt)
      if (date < periodStart || date > periodEnd) return false
      if (vendorFilter !== 'ALL' && d.assignedToId !== vendorFilter) return false
      if (originFilter !== 'ALL' && dealOrigin(d) !== originFilter) return false
      return true
    }).sort((a, b) => new Date(b.closedAt!).getTime() - new Date(a.closedAt!).getTime())
  }, [deals, periodStart, periodEnd, vendorFilter, originFilter])

  const totals = useMemo(() => {
    let priorityHealth = 0
    let propio = 0
    filteredDeals.forEach((d) => {
      const v = dealPremium(d)
      if (dealOrigin(d) === 'PROPIO') propio += v
      else priorityHealth += v
    })
    return { priorityHealth, propio, general: priorityHealth + propio }
  }, [filteredDeals])

  const vendorBreakdown = useMemo(() => {
    const map = new Map<string, { name: string; priorityHealth: number; propio: number }>()
    filteredDeals.forEach((d) => {
      const id = d.assignedToId ?? 'unassigned'
      const name = d.assignedTo?.name ?? 'Sin asignar'
      if (!map.has(id)) map.set(id, { name, priorityHealth: 0, propio: 0 })
      const entry = map.get(id)!
      const v = dealPremium(d)
      if (dealOrigin(d) === 'PROPIO') entry.propio += v
      else entry.priorityHealth += v
    })
    return [...map.values()].sort(
      (a, b) => (b.priorityHealth + b.propio) - (a.priorityHealth + a.propio),
    )
  }, [filteredDeals])

  function downloadExcel() {
    const rows = filteredDeals.map((d) => ({
      'Cliente': contactName(d),
      'Vendedor': d.assignedTo?.name ?? 'Sin asignar',
      'Origen': dealOrigin(d) === 'PROPIO' ? 'Propio' : 'Priority Health',
      'Aseguradora': dealInsurers(d),
      'Prima neta (USD)': dealPremium(d),
      'Forma de pago': dealPaymentMethod(d),
      'Fecha de cierre': d.closedAt ? format(new Date(d.closedAt), 'dd/MM/yyyy') : '',
    }))

    const header = ['Cliente', 'Vendedor', 'Origen', 'Aseguradora', 'Prima neta (USD)', 'Forma de pago', 'Fecha de cierre']
    const aoa: (string | number)[][] = [header, ...rows.map((r) => header.map((h) => (r as any)[h]))]
    aoa.push([])
    aoa.push(['Total ganado Priority Health', totals.priorityHealth])
    aoa.push(['Total ganado Propio', totals.propio])
    aoa.push(['Total general', totals.general])

    const ws = XLSX.utils.aoa_to_sheet(aoa)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Comisiones')
    XLSX.writeFile(wb, `comisiones-priority-crm-${format(now, 'yyyy-MM-dd')}.xlsx`)
  }

  return (
    <div className="min-h-screen p-4 md:p-6 lg:p-8" style={{ background: '#f4f5f7' }}>

      {/* Page header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: GOLD }}>
            Priority CRM
          </p>
          <h1 className="text-[1.85rem] font-extrabold tracking-tight" style={{ color: NAVY }}>
            Comisiones
          </h1>
          <p className="mt-1 text-sm capitalize" style={{ color: '#8a96a8' }}>
            {periodLabel(period, periodStart, periodEnd)}
            {' · '}deals ganados
          </p>
        </div>

        <Button onClick={downloadExcel} className="gap-2 shrink-0" style={{ background: NAVY, color: '#fff' }}>
          <Download className="h-4 w-4" />
          Descargar Excel
        </Button>
      </div>

      {/* Filters */}
      <Panel className="mb-6 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Calendar className="h-4 w-4 shrink-0" style={{ color: GOLD }} />
            <div className="flex flex-wrap gap-1">
              {([
                { value: 'thisMonth', label: 'Mes actual' },
                { value: 'lastMonth', label: 'Mes anterior' },
                { value: 'custom', label: 'Rango de fechas' },
              ] as { value: Period; label: string }[]).map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setPeriod(opt.value)}
                  className="rounded-full px-3.5 py-1.5 text-[12px] font-semibold transition-all"
                  style={
                    period === opt.value
                      ? { background: NAVY, color: '#fff' }
                      : { background: '#eef0f4', color: '#6b7585' }
                  }
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {period === 'custom' && (
              <div className="flex items-center gap-2 ml-1">
                <input
                  type="date"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  className="rounded-md border bg-white px-2 py-1 text-sm text-[#25324b] outline-none focus:ring-2 focus:ring-[#d3ac76]/40"
                />
                <span className="text-xs text-muted-foreground">al</span>
                <input
                  type="date"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  className="rounded-md border bg-white px-2 py-1 text-sm text-[#25324b] outline-none focus:ring-2 focus:ring-[#d3ac76]/40"
                />
              </div>
            )}
          </div>

          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Select value={vendorFilter} onValueChange={setVendorFilter}>
              <SelectTrigger className="h-9 w-[180px] text-sm">
                <SelectValue placeholder="Vendedor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos los vendedores</SelectItem>
                {vendors.map((v) => (
                  <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={originFilter} onValueChange={(v) => setOriginFilter(v as 'ALL' | LeadOrigin)}>
              <SelectTrigger className="h-9 w-[170px] text-sm">
                <SelectValue placeholder="Origen" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos los orígenes</SelectItem>
                <SelectItem value="PRIORITY_HEALTH">Priority Health</SelectItem>
                <SelectItem value="PROPIO">Propio</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </Panel>

      {/* Totals */}
      <div className="mb-6 grid grid-cols-1 gap-3 md:gap-4 sm:grid-cols-3">
        <TotalCard label="Total ganado Priority Health" value={totals.priorityHealth} accent={GOLD} />
        <TotalCard label="Total ganado Propio" value={totals.propio} accent={NAVY} />
        <TotalCard label="Total general" value={totals.general} accent="#22c55e" />
      </div>

      {/* Deals table */}
      <Panel className="mb-6 p-6">
        {isLoading ? (
          <p className="py-8 text-center text-sm" style={{ color: '#c5cad4' }}>Cargando…</p>
        ) : filteredDeals.length === 0 ? (
          <p className="py-8 text-center text-sm" style={{ color: '#c5cad4' }}>
            Sin deals ganados para los filtros seleccionados
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px]">
              <thead>
                <tr style={{ borderBottom: `2px solid ${NAVY15}` }}>
                  {['Cliente', 'Vendedor', 'Origen', 'Aseguradora', 'Prima neta', 'Forma de pago', 'Fecha de cierre'].map((h) => (
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
                {filteredDeals.map((d) => (
                  <tr key={d.id} className="transition-colors" style={{ borderBottom: `1px solid ${NAVY15}` }}>
                    <td className="py-3.5 pr-5 text-[13px] font-semibold" style={{ color: NAVY }}>
                      {contactName(d)}
                    </td>
                    <td className="py-3.5 pr-5 text-[13px]" style={{ color: '#6b7585' }}>
                      {d.assignedTo?.name ?? 'Sin asignar'}
                    </td>
                    <td className="py-3.5 pr-5">
                      <LeadOriginBadge leadOrigin={dealOrigin(d)} />
                    </td>
                    <td className="py-3.5 pr-5 text-[13px]" style={{ color: '#6b7585' }}>
                      {dealInsurers(d)}
                    </td>
                    <td className="py-3.5 pr-5 text-[13px] font-bold" style={{ color: NAVY }}>
                      {formatCurrency(dealPremium(d))}
                    </td>
                    <td className="py-3.5 pr-5 text-[13px]" style={{ color: '#6b7585' }}>
                      {dealPaymentMethod(d)}
                    </td>
                    <td className="py-3.5 text-[13px]" style={{ color: '#6b7585' }}>
                      {d.closedAt ? format(new Date(d.closedAt), 'd MMM yyyy', { locale: es }) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {/* Per-vendor breakdown */}
      <Panel className="p-6">
        <p className="mb-4 text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: GOLD }}>
          Desglose por Vendedor
        </p>

        {vendorBreakdown.length === 0 ? (
          <p className="py-6 text-center text-sm" style={{ color: '#c5cad4' }}>Sin datos</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px]">
              <thead>
                <tr style={{ borderBottom: `2px solid ${NAVY15}` }}>
                  {['Vendedor', 'Priority Health', 'Propio', 'Total'].map((h) => (
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
                {vendorBreakdown.map((v) => (
                  <tr key={v.name} style={{ borderBottom: `1px solid ${NAVY15}` }}>
                    <td className="py-3.5 pr-5">
                      <div className="flex items-center gap-2.5">
                        <div
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-extrabold text-white"
                          style={{ background: `linear-gradient(135deg, ${NAVY} 0%, #3d5278 100%)` }}
                        >
                          {initials(v.name)}
                        </div>
                        <span className="text-[13px] font-semibold" style={{ color: NAVY }}>
                          {v.name}
                        </span>
                      </div>
                    </td>
                    <td className="py-3.5 pr-5 text-[13px] font-semibold" style={{ color: GOLD }}>
                      {formatCurrency(v.priorityHealth)}
                    </td>
                    <td className="py-3.5 pr-5 text-[13px] font-semibold" style={{ color: NAVY }}>
                      {formatCurrency(v.propio)}
                    </td>
                    <td className="py-3.5 text-[13px] font-bold" style={{ color: NAVY }}>
                      {formatCurrency(v.priorityHealth + v.propio)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <p className="mt-8 text-center text-[11px]" style={{ color: '#c5cad4' }}>
        Priority CRM &middot; reporte de comisiones
      </p>
    </div>
  )
}
