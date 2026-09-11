'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Car, Check } from 'lucide-react'

const NAVY = '#0C2057'
const VERDE = '#15803d'
const ROJO = '#dc2626'
const AMBAR = '#b45309'

type Estado = 'DE_INSPECCION' | 'APROBADO' | 'RECHAZADO_DEFINITIVO' | 'RECHAZADO_OBSERVACION'

const COMO_SE_VE: Record<Estado, { label: string; color: string; fondo: string }> = {
  DE_INSPECCION: { label: 'De inspección', color: AMBAR, fondo: '#fffbeb' },
  APROBADO: { label: 'Aprobado', color: VERDE, fondo: '#f0fdf4' },
  RECHAZADO_DEFINITIVO: { label: 'Rechazado', color: ROJO, fondo: '#fef2f2' },
  RECHAZADO_OBSERVACION: { label: 'Con observación', color: ROJO, fondo: '#fef2f2' },
}

interface Inspeccion {
  id: string
  dealId: string
  estado: Estado
  aseguradora: string | null
  marca: string | null
  modelo: string | null
  anio: number | null
  placa: string | null
  enviadaEn: string | null
  observacion: string | null
  intentos: number
  deal: {
    id: string
    title: string
    contact: { firstName: string; lastName: string | null; phone: string | null } | null
    assignedTo: { name: string } | null
  } | null
  notas: { id: string; texto: string; autorNombre: string | null; createdAt: string }[]
}

/**
 * Bandeja de inspecciones de Fidelización.
 *
 * El bloque del panel del negocio sirve al comercial, que trabaja ahí. Gianella
 * no anda abriendo negocios ajenos en el pipeline: necesita ver de una vez todo
 * lo que tiene pendiente de gestionar con las aseguradoras.
 */
