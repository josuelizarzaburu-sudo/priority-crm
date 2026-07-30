'use client'

import { useMemo, useState } from 'react'
import { useQueries } from '@tanstack/react-query'
import { Trophy } from 'lucide-react'
import { api } from '@/lib/api'
import { RAMOS, type RamoId } from '@/lib/ramos-seguros'
import {
  repartirPorRamo,
  SIN_CLASIFICAR,
  COLOR_RAMO,
  type DealVenta,
} from '@/components/reports/ventas-mensuales-chart'

const NAVY = '#0C2057'
const GOLD = '#DBAA59'

interface Deal extends DealVenta {
  assignedToId?: string | null
  assignedTo?: { id: string; name: string } | null
}
interface Agent {
  id: string
  name: string
  role: string
}

const money = (n: number) =>
  n.toLocaleString('es-EC', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })

// Medallas para el podio. Del cuarto en adelante va el número.
const PODIO = ['🥇', '🥈', '🥉']

type Periodo = 'mes' | 'anio' | 'todo'

export function RankingPage() {
  const [filtro, setFiltro] = useState<RamoId | 'TODOS'>('TODOS')
  const [periodo, setPeriodo] = useState<Periodo>('mes')

  const results = useQueries({
    queries: [
      {
        queryKey: ['pipeline', 'deals-all'],
        queryFn: () => api.get('/pipeline/deals').then((r) => r.data as Deal[]),
      },
      { queryKey: ['users'], queryFn: () => api.get('/users').then((r) => r.data as Agent[]) },
    ],
  })

  const deals = results[0].data ?? []
  const agents = results[1].data ?? []
  const isLoading = results.some((r) => r.isLoading)

  const filas = useMemo(() => {
    const ahora = new Date()
    const desde =
      periodo === 'mes'
        ? new Date(ahora.getFullYear(), ahora.getMonth(), 1)
        : periodo === 'anio'
          ? new Date(ahora.getFullYear(), 0, 1)
          : null

    // Se parte del listado de usuarios para que un vendedor sin ventas aparezca
    // igual, en cero. Si solo se recorrieran los deals, desapareceria del ranking
    // justo el mes que mas hay que conversar con el.
    const porVendedor = new Map<string, { nombre: string; total: number; ramos: Record<string, number> }>()
    for (const a of agents) {
      if (a.role !== 'SALES_REP') continue
      porVendedor.set(a.id, { nombre: a.name, total: 0, ramos: {} })
    }

    for (const d of deals) {
      if (d.status !== 'WON' || !d.closedAt) continue
      if (desde && new Date(d.closedAt) < desde) continue
      const id = d.assignedTo?.id ?? d.assignedToId
      if (!id) continue
      const acc =
        porVendedor.get(id) ??
        (() => {
          // Vendedor que ya no esta en la lista de usuarios (se elimino o cambio
          // de rol) pero que tiene ventas: igual cuenta, con el nombre del deal.
          const nuevo = {
            nombre: d.assignedTo?.name ?? 'Sin asignar',
            total: 0,
            ramos: {} as Record<string, number>,
          }
          porVendedor.set(id, nuevo)
          return nuevo
        })()

      for (const [ramo, monto] of Object.entries(repartirPorRamo(d))) {
        if (filtro !== 'TODOS' && ramo !== filtro) continue
        acc.ramos[ramo] = (acc.ramos[ramo] ?? 0) + monto
        acc.total += monto
      }
    }

    return [...porVendedor.values()].sort((a, b) => b.total - a.total)
  }, [deals, agents, filtro, periodo])

  const maximo = filas[0]?.total ?? 0
  const totalGeneral = filas.reduce((s, f) => s + f.total, 0)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1">
          <Chip activo={periodo === 'mes'} onClick={() => setPeriodo('mes')}>
            Este mes
          </Chip>
          <Chip activo={periodo === 'anio'} onClick={() => setPeriodo('anio')}>
            Este año
          </Chip>
          <Chip activo={periodo === 'todo'} onClick={() => setPeriodo('todo')}>
            Histórico
          </Chip>
        </div>
        <div className="flex flex-wrap gap-1">
          <Chip activo={filtro === 'TODOS'} onClick={() => setFiltro('TODOS')}>
            Todos
          </Chip>
          {RAMOS.map((r) => (
            <Chip key={r.id} activo={filtro === r.id} onClick={() => setFiltro(r.id)}>
              {r.label}
            </Chip>
          ))}
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Total del periodo: <span className="font-semibold">{money(totalGeneral)}</span>
      </p>

      {isLoading ? (
        <p className="py-12 text-center text-sm text-muted-foreground">Cargando…</p>
      ) : filas.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          Todavía no hay vendedores registrados.
        </p>
      ) : (
        <div className="space-y-2">
          {filas.map((f, i) => {
            const pct = maximo > 0 ? (f.total / maximo) * 100 : 0
            const lider = i === 0 && f.total > 0
            return (
              <div
                key={f.nombre + i}
                className="rounded-xl border bg-card p-3 transition-shadow hover:shadow-sm"
                style={lider ? { borderColor: GOLD, borderWidth: 2 } : undefined}
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 shrink-0 text-center text-lg">
                    {i < 3 && f.total > 0 ? (
                      PODIO[i]
                    ) : (
                      <span className="text-sm font-semibold text-muted-foreground">{i + 1}</span>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span
                        className="truncate text-sm font-semibold"
                        style={{ color: lider ? GOLD : NAVY }}
                      >
                        {f.nombre}
                        {lider && <Trophy className="ml-1 inline h-3.5 w-3.5" />}
                      </span>
                      <span className="shrink-0 text-sm font-bold" style={{ color: NAVY }}>
                        {money(f.total)}
                      </span>
                    </div>

                    {/* Barra apilada: de un vistazo se ve quien vende mas y de que */}
                    <div className="mt-1.5 flex h-2 w-full overflow-hidden rounded-full bg-muted">
                      {f.total > 0 &&
                        Object.entries(f.ramos)
                          .sort((a, b) => b[1] - a[1])
                          .map(([ramo, monto]) => (
                            <div
                              key={ramo}
                              style={{
                                width: `${(monto / f.total) * pct}%`,
                                backgroundColor:
                                  ramo === SIN_CLASIFICAR
                                    ? '#B8BFCC'
                                    : (COLOR_RAMO[ramo as RamoId] ?? '#B8BFCC'),
                              }}
                              title={`${ramo}: ${money(monto)}`}
                            />
                          ))}
                    </div>

                    {f.total > 0 && (
                      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                        {Object.entries(f.ramos)
                          .sort((a, b) => b[1] - a[1])
                          .map(([ramo, monto]) => (
                            <span
                              key={ramo}
                              className="text-[11px] text-muted-foreground"
                            >
                              <span
                                className="mr-1 inline-block h-2 w-2 rounded-full align-middle"
                                style={{
                                  backgroundColor:
                                    ramo === SIN_CLASIFICAR
                                      ? '#B8BFCC'
                                      : (COLOR_RAMO[ramo as RamoId] ?? '#B8BFCC'),
                                }}
                              />
                              {ramo === SIN_CLASIFICAR
                                ? SIN_CLASIFICAR
                                : (RAMOS.find((r) => r.id === ramo)?.label ?? ramo)}{' '}
                              {money(monto)}
                            </span>
                          ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function Chip({
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
