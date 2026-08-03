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
import { RequerimientoForm } from './requerimiento-form'

const NAVY = '#0C2057'

// Etiqueta legible del tipo de requerimiento.
const TIPO_LABEL: Record<string, string> = {
  DATOS_FACTURACION: 'Datos de facturación',
  CAMBIO_FORMA_PAGO: 'Cambio de forma de pago',
  CAMBIO_DEDUCIBLE: 'Cambio de deducible',
  ACTUALIZACION_DATOS: 'Actualización de datos',
  INCLUSION_DEPENDIENTES: 'Inclusión de dependientes',
  EXCLUSION_DEPENDIENTES: 'Exclusión de dependientes',
  CANCELACION: 'Cancelación',
  COTIZACION: 'Cotización',
  PRE_NOTIFICACION: 'Pre notificación',
  OTROS: 'Otros',
}

const ESTADOS = [
  { valor: 'EN_TRAMITE', label: 'En trámite', color: 'border-amber-500 text-amber-600' },
      { valor: 'MAS_INFORMACION', label: 'Más información', color: 'border-sky-500 text-sky-600' },
  { valor: 'SOLUCIONADO', label: 'Solucionado', color: 'border-emerald-500 text-emerald-600' },
]

const estadoInfo = (e: string) => ESTADOS.find((x) => x.valor === e)

export interface Reclamo {
  id: string
  clienteId: string | null
  clienteNombre: string
  pacienteNombre: string | null
  aseguradora: string | null
  contrato: string | null
  tipo: string
  tipoOtro: string | null
  requerimiento: string | null
  fechaEnvioAseguradora: string | null
  fechaLiquidacion: string | null
  fechaEnvioCliente: string | null
  estado: string
  diasGestion: number | null
  ejecutivo: { id: string; name: string } | null
  ejecutivoNombre: string | null
  medioComunicacion: string | null
  observaciones: string | null
  detalle: string | null
  fechaRecepcion: string | null
}

const fecha = (v: string | null) => {
  if (!v) return '—'
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('es-EC', { timeZone: 'UTC' })
}

export function RequerimientosTable() {
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
    queryKey: ['requerimientos', debounced, estado, page],
    queryFn: async () => {
      const params: Record<string, string | number> = { page, limit: 25 }
      if (debounced.trim()) params.search = debounced.trim()
      if (estado) params.estado = estado
      const r = await api.get('/requerimientos', { params })
      return r.data as {
        data: Reclamo[]
        total: number
        totalPages: number
      }
    },
    placeholderData: keepPreviousData,
  })

  const { data: resumen } = useQuery({
    queryKey: ['requerimientos-resumen'],
    queryFn: async () => (await api.get('/requerimientos/resumen')).data,
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
              </button>
            )
          })}
          {/* En requerimientos no hay valor: solo interesa cuántos hay en cada
              estado y cuáles no están enlazados a una ficha. */}
          {resumen.sinEnlazarACliente > 0 && (
            <div className="rounded-lg border bg-card p-3">
              <div className="text-xs text-muted-foreground">Sin cliente</div>
              <div className="text-xl font-bold" style={{ color: NAVY }}>
                {resumen.sinEnlazarACliente}
              </div>
              <div className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
                <Link2Off className="h-3 w-3" />
                sin enlazar a una ficha
              </div>
            </div>
          )}
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
            {data?.total ?? 0} requerimientos
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
              <TableHead>Tipo</TableHead>
              <TableHead>Requerimiento</TableHead>
              <TableHead>Recepción</TableHead>
              <TableHead className="text-center">Días</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={8} className="h-32 text-center text-muted-foreground">
                  Cargando…
                </TableCell>
              </TableRow>
            ) : isError ? (
              <TableRow>
                <TableCell colSpan={8} className="h-32 text-center text-sm text-muted-foreground">
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
                <TableCell colSpan={8} className="h-32 text-center text-muted-foreground">
                  {debounced || estado
                    ? 'Ningún requerimiento coincide con la búsqueda.'
                    : 'Todavía no hay requerimientos.'}
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
                    <TableCell className="text-sm">
                      {r.tipo === 'OTROS' && r.tipoOtro
                        ? r.tipoOtro
                        : (TIPO_LABEL[r.tipo] ?? r.tipo)}
                    </TableCell>
                    <TableCell
                      className="max-w-[200px] truncate text-sm"
                      title={r.requerimiento ?? ''}
                    >
                      {r.requerimiento ?? '—'}
                    </TableCell>
                    <TableCell className="text-sm">{fecha(r.fechaRecepcion)}</TableCell>
                    <TableCell className="text-center text-sm">{r.diasGestion ?? '—'}</TableCell>
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
                  <span className="text-muted-foreground">Tipo</span>
                  <span className="text-right">
                    {r.tipo === 'OTROS' && r.tipoOtro
                      ? r.tipoOtro
                      : (TIPO_LABEL[r.tipo] ?? r.tipo)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Recepción</span>
                  <span>{fecha(r.fechaRecepcion)}</span>
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

      {editando && <RequerimientoForm req={editando} onCerrar={() => setEditando(null)} />}
    </div>
  )
}
