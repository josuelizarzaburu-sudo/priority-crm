'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Eye, Download, FileText, ChevronLeft, ChevronRight } from 'lucide-react'
import { api } from '@/lib/api'

const NAVY = '#0C2057'

interface Registro {
  id: string
  usuarioNombre: string | null
  usuarioRol: string | null
  accion: string
  objetoTipo: string | null
  detalle: string | null
  createdAt: string
}

const ACCIONES: { id: string; label: string }[] = [
  { id: '', label: 'Todo' },
  { id: 'VER_FICHA_CLIENTE', label: 'Fichas abiertas' },
  { id: 'EXPORTAR_REPORTE', label: 'Exportaciones' },
  { id: 'GENERAR_COMPARATIVO', label: 'Comparativos' },
]

interface UsoComparativos {
  usuarioId: string
  nombre: string
  comparativos: number
  leads: number
  porLead: number | null
}

const fechaHora = (v: string) =>
  new Date(v).toLocaleString('es-EC', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })

export function RegistroAccesoPage() {
  const [accion, setAccion] = useState('')
  const [usuarioId, setUsuarioId] = useState('')
  const [page, setPage] = useState(1)

  const { data, isLoading, isError } = useQuery({
    queryKey: ['registro-acceso', accion, usuarioId, page],
    queryFn: async () =>
      (await api.get('/registro-acceso', {
        params: { accion: accion || undefined, usuarioId: usuarioId || undefined, page },
      }))
        .data as {
        data: Registro[]
        total: number
        page: number
        totalPages: number
      },
  })

  const filas = data?.data ?? []

  // Resumen de uso: comparativos generados vs leads que tiene cada vendedor.
  const { data: uso } = useQuery({
    queryKey: ['uso-comparativos'],
    queryFn: async () =>
      (await api.get('/registro-acceso/comparativos-por-usuario')).data as UsoComparativos[],
  })

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1">
          {ACCIONES.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => {
                setAccion(a.id)
                setPage(1)
              }}
              className="rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors"
              style={{
                borderColor: accion === a.id ? NAVY : '#e5e7eb',
                backgroundColor: accion === a.id ? NAVY : '#fff',
                color: accion === a.id ? '#fff' : NAVY,
              }}
            >
              {a.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          {/* Filtrar el historial por vendedor. Las opciones salen del mismo
              resumen de arriba, así solo aparece quien tiene actividad. */}
          {uso && uso.length > 0 && (
            <select
              value={usuarioId}
              onChange={(e) => {
                setUsuarioId(e.target.value)
                setPage(1)
              }}
              className="h-8 rounded-md border bg-background px-2 text-xs"
            >
              <option value="">Todos los vendedores</option>
              {uso.map((u) => (
                <option key={u.usuarioId} value={u.usuarioId}>
                  {u.nombre}
                </option>
              ))}
            </select>
          )}
          {data && (
            <span className="text-xs text-muted-foreground">{data.total} registros</span>
          )}
        </div>
      </div>

      {/* Resumen de uso por vendedor. La señal de alarma es un número alto de
          comparativos con pocos leads: cotizando por fuera del sistema. */}
      {uso && uso.length > 0 && (
        <div className="rounded-xl border bg-card p-4">
          <h3 className="mb-1 text-sm font-bold" style={{ color: NAVY }}>
            Comparativos por vendedor
          </h3>
          <p className="mb-3 text-xs text-muted-foreground">
            Muchos comparativos con pocos leads puede indicar que se está cotizando
            fuera del sistema.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="py-2 text-left font-semibold">Vendedor</th>
                  <th className="py-2 text-right font-semibold">Comparativos</th>
                  <th className="py-2 text-right font-semibold">Leads</th>
                  <th className="py-2 text-right font-semibold">Por lead</th>
                </tr>
              </thead>
              <tbody>
                {uso.map((u) => {
                  // Más de 10 comparativos por lead, o comparativos sin ningún
                  // lead, es lo que vale la pena mirar de cerca.
                  const alerta = u.porLead === null ? u.comparativos > 0 : u.porLead > 10
                  return (
                    <tr key={u.usuarioId} className="border-b last:border-0">
                      <td className="py-2 font-medium" style={{ color: NAVY }}>
                        {u.nombre}
                      </td>
                      <td className="py-2 text-right tabular-nums">{u.comparativos}</td>
                      <td className="py-2 text-right tabular-nums">{u.leads}</td>
                      <td
                        className="py-2 text-right font-semibold tabular-nums"
                        style={{ color: alerta ? '#C24444' : '#2E9E63' }}
                      >
                        {u.porLead === null ? 'sin leads' : u.porLead}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {isLoading ? (
        <p className="py-10 text-center text-sm text-muted-foreground">Cargando…</p>
      ) : isError ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          No se pudo cargar el registro.
        </p>
      ) : filas.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          No hay accesos registrados todavía.
        </p>
      ) : (
        <div className="space-y-2">
          {filas.map((r) => {
            const esExport = r.accion === 'EXPORTAR_REPORTE'
            const esComparativo = r.accion === 'GENERAR_COMPARATIVO'
            return (
              <div
                key={r.id}
                className="flex items-start gap-3 rounded-lg border bg-card p-3"
              >
                <div
                  className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
                  style={{
                    backgroundColor: esExport
                      ? '#FEF3E2'
                      : esComparativo
                        ? '#EDE9FB'
                        : '#EAF0FB',
                  }}
                >
                  {esExport ? (
                    <Download className="h-3.5 w-3.5" style={{ color: '#B87A15' }} />
                  ) : esComparativo ? (
                    <FileText className="h-3.5 w-3.5" style={{ color: '#6D4AC4' }} />
                  ) : (
                    <Eye className="h-3.5 w-3.5" style={{ color: NAVY }} />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm">
                    <span className="font-semibold" style={{ color: NAVY }}>
                      {r.usuarioNombre ?? 'Usuario eliminado'}
                    </span>{' '}
                    <span className="text-muted-foreground">
                      {esExport
                        ? 'exportó'
                        : esComparativo
                          ? 'generó un comparativo:'
                          : 'abrió la ficha de'}
                    </span>{' '}
                    {r.detalle ?? r.objetoTipo}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {r.usuarioRol ?? '—'} · {fechaHora(r.createdAt)}
                  </p>
                </div>
              </div>
            )
          })}

          {data && data.totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="flex items-center gap-1 rounded-md border px-3 py-1.5 text-xs disabled:opacity-40"
              >
                <ChevronLeft className="h-3.5 w-3.5" /> Anterior
              </button>
              <span className="text-xs text-muted-foreground">
                Página {data.page} de {data.totalPages}
              </span>
              <button
                type="button"
                disabled={page >= data.totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="flex items-center gap-1 rounded-md border px-3 py-1.5 text-xs disabled:opacity-40"
              >
                Siguiente <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
