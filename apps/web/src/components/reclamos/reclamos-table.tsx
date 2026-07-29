'use client'

import { useState, useEffect } from 'react'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { Search, ChevronLeft, ChevronRight, Link2Off } from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { api } from '@/lib/api'
import { ReclamoForm } from './reclamo-form'

const NAVY = '#0C2057'

const ESTADOS = [
  { valor: 'EN_TRAMITE', label: 'En trámite', color: 'border-amber-500 text-amber-600' },
  { valor: 'LIQUIDADO', label: 'Liquidado', color: 'border-emerald-600 text-emerald-700' },
  { valor: 'NEGADO', label: 'Negado', color: 'border-red-500 text-red-600' },
  { valor: 'DEVUELTO', label: 'Devuelto', color: 'border-sky-500 text-sky-600' },
]

const estadoInfo = (e: string) => ESTADOS.find((x) => x.valor === e)

export interface Reclamo {
  id: string
  clienteId: string | null
  clienteNombre: string
  pacienteNombre: string | null
  aseguradora: string | null
  contrato: string | null
  diagnostico: string | null
  liquidacion: string | null
  fechaEnvioAseguradora: string | null
  fechaLiquidacion: string | null
  fechaEnvioCliente: string | null
  valor: string | number | null
  estado: string
  diasLiquidacion: number | null
  diasEnvioCliente: number | null
  ejecutivo: { id: string; name: string } | null
  ejecutivoNombre: string | null
  medioComunicacion: string | null
  observaciones: string | null
  detalle: string | null
  fechaRecepcion: string | null
}

const money = (v: string | number | null | undefined) => {
  if (v === null || v === undefined) return '—'
  const n = typeof v === 'string' ? parseFloat(v) : v
  return Number.isNaN(n) ? '—' : `$${n.toLocaleString('es-EC', { minimumFractionDigits: 2 })}`
}

const fecha = (v: string | null) => {
  if (!v) return '—'
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('es-EC', { timeZone: 'UTC' })
}