export function InspeccionesPage() {
  const qc = useQueryClient()
  const [estado, setEstado] = useState<Estado | ''>('DE_INSPECCION')
  const [resolviendo, setResolviendo] = useState<{ id: string; estado: Estado } | null>(null)
  const [observacion, setObservacion] = useState('')
  const [error, setError] = useState<string | null>(null)

  const { data: lista = [], isLoading } = useQuery<Inspeccion[]>({
    queryKey: ['inspecciones', estado],
    queryFn: () =>
      api.get('/inspecciones', { params: estado ? { estado } : {} }).then((r) => r.data),
  })

  const resolver = useMutation({
    mutationFn: ({ dealId, estado: e }: { dealId: string; estado: Estado }) =>
      api.post(`/inspecciones/deal/${dealId}/resolver`, {
        estado: e,
        observacion: observacion.trim() || undefined,
      }),
    onSuccess: () => {
      setResolviendo(null)
      setObservacion('')
      setError(null)
      qc.invalidateQueries({ queryKey: ['inspecciones'] })
    },
    onError: (e: any) => {
      const m = e?.response?.data?.message
      setError(Array.isArray(m) ? m.join(', ') : (m ?? 'No se pudo registrar'))
    },
  })

  const pendientes = lista.filter((i) => i.estado === 'DE_INSPECCION').length

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-1">
      <div>
        <h1 className="text-2xl font-bold md:text-3xl" style={{ color: NAVY }}>
          Inspecciones de vehículos
        </h1>
        <p className="text-sm text-muted-foreground">
          Solicitudes del equipo comercial, para gestionar con la aseguradora
        </p>
      </div>

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
          {error}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {(
          [
            ['DE_INSPECCION', 'Por resolver'],
            ['APROBADO', 'Aprobadas'],
            ['RECHAZADO_OBSERVACION', 'Con observación'],
            ['', 'Todas'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setEstado(id)}
            className="rounded-full border px-3 py-1 text-xs font-medium transition-colors"
            style={estado === id ? { backgroundColor: NAVY, color: '#fff', borderColor: NAVY } : undefined}
          >
            {label}
            {id === 'DE_INSPECCION' && pendientes > 0 && ` (${pendientes})`}
          </button>
        ))}
      </div>

      {isLoading ? (
        <p className="py-12 text-center text-sm text-muted-foreground">Cargando…</p>
      ) : lista.length === 0 ? (
        <div className="rounded-xl border border-dashed py-12 text-center">
          <Car className="mx-auto h-8 w-8 text-muted-foreground/40" />
          <p className="mt-3 text-sm text-muted-foreground">
            {estado === 'DE_INSPECCION'
              ? 'No hay inspecciones por resolver.'
              : 'No hay inspecciones que mostrar.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {lista.map((i) => {
            const v = COMO_SE_VE[i.estado]
            const cliente = i.deal?.contact
              ? `${i.deal.contact.firstName} ${i.deal.contact.lastName ?? ''}`.trim()
              : i.deal?.title
            const vehiculo = [i.marca, i.modelo, i.anio].filter(Boolean).join(' ')

            return (
              <div key={i.id} className="rounded-xl border p-3.5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold" style={{ color: NAVY }}>
                      {cliente}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {[i.aseguradora, vehiculo, i.placa].filter(Boolean).join(' · ')}
                    </p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {i.deal?.assignedTo?.name && `Pidió ${i.deal.assignedTo.name}`}
                      {i.enviadaEn &&
                        ` · ${new Date(i.enviadaEn).toLocaleDateString('es-EC', {
                          day: 'numeric',
                          month: 'short',
                        })}`}
                      {i.intentos > 1 && ` · intento ${i.intentos}`}
                    </p>
                    {i.observacion && (
                      <p className="mt-1 text-[11px]" style={{ color: ROJO }}>
                        {i.observacion}
                      </p>
                    )}
                  </div>

                  <span
                    className="shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
                    style={{ backgroundColor: v.fondo, color: v.color }}
                  >
                    {v.label}
                  </span>
                </div>

                {/* Los botones solo mientras está en curso: una ya resuelta no se
                    cambia desde aquí, se reenvía desde el negocio. */}
                {i.estado === 'DE_INSPECCION' && (
                  <div className="mt-3 space-y-2 border-t pt-2.5">
                    {resolviendo?.id === i.id && resolviendo.estado !== 'APROBADO' && (
                      <Input
                        autoFocus
                        placeholder={
                          resolviendo.estado === 'RECHAZADO_OBSERVACION'
                            ? '¿Qué hay que corregir para volver a inspeccionar?'
                            : 'Motivo del rechazo (opcional)'
                        }
                        value={observacion}
                        onChange={(e) => setObservacion(e.target.value)}
                        className="h-9 text-sm"
                      />
                    )}

                    <div className="flex flex-wrap gap-1.5">
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-green-300 text-green-700 hover:bg-green-50"
                        onClick={() => resolver.mutate({ dealId: i.dealId, estado: 'APROBADO' })}
                        disabled={resolver.isPending}
                      >
                        <Check className="mr-1 h-3.5 w-3.5" /> Aprobar
                      </Button>

                      {(
                        [
                          ['RECHAZADO_OBSERVACION', 'Con observación'],
                          ['RECHAZADO_DEFINITIVO', 'Rechazar'],
                        ] as const
                      ).map(([e, label]) => (
                        <Button
                          key={e}
                          size="sm"
                          variant="outline"
                          className="border-red-300 text-red-700 hover:bg-red-50"
                          onClick={() => {
                            // Dos pasos: primero se escribe el motivo y luego se
                            // confirma. Con observación el motivo es obligatorio.
                            if (resolviendo?.id === i.id && resolviendo.estado === e) {
                              resolver.mutate({ dealId: i.dealId, estado: e })
                            } else {
                              setResolviendo({ id: i.id, estado: e })
                              setObservacion('')
                            }
                          }}
                          disabled={resolver.isPending}
                        >
                          {resolviendo?.id === i.id && resolviendo.estado === e
                            ? 'Confirmar'
                            : label}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}

                {i.notas.length > 0 && (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-[11px] text-muted-foreground">
                      Historial
                    </summary>
                    <div className="mt-1 space-y-1">
                      {i.notas.map((n) => (
                        <p key={n.id} className="rounded bg-muted/40 px-2 py-1 text-[11px]">
                          {n.texto}
                          <span className="text-muted-foreground">
                            {' '}
                            — {n.autorNombre ?? 'Alguien'}
                          </span>
                        </p>
                      ))}
                    </div>
                  </details>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
