'use client'

import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import * as XLSX from 'xlsx'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Download, TrendingUp } from 'lucide-react'

const NAVY = '#0C2057'
const GOLD = '#DBAA59'

/** Paleta para los gráficos por categoría. Navy y dorado primero, que son la marca. */
const COLORES = ['#0C2057', '#DBAA59', '#1a3a6b', '#c9974a', '#2d5490', '#e8c888', '#4a7ab8', '#8a6a30']

interface FilaVenta {
  dealId: string
  titular: string
  aseguradora: string | null
  plan: string | null
  ramo: string | null
  vigencia: string | null
  formaPago: string | null
  primaAnual: number
  agenteId: string | null
  agente: string
  origen: string
  cerradoEn: string | null
  diasHastaCierre: number | null
}

interface Grupo {
  nombre: string
  ventas: number
  prima: number
  negocios: number
}

interface Datos {
  filas: FilaVenta[]
  resumen: {
    ventas: number
    negocios: number
    primaTotal: number
    primaPromedio: number
    diasPromedioCierre: number | null
  }
  porAgente: Grupo[]
  porAseguradora: Grupo[]
  porOrigen: Grupo[]
}

const money = (n: number) =>
  `$${n.toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const fecha = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString('es-EC', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        timeZone: 'UTC',
      })
    : '—'

/** Últimos 12 meses como opciones de filtro. */
function ultimosMeses() {
  const hoy = new Date()
  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1)
    const valor = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const etiqueta = d.toLocaleDateString('es-EC', { month: 'long', year: 'numeric' })
    return { valor, etiqueta: etiqueta.charAt(0).toUpperCase() + etiqueta.slice(1) }
  })
}

/** Primer y último día del mes, como YYYY-MM-DD. */
function rangoDelMes(mes: string) {
  const [a, m] = mes.split('-').map(Number)
  const ultimo = new Date(a, m, 0).getDate()
  return { desde: `${mes}-01`, hasta: `${mes}-${String(ultimo).padStart(2, '0')}` }
}

export function ReporteVentas() {
  const meses = useMemo(() => ultimosMeses(), [])
  const [mes, setMes] = useState(meses[0].valor)
  const [agenteId, setAgenteId] = useState('')

  const { desde, hasta } = rangoDelMes(mes)

  const { data: agentes = [] } = useQuery<{ id: string; name: string }[]>({
    queryKey: ['reportes', 'agentes'],
    queryFn: () => api.get('/reportes/agentes').then((r) => r.data),
  })

  const { data, isLoading } = useQuery<Datos>({
    queryKey: ['reportes', 'ventas', desde, hasta, agenteId],
    queryFn: () =>
      api
        .get('/reportes/ventas', { params: { desde, hasta, ...(agenteId ? { agenteId } : {}) } })
        .then((r) => r.data),
  })

  /**
   * Exportación a Excel: SOLO los datos, sin gráficos.
   *
   * Es lo que pidió Josue y además es lo correcto: los gráficos viven en el CRM,
   * donde se pueden filtrar; en una hoja de cálculo, cada quien arma los suyos.
   */
  function exportar() {
    if (!data?.filas.length) return

    const hoja = data.filas.map((f) => ({
      'Titular': f.titular,
      'Compañía': f.aseguradora ?? '',
      'Plan contratado': f.plan ?? '',
      'Ramo': f.ramo ?? '',
      'Fecha vigencia': fecha(f.vigencia),
      'Forma de pago': f.formaPago ?? '',
      'Prima anual': f.primaAnual,
      'Agente': f.agente,
      'Origen': f.origen,
      'Fecha de cierre': fecha(f.cerradoEn),
      'Días hasta cierre': f.diasHastaCierre ?? '',
    }))

    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.json_to_sheet(hoja)
    // Anchos a mano: por defecto las columnas salen tan angostas que los nombres
    // y los planes se cortan, y hay que ajustarlas una por una al abrir.
    ws['!cols'] = [
      { wch: 28 }, { wch: 16 }, { wch: 30 }, { wch: 12 }, { wch: 14 },
      { wch: 18 }, { wch: 13 }, { wch: 22 }, { wch: 15 }, { wch: 14 }, { wch: 16 },
    ]
    XLSX.utils.book_append_sheet(wb, ws, 'Ventas')

    // Segunda hoja con los totales por agente y por compañía: son los que se
    // llevan a una reunión, y recalcularlos a mano desde el detalle es trabajo
    // que ya está hecho.
    const resumen = [
      { Concepto: 'Ventas (pólizas)', Valor: data.resumen.ventas },
      { Concepto: 'Negocios cerrados', Valor: data.resumen.negocios },
      { Concepto: 'Prima total', Valor: data.resumen.primaTotal },
      { Concepto: 'Prima promedio', Valor: Math.round(data.resumen.primaPromedio * 100) / 100 },
      { Concepto: 'Días promedio de cierre', Valor: data.resumen.diasPromedioCierre ?? '' },
      {},
      { Concepto: 'POR AGENTE', Valor: '' },
      ...data.porAgente.map((a) => ({ Concepto: a.nombre, Valor: a.prima, Ventas: a.ventas })),
      {},
      { Concepto: 'POR COMPAÑÍA', Valor: '' },
      ...data.porAseguradora.map((a) => ({ Concepto: a.nombre, Valor: a.prima, Ventas: a.ventas })),
    ]
    const ws2 = XLSX.utils.json_to_sheet(resumen)
    ws2['!cols'] = [{ wch: 28 }, { wch: 16 }, { wch: 10 }]
    XLSX.utils.book_append_sheet(wb, ws2, 'Resumen')

    const etiqueta = meses.find((m) => m.valor === mes)?.etiqueta ?? mes
    XLSX.writeFile(wb, `Ventas ${etiqueta}${agenteId ? ' - filtrado' : ''}.xlsx`)
  }

  const nombreAgente = agentes.find((a) => a.id === agenteId)?.name

  return (
    <div className="w-full space-y-5">
      {/* Filtros */}
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Mes</label>
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
          <TrendingUp className="mx-auto h-8 w-8 text-muted-foreground/40" />
          <p className="mt-3 text-sm text-muted-foreground">
            No hay ventas cerradas en {meses.find((m) => m.valor === mes)?.etiqueta}
            {nombreAgente ? ` para ${nombreAgente}` : ''}.
          </p>
        </div>
      ) : (
        <>
          {/* Totales */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { t: 'Prima anual total', v: money(data.resumen.primaTotal), destacado: true },
              { t: 'Ventas (pólizas)', v: String(data.resumen.ventas) },
              { t: 'Negocios cerrados', v: String(data.resumen.negocios) },
              {
                t: 'Días promedio de cierre',
                v: data.resumen.diasPromedioCierre !== null
                  ? `${data.resumen.diasPromedioCierre} días`
                  : '—',
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

          {/* Gráficos */}
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl border p-4">
              <p className="mb-3 text-sm font-semibold" style={{ color: NAVY }}>
                Prima por agente
              </p>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={data.porAgente} margin={{ left: 8, right: 8 }}>
                  <XAxis
                    dataKey="nombre"
                    tick={{ fontSize: 11 }}
                    interval={0}
                    angle={-20}
                    textAnchor="end"
                    height={60}
                  />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                  <Tooltip
                    formatter={(v: number, n) => (n === 'prima' ? money(v) : v)}
                    labelStyle={{ color: NAVY }}
                  />
                  <Bar dataKey="prima" name="Prima" fill={NAVY} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="rounded-xl border p-4">
              <p className="mb-3 text-sm font-semibold" style={{ color: NAVY }}>
                Ventas por agente
              </p>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={data.porAgente} margin={{ left: 8, right: 8 }}>
                  <XAxis
                    dataKey="nombre"
                    tick={{ fontSize: 11 }}
                    interval={0}
                    angle={-20}
                    textAnchor="end"
                    height={60}
                  />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip labelStyle={{ color: NAVY }} />
                  <Bar dataKey="ventas" name="Pólizas" fill={GOLD} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="rounded-xl border p-4">
              <p className="mb-3 text-sm font-semibold" style={{ color: NAVY }}>
                Prima por compañía
              </p>
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={data.porAseguradora}
                    dataKey="prima"
                    nameKey="nombre"
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    label={(e: any) => e.nombre}
                    labelLine={{ stroke: '#cbd5e1' }}
                  >
                    {data.porAseguradora.map((_, i) => (
                      <Cell key={i} fill={COLORES[i % COLORES.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => money(v)} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="rounded-xl border p-4">
              <p className="mb-3 text-sm font-semibold" style={{ color: NAVY }}>
                Pólizas por compañía
              </p>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={data.porAseguradora} layout="vertical" margin={{ left: 8, right: 16 }}>
                  <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                  <YAxis
                    type="category"
                    dataKey="nombre"
                    tick={{ fontSize: 11 }}
                    width={110}
                  />
                  <Tooltip labelStyle={{ color: NAVY }} />
                  <Bar dataKey="ventas" name="Pólizas" fill={NAVY} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Detalle */}
          <div className="rounded-xl border">
            <div className="flex items-center justify-between border-b p-3.5">
              <p className="text-sm font-semibold" style={{ color: NAVY }}>
                Detalle · {data.filas.length} venta{data.filas.length === 1 ? '' : 's'}
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 text-left text-xs">
                    <th className="p-2.5 font-medium">Titular</th>
                    <th className="p-2.5 font-medium">Compañía</th>
                    <th className="p-2.5 font-medium">Plan</th>
                    <th className="p-2.5 font-medium">Vigencia</th>
                    <th className="p-2.5 font-medium">Forma de pago</th>
                    <th className="p-2.5 text-right font-medium">Prima anual</th>
                    <th className="p-2.5 font-medium">Agente</th>
                    <th className="p-2.5 font-medium">Origen</th>
                  </tr>
                </thead>
                <tbody>
                  {data.filas.map((f, i) => (
                    <tr key={`${f.dealId}-${i}`} className="border-b last:border-b-0">
                      <td className="p-2.5">{f.titular}</td>
                      <td className="p-2.5">{f.aseguradora ?? '—'}</td>
                      <td className="p-2.5">{f.plan ?? '—'}</td>
                      <td className="p-2.5 whitespace-nowrap">{fecha(f.vigencia)}</td>
                      <td className="p-2.5">{f.formaPago ?? '—'}</td>
                      <td className="p-2.5 text-right font-medium" style={{ color: NAVY }}>
                        {money(f.primaAnual)}
                      </td>
                      <td className="p-2.5">{f.agente}</td>
                      <td className="p-2.5">{f.origen}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t bg-muted/40 font-semibold">
                    <td className="p-2.5" colSpan={5}>
                      Total
                    </td>
                    <td className="p-2.5 text-right" style={{ color: NAVY }}>
                      {money(data.resumen.primaTotal)}
                    </td>
                    <td className="p-2.5" colSpan={2} />
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
