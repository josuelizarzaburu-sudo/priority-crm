'use client'

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { NotebookPen } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { api } from '@/lib/api'

const NAVY = '#0C2057'

interface Nota {
  id: string
  contenido: string
  autorNombre: string | null
  createdAt: string
}

// "hace 5 minutos", "ayer", "12 mar 2026" — según qué tan reciente sea.
function cuando(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const min = Math.floor((Date.now() - d.getTime()) / 60000)
  if (min < 1) return 'recién'
  if (min < 60) return `hace ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `hace ${h} h`
  const dias = Math.floor(h / 24)
  if (dias === 1) return 'ayer'
  if (dias < 7) return `hace ${dias} días`
  return d.toLocaleDateString('es-EC', { day: 'numeric', month: 'short', year: 'numeric' })
}

const fechaCompleta = (iso: string) => {
  const d = new Date(iso)
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleString('es-EC', { dateStyle: 'medium', timeStyle: 'short' })
}

export function NotasCliente({ clienteId, notas }: { clienteId: string; notas: Nota[] }) {
  const qc = useQueryClient()
  const [texto, setTexto] = useState('')
  const [error, setError] = useState<string | null>(null)

  const guardar = useMutation({
    mutationFn: async () =>
      (await api.post(`/clientes/${clienteId}/notas`, { contenido: texto.trim() })).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cliente', clienteId] })
      setTexto('')
    },
    onError: (e: any) => setError(e?.response?.data?.message ?? 'No se pudo guardar la nota.'),
  })

  return (
    <section className="rounded-lg border bg-card p-4">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-bold" style={{ color: NAVY }}>
        <NotebookPen className="h-4 w-4" /> Bitácora ({notas.length})
      </h2>

      <div className="mb-4">
        <Textarea
          placeholder="Escribe lo que pasó con este cliente: qué pidió, qué se acordó, qué quedó pendiente…"
          rows={3}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
        />
        <div className="mt-2 flex items-center justify-between gap-3">
          <p className="text-[11px] text-muted-foreground">
            Las notas quedan guardadas con tu nombre y la fecha. No se pueden editar ni borrar.
          </p>
          <Button
            type="button"
            size="sm"
            style={{ backgroundColor: NAVY, color: '#fff' }}
            disabled={guardar.isPending || !texto.trim()}
            onClick={() => {
              setError(null)
              guardar.mutate()
            }}
          >
            {guardar.isPending ? 'Guardando…' : 'Agregar nota'}
          </Button>
        </div>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </div>

      {notas.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Todavía no hay notas. La primera que escribas queda aquí como historial.
        </p>
      ) : (
        <ol className="space-y-3 border-l-2 pl-4">
          {notas.map((n) => (
            <li key={n.id} className="relative">
              <span
                className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: NAVY }}
              />
              <div className="flex flex-wrap items-baseline gap-x-2">
                <span className="text-sm font-semibold" style={{ color: NAVY }}>
                  {n.autorNombre ?? 'Usuario eliminado'}
                </span>
                <span className="text-xs text-muted-foreground" title={fechaCompleta(n.createdAt)}>
                  {cuando(n.createdAt)}
                </span>
              </div>
              <p className="whitespace-pre-wrap text-sm text-[#333]">{n.contenido}</p>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
