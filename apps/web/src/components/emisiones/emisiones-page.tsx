'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Car, Check, Search, Send, TriangleAlert, X } from 'lucide-react'

const NAVY = '#0C2057'
const VERDE = '#15803d'

interface Emision {
  id: string
  estado: 'PENDIENTE' | 'ENVIADA'
  enviadaEn: string | null
  createdAt: string
  cliente: {
    id: string
    nombres: string
    apellidos: string
    email: string | null
    nombrePreferido: string | null
  }
  poliza: {
    aseguradora: string | null
    plan: string | null
    marca: string | null
    modelo: string | null
    anio: number | null
    placa: string | null
    formaPago: string | null
    fechaEmision: string | null
  } | null
}

interface Previa {
  id: string
  estado: string
  para: string
  asunto: string
  texto: string
  plantilla: string
  plantillas: { id: string; label: string; descripcion: string }[]
  datos: Record<string, unknown>
}

/**
 * Emisiones de vehículos.
 *
 * Es la bandeja de Gianella: al cerrarse un negocio de auto la emisión aparece
 * aquí, ella elige la plantilla según cómo pague el cliente, ajusta lo que haga
 * falta y envía.
 *
 * Separada de Requerimientos a propósito: las bienvenidas de salud las mandan
 * las ejecutivas de cuenta, y mezclarlas llenaría la bandeja de cada una con
 * trabajo que no le toca.
 */
