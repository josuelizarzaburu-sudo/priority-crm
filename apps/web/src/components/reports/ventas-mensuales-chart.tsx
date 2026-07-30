'use client'

import { useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { RAMOS, type RamoId } from '@/lib/ramos-seguros'

const NAVY = '#0C2057'
const GOLD = '#DBAA59'

// Un color por ramo. Salud lleva el navy de marca y auto el dorado, que son los
// dos ramos de mayor volumen.
export const COLOR_RAMO: Record<RamoId, string> = {
  SALUD: NAVY,
  AUTO: GOLD,
  VIDA: '#5FA8D3',
  HOGAR: '#7BC96F',
}

export const SIN_CLASIFICAR = 'Sin clasificar'
const COLOR_SIN_CLASIFICAR = '#B8BFCC'

export interface DealVenta {
  status?: string
  value?: number | null
  closedAt?: string | null
  customFields?: any
}

const money = (n: number) =>
  n.toLocaleString('es-EC', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

/**
 * Reparte el valor de un deal ganado entre los ramos que se vendieron.
 *
 * Un cierre puede tener varias polizas de ramos distintos. Si traen prima, el
 * valor se reparte proporcionalmente; si no, se parte en partes iguales. Los
 * deals cerrados antes de que existiera el campo ramo caen en "Sin clasificar",
 * que es honesto: no se inventa a que producto pertenecian.
 */
export function repartirPorRamo(deal: DealVenta): Record<string, number> {
  const total = deal.value ?? 0
  const raw = deal.customFields?.insuranceData
  const entradas: any[] = Array.isArray(raw) ? raw : raw ? [raw] : []
  const conRamo = entradas.filter((e) => e?.ramo)

  if (conRamo.length === 0) return { [SIN_CLASIFICAR]: total }

  const primas = conRamo.map((e) => Number(e?.netPremium) || 0)
  const sumaPrimas = primas.reduce((s, p) => s + p, 0)

  const out: Record<string, number> = {}
  conRamo.forEach((e, i) => {
    const parte =
      sumaPrimas > 0 ? total * (primas[i] / sumaPrimas) : total / conRamo.length
    out[e.ramo] = (out[e.ramo] ?? 0) + parte
  })
  return out
}

export function VentasMensualesChart({
  deals,
  titulo = 'Ventas por mes',
  meses = 12,
}: {
  deals: DealVenta[]
  titulo?: string
  meses?: number
}) {
  const [filtro, setFiltro] = useState<RamoId | 'TODOS'>('TODOS')

  const { data, esteMes, mesAnterior } = useMemo(() => {
    const ganados = deals.filter((d) => d.status === 'WON' && d.closedAt)

    // Se arman los ultimos N meses aunque esten vacios, para que el hueco se vea.
    const ahora = new Date()
    const cubos: { key: string; label: string; total: number; [k: string]: any }[] = []
    for (let i = meses - 1; i >= 0; i--) {
      const d = new Date(ahora.getFullYear(), ahora.getMonth() - i, 1)
      cubos.push({
        key: `${d.getFullYear()}-${d.getMonth()}`,
        label: `${MESES[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`,
        total: 0,
      })
    }
    const indice = new Map(cubos.map((c, i) => [c.key, i]))

    for (const deal of ganados) {
      const f = new Date(deal.closedAt as string)
      const pos = indice.get(`${f.getFullYear()}-${f.getMonth()}`)
      if (pos == null) continue
      const porRamo = repartirPorRamo(deal)
      for (const [ramo, monto] of Object.entries(porRamo)) {
        if (filtro !== 'TODOS' && ramo !== filtro) continue
        cubos[pos][ramo] = (cubos[pos][ramo] ?? 0) + monto
        cubos[pos].total += monto
      }
    }

    const n = cubos.length
    return {
      data: cubos,
      esteMes: n > 0 ? cubos[n - 1].total : 0,
      mesAnterior: n > 1 ? cubos[n - 2].total : 0,
    }
  }, [deals, filtro, meses])

  // Solo se dibujan las series que tienen algo, para no llenar la leyenda de ceros.
  const series = useMemo(() => {
    const presentes = new Set<string>()
    for (const c of data) {
      for (const k of Object.keys(c)) {
        if (k !== 'key' && k !== 'label' && k !== 'total' && (c[k] ?? 0) > 0) presentes.add(k)
      }
    }
    return [...presentes]
  }, [data])

  const diff = esteMes - mesAnterior
  const pct = mesAnterior > 0 ? Math.round((diff / mesAnterior) * 100) : null

  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold" style={{ color: NAVY }}>
            {titulo}
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {money(esteMes)} este mes ·{' '}
            {mesAnterior === 0 && esteMes === 0 ? (
              'sin ventas el mes anterior'
            ) : (
              <span className={diff >= 0 ? 'text-emerald-600' : 'text-red-600'}>
                {diff >= 0 ? '▲' : '▼'} {money(Math.abs(diff))}
                {pct !== null ? ` (${Math.abs(pct)}%)` : ''} vs. mes anterior
              </span>
            )}
          </p>
        </div>

        <div className="flex flex-wrap gap-1">
          <FiltroBtn activo={filtro === 'TODOS'} onClick={() => setFiltro('TODOS')}>
            Todos
          </FiltroBtn>
          {RAMOS.map((r) => (
            <FiltroBtn key={r.id} activo={filtro === r.id} onClick={() => setFiltro(r.id)}>
              {r.label}
            </FiltroBtn>
          ))}
        </div>
      </div>

      {series.length === 0 ? (
        <p className="py-10 text-center text-xs text-muted-foreground">
          Todavía no hay ventas registradas en este periodo.
        </p>
      ) : (
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 4, right: 4, left: -12, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => (v >= 1000 ? `${v / 1000}k` : String(v))}
              />
              <Tooltip
                formatter={(v: number, name: string) => [money(v), name]}
                contentStyle={{ fontSize: 12, borderRadius: 8 }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {series.map((s) => (
                <Bar
                  key={s}
                  dataKey={s}
                  stackId="a"
                  name={
                    s === SIN_CLASIFICAR
                      ? SIN_CLASIFICAR
                      : (RAMOS.find((r) => r.id === s)?.label ?? s)
                  }
                  fill={
                    s === SIN_CLASIFICAR
                      ? COLOR_SIN_CLASIFICAR
                      : (COLOR_RAMO[s as RamoId] ?? COLOR_SIN_CLASIFICAR)
                  }
                  radius={[3, 3, 0, 0]}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {series.includes(SIN_CLASIFICAR) && (
        <p className="mt-2 text-[11px] text-muted-foreground">
          &ldquo;Sin clasificar&rdquo; son ventas cerradas antes de que se pidiera el ramo.
        </p>
      )}
    </div>
  )
}

function FiltroBtn({
  activo,
  onClick,
  children,
}: {
  activo: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors"
      style={{
        borderColor: activo ? GOLD : '#e5e7eb',
        backgroundColor: activo ? GOLD : '#fff',
        color: activo ? '#fff' : NAVY,
      }}
    >
      {children}
    </button>
  )
}
