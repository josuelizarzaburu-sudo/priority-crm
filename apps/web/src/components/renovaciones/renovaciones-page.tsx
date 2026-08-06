'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { RefreshCw, Search, StickyNote } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { api } from '@/lib/api'
import { RenovacionDetalle } from './renovacion-detalle'

const NAVY = '#0C2057'
const GOLD = '#DBAA59'

export const ESTADOS = [
  { valor: 'POR_RENOVAR', label: 'Por renovar', color: '#6B7280' },
  { valor: 'ENVIAR', label: 'Enviar', color: '#B87A15' },
  { valor: 'ENVIADO', label: 'Enviado', color: '#2563EB' },
  { valor: 'EN_PROCESO', label: 'En proceso', color: '#7C3AED' },
  { valor: 'RENOVADO_PAGO_PENDIENTE', label: 'Renovado · pago pendiente', color: '#D97706' },
  { valor: 'RENOVADO', label: 'Renovado', color: '#2E9E63' },
]

export const ENVIOS = [
  { valor: 'NO_ENVIADO', label: 'No enviado' },
  { valor: 'PRIMER_ENVIO', label: 'Primer envío' },
  { valor: 'SEGUNDO_ENVIO', label: 'Segundo envío' },
]

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

export const nombreMes = (clave: string) => {
  const [a, m] = clave.split('-').map(Number)
  return `${MESES[m - 1]} ${a}`
}

const money = (v: any) => {
  const n = Number(v)
  return Number.isFinite(n) && n !== 0 ? `$${n.toFixed(2)}` : '—'
}

// OJO: fechaRenovacion se guarda sin hora (medianoche UTC). Si se formatea sin
// timeZone: 'UTC', el navegador la convierte a hora local (Ecuador, UTC-5) y
// puede mostrar el día anterior o, en casos límite, hacer que un 31 se vea
// como si perteneciera al mes siguiente en el filtro (que sí calcula en UTC).
const fecha = (v: string | null) =>
  v
    ? new Date(v).toLocaleDateString('es-EC', {
        day: '2-digit',
        month: 'short',
        timeZone: 'UTC',
      })
    : '—'

