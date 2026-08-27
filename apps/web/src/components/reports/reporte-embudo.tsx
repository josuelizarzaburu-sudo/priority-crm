'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import * as XLSX from 'xlsx'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { SelectorPeriodo, mesConcreto, type Periodo } from './selector-periodo'
import { Download, Filter } from 'lucide-react'

const NAVY = '#0C2057'
const GOLD = '#DBAA59'
const VERDE = '#15803d'
const ROJO = '#dc2626'
const COLORES = ['#0C2057', '#DBAA59', '#1a3a6b', '#c9974a', '#2d5490', '#e8c888']

const money = (n: number) =>
  `$${n.toLocaleString('es-EC', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`

interface DatosEmbudo {
  porEtapa: { etapa: string; posicion: number; leads: number; valor: number }[]
  resumen: {
    total: number
    abiertos: number
    ganados: number
    perdidos: number
    valorEnJuego: number
    conversion: number | null
  }
  porAgente: {
    nombre: string
    abiertos: number
    ganados: number
    perdidos: number
    valor: number
  }[]
  motivosPerdida: { motivo: string; cantidad: number }[]
}

interface DatosTiempos {
  filas: {
    dealId: string
    cliente: string
    agente: string
    ganado: boolean
    dias: number
    entroEn: string
    cerradoEn: string
  }[]
  resumen: {
    cerrados: number
    ganados: number
    promedioGanados: number | null
    medianaGanados: number | null
    masRapido: number | null
    masLento: number | null
  }
  tramos: { rango: string; cantidad: number }[]
  porAgente: { nombre: string; cerrados: number; promedio: number; mediana: number | null }[]
}

function mesActual(): Periodo {
  const h = new Date()
  return mesConcreto(`${h.getFullYear()}-${String(h.getMonth() + 1).padStart(2, '0')}`)
}

