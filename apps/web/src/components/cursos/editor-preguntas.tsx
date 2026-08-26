'use client'

import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Check, Plus, Trash2, X } from 'lucide-react'

const NAVY = '#0C2057'
const GOLD = '#DBAA59'

interface PreguntaEdit {
  id?: string
  enunciado: string
  opciones: string[]
  correcta: number
  explicacion?: string | null
}

/**
 * Editor de preguntas de un módulo.
 *
 * Se guardan TODAS juntas: editarlas de a una obligaría a llevar la cuenta de
 * cuáles se borraron, y el formulario ya las tiene completas en pantalla.
 */
export function EditorPreguntas({
  moduloId,
  tituloModulo,
  onCerrar,
}: {
  moduloId: string
  tituloModulo: string
  onCerrar: () => void
}) {
  const qc = useQueryClient()
  const [preguntas, setPreguntas] = useState<PreguntaEdit[]>([])
  const [error, setError] = useState<string | null>(null)

  const { data, isLoading } = useQuery<PreguntaEdit[]>({
    queryKey: ['curso-preguntas', moduloId],
    queryFn: () => api.get(`/cursos/modulos/${moduloId}/preguntas`).then((r) => r.data),
  })

  useEffect(() => {
    if (!data) return
    setPreguntas(
      data.length
        ? data.map((p) => ({ ...p, opciones: (p.opciones as string[]) ?? [] }))
        : // Se arranca con una pregunta vacia y dos opciones: una pantalla en
          // blanco no deja claro que hay que hacer.
          [{ enunciado: '', opciones: ['', ''], correcta: 0 }],
    )
  }, [data])

  const guardar = useMutation({
    mutationFn: () =>
      api.put(`/cursos/modulos/${moduloId}/preguntas`, {
        preguntas: preguntas.map((p) => ({
          enunciado: p.enunciado,
          opciones: p.opciones,
          correcta: p.correcta,
          explicacion: p.explicacion || undefined,
        })),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cursos-admin'] })
      qc.invalidateQueries({ queryKey: ['curso-preguntas', moduloId] })
      onCerrar()
    },
    onError: (e: any) => {
      const m = e?.response?.data?.message
      setError(Array.isArray(m) ? m.join(', ') : (m ?? 'No se pudo guardar'))
    },
  })

  const set = (i: number, cambios: Partial<PreguntaEdit>) =>
    setPreguntas((ps) => ps.map((p, j) => (j === i ? { ...p, ...cambios } : p)))

  if (isLoading) {
    return <p className="py-10 text-center text-sm text-muted-foreground">Cargando…</p>
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-lg font-bold" style={{ color: NAVY }}>
            Preguntas
          </h3>
          <p className="text-xs text-muted-foreground">{tituloModulo}</p>
        </div>
        <button type="button" onClick={onCerrar} aria-label="Cerrar" className="p-1">
          <X className="h-5 w-5" />
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="space-y-4">
        {preguntas.map((p, i) => (
          <div key={i} className="rounded-xl border p-3.5">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-semibold" style={{ color: GOLD }}>
                Pregunta {i + 1}
              </span>
              {preguntas.length > 1 && (
                <button
                  type="button"
                  onClick={() => setPreguntas((ps) => ps.filter((_, j) => j !== i))}
                  className="text-muted-foreground hover:text-red-600"
                  aria-label="Quitar pregunta"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <Textarea
              rows={2}
              placeholder="¿Qué quieres preguntar?"
              value={p.enunciado}
              onChange={(e) => set(i, { enunciado: e.target.value })}
              className="mb-2.5 text-sm"
            />

            <p className="mb-1.5 text-[11px] text-muted-foreground">
              Marca la respuesta correcta con el círculo
            </p>

            <div className="space-y-1.5">
              {p.opciones.map((op, j) => (
                <div key={j} className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => set(i, { correcta: j })}
                    aria-label={`Marcar opción ${j + 1} como correcta`}
                    className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors"
                    style={{
                      borderColor: p.correcta === j ? '#5FD38D' : '#cbd5e1',
                      backgroundColor: p.correcta === j ? '#5FD38D' : 'transparent',
                    }}
                  >
                    {p.correcta === j && (
                      <Check className="h-3 w-3 text-white" strokeWidth={3} />
                    )}
                  </button>
                  <Input
                    value={op}
                    placeholder={`Opción ${j + 1}`}
                    onChange={(e) =>
                      set(i, {
                        opciones: p.opciones.map((o, k) => (k === j ? e.target.value : o)),
                      })
                    }
                    className="h-9 text-sm"
                  />
                  {p.opciones.length > 2 && (
                    <button
                      type="button"
                      onClick={() =>
                        set(i, {
                          opciones: p.opciones.filter((_, k) => k !== j),
                          // Si se borra la que estaba marcada, la correcta pasa a
                          // la primera: dejar el índice apuntando a una opción
                          // que ya no existe guardaría una pregunta sin respuesta.
                          correcta: p.correcta === j ? 0 : p.correcta > j ? p.correcta - 1 : p.correcta,
                        })
                      }
                      className="shrink-0 text-muted-foreground hover:text-red-600"
                      aria-label="Quitar opción"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {p.opciones.length < 4 && (
              <button
                type="button"
                onClick={() => set(i, { opciones: [...p.opciones, ''] })}
                className="mt-2 text-xs underline underline-offset-2"
              >
                + Otra opción
              </button>
            )}

            <Input
              value={p.explicacion ?? ''}
              onChange={(e) => set(i, { explicacion: e.target.value })}
              placeholder="Explicación (opcional) — se muestra al responder"
              className="mt-2.5 h-9 text-sm"
            />
          </div>
        ))}
      </div>

      <Button
        variant="outline"
        className="w-full"
        onClick={() =>
          setPreguntas((ps) => [...ps, { enunciado: '', opciones: ['', ''], correcta: 0 }])
        }
      >
        <Plus className="mr-1.5 h-4 w-4" /> Agregar pregunta
      </Button>

      <div className="flex justify-end gap-2 border-t pt-3">
        <Button variant="ghost" onClick={onCerrar}>
          Cancelar
        </Button>
        <Button
          onClick={() => {
            setError(null)
            guardar.mutate()
          }}
          disabled={guardar.isPending}
          style={{ backgroundColor: NAVY, color: '#fff' }}
        >
          {guardar.isPending ? 'Guardando…' : 'Guardar preguntas'}
        </Button>
      </div>
    </div>
  )
}