export function RenovacionesPage() {
  const qc = useQueryClient()
  const [mes, setMes] = useState('')
  const [estado, setEstado] = useState('')
  const [search, setSearch] = useState('')
  const [abierta, setAbierta] = useState<any>(null)

  const { data: meses } = useQuery({
    queryKey: ['renovaciones-por-mes'],
    queryFn: async () =>
      (await api.get('/renovaciones/por-mes')).data as {
        mes: string
        total: number
        pendientes: number
      }[],
  })

  const { data, isLoading } = useQuery({
    queryKey: ['renovaciones', mes, estado, search],
    queryFn: async () =>
      (
        await api.get('/renovaciones', {
          params: {
            mes: mes || undefined,
            estado: estado || undefined,
            search: search.trim() || undefined,
          },
        })
      ).data,
  })

  // Crea las renovaciones que falten a partir de las pólizas. Es idempotente:
  // se puede apretar cuantas veces se quiera sin duplicar nada.
  const generar = useMutation({
    mutationFn: async () => (await api.post('/renovaciones/generar')).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['renovaciones'] })
      qc.invalidateQueries({ queryKey: ['renovaciones-por-mes'] })
    },
  })

  const filas = data?.data ?? []

  return (
    <div className="space-y-4">
      {/* Meses: la ejecutiva trabaja agosto durante julio, así que puede
          adelantarse eligiendo cualquier mes. */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setMes('')}
          className="rounded-full border px-3 py-1 text-xs font-medium"
          style={{
            borderColor: mes === '' ? NAVY : '#e5e7eb',
            backgroundColor: mes === '' ? NAVY : '#fff',
            color: mes === '' ? '#fff' : NAVY,
          }}
        >
          Todos los meses
        </button>
        {(meses ?? []).map((m) => (
          <button
            key={m.mes}
            type="button"
            onClick={() => setMes(m.mes)}
            className="rounded-full border px-3 py-1 text-xs font-medium"
            style={{
              borderColor: mes === m.mes ? NAVY : '#e5e7eb',
              backgroundColor: mes === m.mes ? NAVY : '#fff',
              color: mes === m.mes ? '#fff' : NAVY,
            }}
          >
            {nombreMes(m.mes)}
            <span className="ml-1 opacity-70">({m.pendientes})</span>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por cliente, cédula, aseguradora o plan…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2">
          <select
            value={estado}
            onChange={(e) => setEstado(e.target.value)}
            className="h-9 rounded-md border bg-background px-2 text-sm"
          >
            <option value="">Todos los estados</option>
            {ESTADOS.map((e) => (
              <option key={e.valor} value={e.valor}>
                {e.label}
              </option>
            ))}
          </select>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={generar.isPending}
            onClick={() => generar.mutate()}
            title="Busca pólizas sin renovación registrada y las agrega"
          >
            <RefreshCw
              className={`mr-2 h-4 w-4 ${generar.isPending ? 'animate-spin' : ''}`}
            />
            Actualizar desde pólizas
          </Button>
        </div>
      </div>

      {generar.isSuccess && (
        <p className="rounded-md bg-emerald-50 p-2 text-xs text-emerald-700">
          Se revisaron {(generar.data as any)?.revisadas ?? 0} pólizas y se agregaron{' '}
          {(generar.data as any)?.creadas ?? 0} renovaciones.
        </p>
      )}

      {isLoading ? (
        <p className="py-10 text-center text-sm text-muted-foreground">Cargando…</p>
      ) : filas.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          No hay renovaciones para este filtro. Si es la primera vez, usa
          &ldquo;Actualizar desde pólizas&rdquo;.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr style={{ backgroundColor: NAVY, color: '#fff' }}>
                <th className="px-3 py-2 text-left font-semibold">Cliente</th>
                <th className="px-3 py-2 text-left font-semibold">Compañía</th>
                <th className="px-3 py-2 text-left font-semibold">Plan</th>
                <th className="px-3 py-2 text-left font-semibold">Deducible</th>
                <th className="px-3 py-2 text-left font-semibold">Forma de pago</th>
                <th className="px-3 py-2 text-left font-semibold">Renueva</th>
                <th className="px-3 py-2 text-right font-semibold">Actual</th>
                <th className="px-3 py-2 text-right font-semibold">Renovación</th>
                <th className="px-3 py-2 text-right font-semibold">%</th>
                <th className="px-3 py-2 text-left font-semibold">Estado</th>
                <th className="px-3 py-2 text-center font-semibold"></th>
              </tr>
            </thead>
            <tbody>
              {filas.map((r: any, i: number) => {
                const c = r.poliza?.cliente
                const est = ESTADOS.find((e) => e.valor === r.estado)
                const inc = r.incremento
                return (
                  <tr
                    key={r.id}
                    className="cursor-pointer hover:bg-muted/40"
                    style={i % 2 === 1 ? { backgroundColor: '#f8f9fc' } : undefined}
                    onClick={() => setAbierta(r)}
                  >
                    <td className="px-3 py-2 font-medium" style={{ color: NAVY }}>
                      {c ? `${c.nombres} ${c.apellidos ?? ''}`.trim() : '—'}
                    </td>
                    <td className="px-3 py-2">{r.poliza?.aseguradora ?? '—'}</td>
                    <td className="max-w-[160px] truncate px-3 py-2">
                      {r.poliza?.plan ?? '—'}
                    </td>
                    <td className="px-3 py-2">{r.poliza?.deducible ?? '—'}</td>
                    <td className="px-3 py-2">{r.poliza?.formaPago ?? '—'}</td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {fecha(r.fechaRenovacion)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {money(r.valorActual)}
                    </td>
                    <td className="px-3 py-2 text-right font-semibold tabular-nums">
                      {money(r.valorRenovacion)}
                    </td>
                    <td
                      className="px-3 py-2 text-right font-semibold tabular-nums"
                      style={{
                        color: inc == null ? '#9CA3AF' : inc > 0.15 ? '#C24444' : '#2E9E63',
                      }}
                    >
                      {inc == null ? '—' : `${(inc * 100).toFixed(1)}%`}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className="rounded-full border px-2 py-0.5 text-[11px] font-medium"
                        style={{ borderColor: est?.color, color: est?.color }}
                      >
                        {est?.label ?? r.estado}
                      </span>
                    </td>
                    <td className="px-2 py-2 text-center">
                      {(r.comentarios || r.notas?.length > 0) && (
                        <StickyNote className="inline h-3.5 w-3.5" style={{ color: GOLD }} />
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {data && (
        <p className="text-xs text-muted-foreground">
          {data.total} renovaciones{mes ? ` en ${nombreMes(mes)}` : ''}
        </p>
      )}

      {abierta && (
        <RenovacionDetalle id={abierta.id} onCerrar={() => setAbierta(null)} />
      )}
    </div>
  )
}