export function ReporteEmbudo() {
  const [periodo, setPeriodo] = useState<Periodo>(mesActual())
  const [agenteId, setAgenteId] = useState('')

  const { data: agentes = [] } = useQuery<{ id: string; name: string }[]>({
    queryKey: ['reportes', 'agentes'],
    queryFn: () => api.get('/reportes/agentes').then((r) => r.data),
  })

  const params = { desde: periodo.desde, hasta: periodo.hasta, ...(agenteId ? { agenteId } : {}) }

  const { data, isLoading } = useQuery<DatosEmbudo>({
    queryKey: ['reportes', 'embudo', params],
    queryFn: () => api.get('/reportes/embudo', { params }).then((r) => r.data),
  })

  function exportar() {
    if (!data) return
    const wb = XLSX.utils.book_new()

    const ws = XLSX.utils.json_to_sheet(
      data.porEtapa.map((e) => ({
        'Etapa': e.etapa,
        'Leads': e.leads,
        'Valor en juego': e.valor,
      })),
    )
    ws['!cols'] = [{ wch: 22 }, { wch: 10 }, { wch: 16 }]
    XLSX.utils.book_append_sheet(wb, ws, 'Por etapa')

    const ws2 = XLSX.utils.json_to_sheet(
      data.porAgente.map((a) => ({
        'Agente': a.nombre,
        'Abiertos': a.abiertos,
        'Ganados': a.ganados,
        'Perdidos': a.perdidos,
        'Valor en juego': a.valor,
      })),
    )
    ws2['!cols'] = [{ wch: 24 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 16 }]
    XLSX.utils.book_append_sheet(wb, ws2, 'Por agente')

    if (data.motivosPerdida.length) {
      const ws3 = XLSX.utils.json_to_sheet(
        data.motivosPerdida.map((m) => ({ 'Motivo': m.motivo, 'Cantidad': m.cantidad })),
      )
      ws3['!cols'] = [{ wch: 44 }, { wch: 10 }]
      XLSX.utils.book_append_sheet(wb, ws3, 'Motivos de pérdida')
    }

    XLSX.writeFile(wb, `Embudo ${periodo.etiqueta}.xlsx`)
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-3">
        <SelectorPeriodo valor={periodo} onCambio={setPeriodo} />
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Agente</label>
          <select
            value={agenteId}
            onChange={(e) => setAgenteId(e.target.value)}
            className="h-10 rounded-md border bg-background px-3 text-sm"
          >
            <option value="">Todos</option>
            {agentes.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>
        <Button variant="outline" className="ml-auto" onClick={exportar} disabled={!data}>
          <Download className="mr-1.5 h-4 w-4" /> Exportar Excel
        </Button>
      </div>

      {isLoading ? (
        <p className="py-16 text-center text-sm text-muted-foreground">Cargando…</p>
      ) : !data || data.resumen.total === 0 ? (
        <div className="rounded-xl border border-dashed py-16 text-center">
          <Filter className="mx-auto h-8 w-8 text-muted-foreground/40" />
          <p className="mt-3 text-sm text-muted-foreground">
            No entraron leads en {periodo.etiqueta}.
          </p>
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {[
              { t: 'Leads del período', v: String(data.resumen.total) },
              { t: 'Abiertos', v: String(data.resumen.abiertos) },
              { t: 'Ganados', v: String(data.resumen.ganados), color: VERDE },
              { t: 'Perdidos', v: String(data.resumen.perdidos), color: ROJO },
              {
                t: 'Conversión',
                v: data.resumen.conversion !== null ? `${data.resumen.conversion}%` : '—',
                destacado: true,
              },
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

          <p className="text-xs text-muted-foreground">
            La conversión se calcula sobre los negocios ya cerrados
            {data.resumen.abiertos > 0
              ? `; los ${data.resumen.abiertos} abiertos todavía no cuentan.`
              : '.'}{' '}
            Valor en juego: <strong style={{ color: NAVY }}>{money(data.resumen.valorEnJuego)}</strong>
          </p>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl border p-4">
              <p className="mb-3 text-sm font-semibold" style={{ color: NAVY }}>
                Leads abiertos por etapa
              </p>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={data.porEtapa} layout="vertical" margin={{ left: 8, right: 16 }}>
                  <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                  <YAxis type="category" dataKey="etapa" tick={{ fontSize: 11 }} width={110} />
                  <Tooltip labelStyle={{ color: NAVY }} />
                  <Bar dataKey="leads" name="Leads" fill={NAVY} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="rounded-xl border p-4">
              <p className="mb-3 text-sm font-semibold" style={{ color: NAVY }}>
                Valor en juego por etapa
              </p>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={data.porEtapa} layout="vertical" margin={{ left: 8, right: 16 }}>
                  <XAxis
                    type="number"
                    tick={{ fontSize: 11 }}
                    tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                  />
                  <YAxis type="category" dataKey="etapa" tick={{ fontSize: 11 }} width={110} />
                  <Tooltip formatter={(v: number) => money(v)} labelStyle={{ color: NAVY }} />
                  <Bar dataKey="valor" name="Valor" fill={GOLD} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-xl border">
            <p className="border-b p-3.5 text-sm font-semibold" style={{ color: NAVY }}>
              Por agente
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 text-left text-xs">
                    <th className="p-2.5 font-medium">Agente</th>
                    <th className="p-2.5 text-right font-medium">Abiertos</th>
                    <th className="p-2.5 text-right font-medium">Ganados</th>
                    <th className="p-2.5 text-right font-medium">Perdidos</th>
                    <th className="p-2.5 text-right font-medium">Conversión</th>
                    <th className="p-2.5 text-right font-medium">Valor en juego</th>
                  </tr>
                </thead>
                <tbody>
                  {data.porAgente.map((a) => {
                    const cerrados = a.ganados + a.perdidos
                    const conv = cerrados ? Math.round((a.ganados / cerrados) * 100) : null
                    return (
                      <tr key={a.nombre} className="border-b last:border-b-0">
                        <td className="p-2.5">{a.nombre}</td>
                        <td className="p-2.5 text-right">{a.abiertos}</td>
                        <td className="p-2.5 text-right" style={{ color: VERDE }}>
                          {a.ganados}
                        </td>
                        <td className="p-2.5 text-right" style={{ color: ROJO }}>
                          {a.perdidos}
                        </td>
                        <td className="p-2.5 text-right font-medium" style={{ color: NAVY }}>
                          {conv !== null ? `${conv}%` : '—'}
                        </td>
                        <td className="p-2.5 text-right">{money(a.valor)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Motivos de perdida: es lo mas util de los negocios que no salieron,
              y hasta ahora no se veia en ningun reporte. */}
          {data.motivosPerdida.length > 0 && (
            <div className="rounded-xl border p-4">
              <p className="mb-3 text-sm font-semibold" style={{ color: NAVY }}>
                Por qué se perdieron
              </p>
              <div className="space-y-1.5">
                {data.motivosPerdida.map((m) => (
                  <div
                    key={m.motivo}
                    className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm"
                  >
                    <span className="min-w-0 flex-1">{m.motivo}</span>
                    <span className="shrink-0 font-semibold" style={{ color: ROJO }}>
                      {m.cantidad}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

export function ReporteTiempos() {
  const [periodo, setPeriodo] = useState<Periodo>(mesActual())
  const [agenteId, setAgenteId] = useState('')

  const { data: agentes = [] } = useQuery<{ id: string; name: string }[]>({
    queryKey: ['reportes', 'agentes'],
    queryFn: () => api.get('/reportes/agentes').then((r) => r.data),
  })

  const params = { desde: periodo.desde, hasta: periodo.hasta, ...(agenteId ? { agenteId } : {}) }

  const { data, isLoading } = useQuery<DatosTiempos>({
    queryKey: ['reportes', 'tiempos', params],
    queryFn: () => api.get('/reportes/tiempos', { params }).then((r) => r.data),
  })

  function exportar() {
    if (!data?.filas.length) return
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.json_to_sheet(
      data.filas.map((f) => ({
        'Cliente': f.cliente,
        'Agente': f.agente,
        'Resultado': f.ganado ? 'Ganado' : 'Perdido',
        'Días hasta cierre': f.dias,
        'Entró': new Date(f.entroEn).toLocaleDateString('es-EC'),
        'Cerró': new Date(f.cerradoEn).toLocaleDateString('es-EC'),
      })),
    )
    ws['!cols'] = [{ wch: 28 }, { wch: 22 }, { wch: 12 }, { wch: 18 }, { wch: 12 }, { wch: 12 }]
    XLSX.utils.book_append_sheet(wb, ws, 'Tiempos')

    const ws2 = XLSX.utils.json_to_sheet(
      data.porAgente.map((a) => ({
        'Agente': a.nombre,
        'Negocios ganados': a.cerrados,
        'Promedio (días)': a.promedio,
        'Mediana (días)': a.mediana ?? '',
      })),
    )
    ws2['!cols'] = [{ wch: 24 }, { wch: 18 }, { wch: 16 }, { wch: 16 }]
    XLSX.utils.book_append_sheet(wb, ws2, 'Por agente')

    XLSX.writeFile(wb, `Tiempos de cierre ${periodo.etiqueta}.xlsx`)
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-3">
        <SelectorPeriodo valor={periodo} onCambio={setPeriodo} />
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Agente</label>
          <select
            value={agenteId}
            onChange={(e) => setAgenteId(e.target.value)}
            className="h-10 rounded-md border bg-background px-3 text-sm"
          >
            <option value="">Todos</option>
            {agentes.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>
        <Button
          variant="outline"
          className="ml-auto"
          onClick={exportar}
          disabled={!data?.filas.length}
        >
          <Download className="mr-1.5 h-4 w-4" /> Exportar Excel
        </Button>
      </div>

      {isLoading ? (
        <p className="py-16 text-center text-sm text-muted-foreground">Cargando…</p>
      ) : !data || data.filas.length === 0 ? (
        <div className="rounded-xl border border-dashed py-16 text-center">
          <p className="text-sm text-muted-foreground">
            No se cerraron negocios en {periodo.etiqueta}.
          </p>
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                t: 'Promedio de cierre',
                v: data.resumen.promedioGanados !== null ? `${data.resumen.promedioGanados} días` : '—',
                destacado: true,
              },
              {
                t: 'Mediana',
                v: data.resumen.medianaGanados !== null ? `${data.resumen.medianaGanados} días` : '—',
              },
              {
                t: 'El más rápido',
                v: data.resumen.masRapido !== null ? `${data.resumen.masRapido} días` : '—',
              },
              {
                t: 'El más lento',
                v: data.resumen.masLento !== null ? `${data.resumen.masLento} días` : '—',
              },
            ].map((c) => (
              <div
                key={c.t}
                className="rounded-xl border p-4"
                style={c.destacado ? { borderColor: GOLD, backgroundColor: '#fffbf3' } : undefined}
              >
                <p className="text-xs text-muted-foreground">{c.t}</p>
                <p className="mt-1 text-2xl font-bold" style={{ color: NAVY }}>
                  {c.v}
                </p>
              </div>
            ))}
          </div>

          {/* La mediana importa: un solo negocio que tardo ocho meses arrastra el
              promedio y da una idea equivocada del caso tipico. */}
          <p className="text-xs text-muted-foreground">
            Se mide desde que entra el lead hasta que se cierra, sin importar las etapas. La
            mediana es el caso típico: si difiere mucho del promedio, hay negocios sueltos que
            tardaron demasiado.
          </p>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl border p-4">
              <p className="mb-3 text-sm font-semibold" style={{ color: NAVY }}>
                En cuánto se cierran
              </p>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={data.tramos} margin={{ left: 8, right: 8 }}>
                  <XAxis dataKey="rango" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip labelStyle={{ color: NAVY }} />
                  <Bar dataKey="cantidad" name="Negocios" fill={NAVY} radius={[4, 4, 0, 0]}>
                    {data.tramos.map((_, i) => (
                      <Cell key={i} fill={COLORES[i % COLORES.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="rounded-xl border p-4">
              <p className="mb-3 text-sm font-semibold" style={{ color: NAVY }}>
                Días promedio por agente
              </p>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={data.porAgente} layout="vertical" margin={{ left: 8, right: 16 }}>
                  <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                  <YAxis type="category" dataKey="nombre" tick={{ fontSize: 11 }} width={110} />
                  <Tooltip labelStyle={{ color: NAVY }} />
                  <Bar dataKey="promedio" name="Días" fill={GOLD} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-xl border">
            <p className="border-b p-3.5 text-sm font-semibold" style={{ color: NAVY }}>
              Detalle · {data.filas.length} negocio{data.filas.length === 1 ? '' : 's'} cerrado
              {data.filas.length === 1 ? '' : 's'}
            </p>
            <div className="max-h-[420px] overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-muted/95">
                  <tr className="border-b text-left text-xs">
                    <th className="p-2.5 font-medium">Cliente</th>
                    <th className="p-2.5 font-medium">Agente</th>
                    <th className="p-2.5 font-medium">Resultado</th>
                    <th className="p-2.5 text-right font-medium">Días</th>
                  </tr>
                </thead>
                <tbody>
                  {data.filas.map((f) => (
                    <tr key={f.dealId} className="border-b last:border-b-0">
                      <td className="p-2.5">{f.cliente}</td>
                      <td className="p-2.5">{f.agente}</td>
                      <td className="p-2.5" style={{ color: f.ganado ? VERDE : ROJO }}>
                        {f.ganado ? 'Ganado' : 'Perdido'}
                      </td>
                      <td className="p-2.5 text-right font-medium" style={{ color: NAVY }}>
                        {f.dias}
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