export function EmisionesPage() {
  const qc = useQueryClient()
  const [estado, setEstado] = useState<'PENDIENTE' | 'ENVIADA' | ''>('PENDIENTE')
  const [busqueda, setBusqueda] = useState('')
  const [abierta, setAbierta] = useState<string | null>(null)

  const { data: emisiones = [], isLoading } = useQuery<Emision[]>({
    queryKey: ['emisiones', estado, busqueda],
    queryFn: () =>
      api
        .get('/emisiones', {
          params: { ...(estado ? { estado } : {}), ...(busqueda ? { search: busqueda } : {}) },
        })
        .then((r) => r.data),
  })

  const pendientes = emisiones.filter((e) => e.estado === 'PENDIENTE').length

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-1">
      <div>
        <h1 className="text-2xl font-bold md:text-3xl" style={{ color: NAVY }}>
          Emisiones de vehículos
        </h1>
        <p className="text-sm text-muted-foreground">
          Pólizas de auto recién emitidas, listas para avisar al cliente
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {(
          [
            ['PENDIENTE', 'Por enviar'],
            ['ENVIADA', 'Enviadas'],
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
            {id === 'PENDIENTE' && pendientes > 0 && ` (${pendientes})`}
          </button>
        ))}

        <div className="relative ml-auto">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre o cédula…"
            className="h-9 w-[240px] pl-8 text-sm"
          />
        </div>
      </div>

      {isLoading ? (
        <p className="py-12 text-center text-sm text-muted-foreground">Cargando…</p>
      ) : emisiones.length === 0 ? (
        <div className="rounded-xl border border-dashed py-12 text-center">
          <Car className="mx-auto h-8 w-8 text-muted-foreground/40" />
          <p className="mt-3 text-sm text-muted-foreground">
            {estado === 'PENDIENTE'
              ? 'No hay emisiones por enviar.'
              : 'No hay emisiones que mostrar.'}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Aparecen aquí cuando se cierra un negocio de vehículos.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {emisiones.map((e) => {
            const vehiculo = [e.poliza?.marca, e.poliza?.modelo, e.poliza?.anio]
              .filter(Boolean)
              .join(' ')
            return (
              <div key={e.id} className="rounded-xl border p-3.5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold" style={{ color: NAVY }}>
                      {`${e.cliente.nombres} ${e.cliente.apellidos}`.trim()}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {[e.poliza?.aseguradora, e.poliza?.plan].filter(Boolean).join(' · ')}
                      {vehiculo && ` · ${vehiculo}`}
                      {e.poliza?.placa && ` · ${e.poliza.placa}`}
                    </p>
                    {/* Sin correo no se puede enviar: se avisa aquí para que se
                        corrija antes de intentarlo. */}
                    {!e.cliente.email && (
                      <p className="mt-1 flex items-center gap-1 text-[11px] text-amber-700">
                        <TriangleAlert className="h-3 w-3" />
                        Sin correo. Cárgalo en la ficha del cliente.
                      </p>
                    )}
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    {e.estado === 'ENVIADA' ? (
                      <span
                        className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
                        style={{ backgroundColor: '#f0fdf4', color: VERDE }}
                      >
                        <Check className="mr-1 inline h-3 w-3" />
                        Enviada{' '}
                        {e.enviadaEn &&
                          new Date(e.enviadaEn).toLocaleDateString('es-EC', {
                            day: 'numeric',
                            month: 'short',
                          })}
                      </span>
                    ) : (
                      <Button
                        size="sm"
                        onClick={() => setAbierta(e.id)}
                        disabled={!e.cliente.email}
                        style={{ backgroundColor: NAVY, color: '#fff' }}
                      >
                        <Send className="mr-1.5 h-3.5 w-3.5" /> Preparar correo
                      </Button>
                    )}
                    {e.estado === 'ENVIADA' && (
                      <button
                        type="button"
                        onClick={() => setAbierta(e.id)}
                        className="text-xs underline underline-offset-2"
                      >
                        Ver
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {abierta && (
        <CorreoEmision
          id={abierta}
          onCerrar={() => {
            setAbierta(null)
            qc.invalidateQueries({ queryKey: ['emisiones'] })
          }}
        />
      )}
    </div>
  )
}

/** El correo: plantilla, texto editable y copias. */
function CorreoEmision({ id, onCerrar }: { id: string; onCerrar: () => void }) {
  const [plantilla, setPlantilla] = useState('')
  const [texto, setTexto] = useState('')
  const [tocado, setTocado] = useState(false)
  const [copias, setCopias] = useState('')
  const [error, setError] = useState<string | null>(null)

  const { data } = useQuery<Previa>({
    queryKey: ['emision', id, plantilla],
    queryFn: () =>
      api
        .get(`/emisiones/${id}/vista-previa`, { params: plantilla ? { plantilla } : {} })
        .then((r) => {
          // No se pisa lo que ya escribió: perder una corrección por cambiar de
          // plantilla sin querer sería peor que tener que borrarla.
          if (!tocado) setTexto(r.data.texto ?? '')
          return r.data
        }),
  })

  const enviar = useMutation({
    mutationFn: () =>
      api.post(`/emisiones/${id}/enviar`, {
        texto,
        plantilla: data?.plantilla,
        ...(copias.trim() ? { copias } : {}),
      }),
    onSuccess: onCerrar,
    onError: (e: any) => {
      const m = e?.response?.data?.message
      setError(Array.isArray(m) ? m.join(', ') : (m ?? 'No se pudo enviar'))
    },
  })

  const yaEnviada = data?.estado === 'ENVIADA'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onCerrar}
    >
      <div
        className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl bg-white"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b p-4">
          <div className="min-w-0">
            <p className="text-sm font-semibold" style={{ color: NAVY }}>
              {yaEnviada ? 'Correo enviado' : 'Correo de emisión'}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              Para {data?.para} · {data?.asunto}
            </p>
          </div>
          <button type="button" onClick={onCerrar} className="text-muted-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        {error && (
          <p className="mx-4 mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
            {error}
          </p>
        )}

        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          {!yaEnviada && data && (
            <>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Plantilla</label>
                <select
                  value={data.plantilla}
                  onChange={(e) => {
                    setPlantilla(e.target.value)
                    setTocado(false)
                  }}
                  className="h-9 w-full rounded-md border bg-background px-2 text-sm"
                >
                  {data.plantillas.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label} — {p.descripcion}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs text-muted-foreground">
                  Copiar a (opcional)
                </label>
                <Input
                  value={copias}
                  onChange={(e) => setCopias(e.target.value)}
                  placeholder="otro@priority.ec"
                  className="h-9 text-sm"
                />
              </div>
            </>
          )}

          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Texto del correo</label>
            <textarea
              value={texto}
              onChange={(e) => {
                setTexto(e.target.value)
                setTocado(true)
              }}
              readOnly={yaEnviada}
              rows={18}
              className="w-full rounded-md border bg-background p-3 text-sm leading-relaxed"
            />
            <p className="mt-1 text-[11px] text-muted-foreground">
              {yaEnviada
                ? 'Esto es lo que se le envió al cliente.'
                : 'Se envía tal como se ve aquí. Revisa que las cuentas y los teléfonos sean los correctos.'}
            </p>
          </div>
        </div>

        {!yaEnviada && (
          <div className="flex justify-end gap-2 border-t p-4">
            <Button variant="outline" onClick={onCerrar}>
              Cancelar
            </Button>
            <Button
              onClick={() => enviar.mutate()}
              disabled={enviar.isPending || !texto.trim()}
              style={{ backgroundColor: NAVY, color: '#fff' }}
            >
              <Send className="mr-1.5 h-4 w-4" />
              {enviar.isPending ? 'Enviando…' : 'Enviar al cliente'}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