export function ReclamosTable() {
  const [search, setSearch] = useState('')
  const [debounced, setDebounced] = useState('')
  const [estado, setEstado] = useState<string>('')
  const [page, setPage] = useState(1)
  const [editando, setEditando] = useState<Reclamo | null>(null)

  useEffect(() => {
    const t = setTimeout(() => {
      setDebounced(search)
      setPage(1)
    }, 350)
    return () => clearTimeout(t)
  }, [search])

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['reclamos', debounced, estado, page],
    queryFn: async () => {
      const params: Record<string, string | number> = { page, limit: 25 }
      if (debounced.trim()) params.search = debounced.trim()
      if (estado) params.estado = estado
      const r = await api.get('/reclamos', { params })
      return r.data as {
        data: Reclamo[]
        total: number
        totalPages: number
        valorTotal: string | number
      }
    },
    placeholderData: keepPreviousData,
  })

  const { data: resumen } = useQuery({
    queryKey: ['reclamos-resumen'],
    queryFn: async () => (await api.get('/reclamos/resumen')).data,
  })

  const lista = data?.data ?? []

  return (
    <div className="flex flex-col gap-4">
      {/* ── Totales: lo que hoy se saca con fórmulas en el Excel ── */}
      {resumen && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          {ESTADOS.map((e) => {
            const x = resumen.porEstado?.find((p: any) => p.estado === e.valor)
            return (
              <button
                key={e.valor}
                type="button"
                onClick={() => {
                  setEstado(estado === e.valor ? '' : e.valor)
                  setPage(1)
                }}
                className="rounded-lg border bg-card p-3 text-left transition-colors"
                style={{ borderColor: estado === e.valor ? NAVY : undefined }}
              >
                <div className="text-xs text-muted-foreground">{e.label}</div>
                <div className="text-xl font-bold" style={{ color: NAVY }}>
                  {x?.cantidad ?? 0}
                </div>
                <div className="text-[11px] text-muted-foreground">{money(x?.valor)}</div>
              </button>
            )
          })}
          <div className="rounded-lg border bg-card p-3">
            <div className="text-xs text-muted-foreground">Valor total</div>
            <div className="text-xl font-bold" style={{ color: NAVY }}>
              {money(resumen.valorTotal)}
            </div>
            {resumen.sinEnlazarACliente > 0 && (
              <div className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
                <Link2Off className="h-3 w-3" />
                {resumen.sinEnlazarACliente} sin cliente
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Buscador ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por cliente, paciente, diagnóstico o liquidación…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-3">
          {estado && (
            <Button type="button" variant="ghost" size="sm" onClick={() => setEstado('')}>
              Quitar filtro
            </Button>
          )}
          <span className="whitespace-nowrap text-sm text-muted-foreground">
            {data?.total ?? 0} reclamos
          </span>
        </div>
      </div>

      {/* ── Tabla ── */}
      <div className="hidden rounded-lg border bg-card md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cliente / Paciente</TableHead>
              <TableHead>Aseguradora</TableHead>
              <TableHead>Liquidación</TableHead>
              <TableHead>Diagnóstico</TableHead>
              <TableHead>Envío</TableHead>
              <TableHead className="text-center">Días</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={9} className="h-32 text-center text-muted-foreground">
                  Cargando…
                </TableCell>
              </TableRow>
            ) : isError ? (
              <TableRow>
                <TableCell colSpan={9} className="h-32 text-center text-sm text-muted-foreground">
                  No se pudo cargar.
                  <br />
                  <span className="text-xs">
                    {(error as any)?.response?.status
                      ? `Error ${(error as any).response.status}`
                      : 'Sin conexión con el servidor'}
                  </span>
                </TableCell>
              </TableRow>
            ) : lista.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="h-32 text-center text-muted-foreground">
                  {debounced || estado
                    ? 'Ningún reclamo coincide con la búsqueda.'
                    : 'Todavía no hay reclamos.'}
                </TableCell>
              </TableRow>
            ) : (
              lista.map((r) => {
                const info = estadoInfo(r.estado)
                return (
                  <TableRow key={r.id}>
                    <TableCell>
                      <div className="font-medium" style={{ color: NAVY }}>
                        {r.clienteNombre}
                      </div>
                      {r.pacienteNombre && r.pacienteNombre !== r.clienteNombre && (
                        <div className="text-xs text-muted-foreground">
                          Paciente: {r.pacienteNombre}
                        </div>
                      )}
                      {r.contrato && r.contrato !== 'INDIVIDUAL' && (
                        <div className="text-[11px] text-muted-foreground">{r.contrato}</div>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">{r.aseguradora ?? '—'}</TableCell>
                    <TableCell className="text-sm font-medium tabular-nums">
                      {r.liquidacion ?? '—'}
                    </TableCell>
                    <TableCell className="max-w-[180px] truncate text-sm" title={r.diagnostico ?? ''}>
                      {r.diagnostico ?? '—'}
                    </TableCell>
                    <TableCell className="text-sm">{fecha(r.fechaEnvioAseguradora)}</TableCell>
                    <TableCell className="text-center text-sm">
                      {r.diasLiquidacion ?? '—'}
                    </TableCell>
                    <TableCell className="text-right text-sm">{money(r.valor)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={info?.color}>
                        {info?.label ?? r.estado}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button type="button" variant="ghost" size="sm" onClick={() => setEditando(r)}>
                        Ver más
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* ── Tarjetas móvil ── */}
      <div className="flex flex-col gap-3 md:hidden">
        {lista.map((r) => {
          const info = estadoInfo(r.estado)
          return (
            <button
              key={r.id}
              type="button"
              onClick={() => setEditando(r)}
              className="rounded-lg border bg-card p-4 text-left"
            >
              <div className="mb-2 flex items-start justify-between gap-2">
                <div>
                  <div className="font-semibold" style={{ color: NAVY }}>
                    {r.clienteNombre}
                  </div>
                  {r.pacienteNombre && r.pacienteNombre !== r.clienteNombre && (
                    <div className="text-xs text-muted-foreground">{r.pacienteNombre}</div>
                  )}
                </div>
                <Badge variant="outline" className={info?.color}>
                  {info?.label ?? r.estado}
                </Badge>
              </div>
              <div className="space-y-1 border-t pt-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Aseguradora</span>
                  <span>{r.aseguradora ?? '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Liquidación</span>
                  <span className="font-medium tabular-nums">{r.liquidacion ?? '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Valor</span>
                  <span>{money(r.valor)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Envío</span>
                  <span>{fecha(r.fechaEnvioAseguradora)}</span>
                </div>
              </div>
            </button>
          )
        })}
      </div>

      {/* ── Paginación ── */}
      {(data?.totalPages ?? 1) > 1 && (
        <div className="flex items-center justify-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground">
            Página {page} de {data?.totalPages}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={page >= (data?.totalPages ?? 1)}
            onClick={() => setPage((p) => p + 1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      {editando && <ReclamoForm reclamo={editando} onCerrar={() => setEditando(null)} />}
    </div>
  )
}
