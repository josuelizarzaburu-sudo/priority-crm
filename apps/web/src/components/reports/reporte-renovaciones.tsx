'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import * as XLSX from 'xlsx'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { useMeses } from './selector-periodo'
import { Download, TrendingUp } from 'lucide-react'

const NAVY = '#0C2057'
const GOLD = '#DBAA59'
const VERDE = '#15803d'
const ROJO = '#dc2626'
const AMBAR = '#b45309'

const money = (n: number | null) =>
  n === null ? '—' : `$${n.toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

/** Color según cuánto sube: lo que pide atención tiene que verse de lejos. */
function colorIncremento(pct: number | null): string | undefined {
  if (pct === null) return undefined
  if (pct <= 0) return VERDE
  if (pct <= 10) return undefined
  if (pct <= 20) return AMBAR
  return ROJO
}

interface Fila {
  id: string
  cliente: string
  email: string | null
  tipo: string
  aseguradora: string | null
  plan: string | null
  deducible: string | null
  formaPago: string | null
  fechaRenovacion: string
  agente: string | null
  primaActual: number | null
  primaRenovacion: number | null
  incremento: number | null
  diferidoEspecial: number | null
  estado: string
  envio: string
  comentario: string | null
}

interface Datos {
  mes: string | null
  filas: Fila[]
  resumen: {
    total: number
    conPrimaNueva: number
    sinPrimaNueva: number
    primaActualTotal: number
    primaNuevaTotal: number
    incrementoPromedio: number | null
    yaEnviadas: number
  }
  tramos: { rango: string; cantidad: number }[]
  mayoresAlzas: Fila[]
}

export function ReporteRenovaciones() {
  const meses = useMeses()
  const [mes, setMes] = useState(meses[0].valor)
  const [tipo, setTipo] = useState('')

  const { data, isLoading } = useQuery<Datos>({
    queryKey: ['reportes', 'renovaciones', mes, tipo],
    queryFn: () =>
      api
        .get('/reportes/renovaciones', { params: { mes, ...(tipo ? { tipo } : {}) } })
        .then((r) => r.data),
  })

  function exportar() {
    if (!data?.filas.length) return
    const wb = XLSX.utils.book_new()

    // Mismas columnas que el Excel que se llena hoy a mano, para que la reunión
    // mensual no cambie de formato.
    const ws = XLSX.utils.json_to_sheet(
      data.filas.map((f) => ({
        'Nombre del Asegurado': f.cliente,
        'Plan': [f.aseguradora, f.plan].filter(Boolean).join(' ') || '',
        'Forma de Pago': f.formaPago ?? '',
        'Fecha': new Date(f.fechaRenovacion).toLocaleDateString('es-EC'),
        'Agente': f.agente ?? '',
        'Prima actual': f.primaActual ?? '',
        'Prima renovación': f.primaRenovacion ?? '',
        '%': f.incremento === null ? '' : f.incremento / 100,
        'Diferido especial': f.diferidoEspecial ?? '',
        'Comentario': f.comentario ?? '',
      })),
    )
    ws['!cols'] = [
      { wch: 30 }, { wch: 20 }, { wch: 14 }, { wch: 12 }, { wch: 18 },
      { wch: 13 }, { wch: 15 }, { wch: 9 }, { wch: 16 }, { wch: 30 },
    ]
    XLSX.utils.book_append_sheet(wb, ws, 'Renovaciones')
    XLSX.writeFile(wb, `Renovaciones ${mes}.xlsx`)
  }

  const r = data?.resumen

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Mes de renovación</label>
          <select
            value={mes}
            onChange={(e) => setMes(e.target.value)}
            className="h-10 rounded-md border bg-background px-3 text-sm"
          >
            {meses.map((m) => (
              <option key={m.valor} value={m.valor}>
                {m.etiqueta}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Ramo</label>
          <select
            value={tipo}
            onChange={(e) => setTipo(e.target.value)}
            className="h-10 rounded-md border bg-background px-3 text-sm"
          >
            <option value="">Todos</option>
            <option value="SALUD">Salud y vida</option>
            <option value="AUTO">Vehículos</option>
            <option value="HOGAR">Hogar</option>
          </select>
        </div>
        <Button variant="outline" className="ml-auto" onClick={exportar} disabled={!data?.filas.length}>
          <Download className="mr-1.5 h-4 w-4" /> Exportar Excel
        </Button>
      </div>

      {isLoading ? (
        <p className="py-16 text-center text-sm text-muted-foreground">Cargando…</p>
      ) : !data || data.filas.length === 0 ? (
        <div className="rounded-xl border border-dashed py-16 text-center">
          <TrendingUp className="mx-auto h-8 w-8 text-muted-foreground/40" />
          <p className="mt-3 text-sm text-muted-foreground">
            No hay renovaciones en ese mes. Si deberían existir, genéralas desde Renovaciones.
          </p>
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { t: 'Renovaciones del mes', v: String(r!.total) },
              {
                t: 'Incremento promedio',
                v: r!.incrementoPromedio !== null ? `${r!.incrementoPromedio}%` : '—',
                color: colorIncremento(r!.incrementoPromedio),
                destacado: true,
              },
              { t: 'Prima actual', v: money(r!.primaActualTotal) },
              { t: 'Prima renovación', v: money(r!.primaNuevaTotal) },
            ].map((c) => (
              <div
                key={c.t}
                className="rounded-xl border p-4"
                style={c.destacado ? { borderColor: GOLD, backgroundColor: '#fffbf3' } : undefined}
              >
                <p className="text-xs text-muted-foreground">{c.t}</p>
                <p className="mt-1 text-2xl font-bold" style={{ color: c.color ?? NAVY }}>
                  {c.v}
                </p>
              </div>
            ))}
          </div>

          {/* Sin prima nueva no se puede avisar al cliente: es lo primero que hay
              que completar antes de la reunión del mes. */}
          {r!.sinPrimaNueva > 0 && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              <strong>{r!.sinPrimaNueva}</strong> renovación(es) sin la prima nueva cargada. Hasta
              completarla no se puede calcular el incremento ni avisar al cliente.
            </p>
          )}

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl border p-4">
              <p className="mb-1 text-sm font-semibold" style={{ color: NAVY }}>
                Cuánto suben
              </p>
              <p className="mb-3 text-[11px] text-muted-foreground">
                Por encima del 10% el cliente suele preguntar; por encima del 20% conviene llevar
                una alternativa preparada.
              </p>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={data.tramos} margin={{ left: 8, right: 8 }}>
                  <XAxis dataKey="rango" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip labelStyle={{ color: NAVY }} />
                  <Bar dataKey="cantidad" name="Renovaciones" radius={[4, 4, 0, 0]}>
                    {data.tramos.map((_, i) => (
                      <Cell key={i} fill={[VERDE, NAVY, AMBAR, ROJO][i] ?? NAVY} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="rounded-xl border p-4">
              <p className="mb-1 text-sm font-semibold" style={{ color: NAVY }}>
                Las que más suben
              </p>
              <p className="mb-3 text-[11px] text-muted-foreground">
                Revísalas antes de enviar los correos.
              </p>
              <div className="max-h-[240px] space-y-1 overflow-y-auto">
                {data.mayoresAlzas.map((f) => (
                  <div
                    key={f.id}
                    className="flex items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 text-xs"
                  >
                    <span className="min-w-0 flex-1 truncate">{f.cliente}</span>
                    <span className="shrink-0 text-muted-foreground">
                      {money(f.primaActual)} → {money(f.primaRenovacion)}
                    </span>
                    <span
                      className="w-14 shrink-0 text-right font-bold"
                      style={{ color: colorIncremento(f.incremento) }}
                    >
                      {f.incremento! > 0 ? '+' : ''}
                      {f.incremento}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-xl border">
            <p className="border-b p-3.5 text-sm font-semibold" style={{ color: NAVY }}>
              Detalle · {data.filas.length} renovación(es)
              {r!.yaEnviadas > 0 && (
                <span className="ml-2 font-normal text-muted-foreground">
                  {r!.yaEnviadas} ya enviada(s)
                </span>
              )}
            </p>
            <div className="max-h-[460px] overflow-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-muted/95">
                  <tr className="border-b text-left">
                    <th className="p-2 font-medium">Asegurado</th>
                    <th className="p-2 font-medium">Plan</th>
                    <th className="p-2 font-medium">Forma de pago</th>
                    <th className="p-2 font-medium">Fecha</th>
                    <th className="p-2 font-medium">Agente</th>
                    <th className="p-2 text-right font-medium">Actual</th>
                    <th className="p-2 text-right font-medium">Renovación</th>
                    <th className="p-2 text-right font-medium">%</th>
                  </tr>
                </thead>
                <tbody>
                  {data.filas.map((f) => (
                    <tr key={f.id} className="border-b last:border-b-0">
                      <td className="p-2">{f.cliente}</td>
                      <td className="p-2">
                        {[f.aseguradora, f.plan].filter(Boolean).join(' ') || '—'}
                      </td>
                      <td className="p-2">{f.formaPago ?? '—'}</td>
                      <td className="p-2">
                        {new Date(f.fechaRenovacion).toLocaleDateString('es-EC', {
                          day: 'numeric',
                          month: 'short',
                        })}
                      </td>
                      <td className="p-2">{f.agente ?? '—'}</td>
                      <td className="p-2 text-right">{money(f.primaActual)}</td>
                      <td className="p-2 text-right">{money(f.primaRenovacion)}</td>
                      <td
                        className="p-2 text-right font-semibold"
                        style={{ color: colorIncremento(f.incremento) }}
                      >
                        {f.incremento === null
                          ? '—'
                          : `${f.incremento > 0 ? '+' : ''}${f.incremento}%`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
