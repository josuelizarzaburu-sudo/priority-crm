'use client'

import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { AlertTriangle, Check, RotateCcw, Send, X } from 'lucide-react'

const NAVY = '#0C2057'
const GOLD = '#DBAA59'

interface CorreoRenovacion {
  yaEnviado: string | null
  destinatario: string
  plantilla: string | null
  texto: string
  textoGenerado: string | null
  datos: Record<string, string | null>
  plantillasDisponibles: { id: string; etiqueta: string }[]
  faltantes: string[]
}

/**
 * Revisión y envío del correo de renovación.
 *
 * El texto llega ya armado con los datos de la póliza. La ejecutiva lo lee,
 * corrige lo que haga falta en ese caso puntual y envía. No escribe nada de cero:
 * ese era justamente el trabajo que se quería quitar.
 */
export function RenovacionCorreo({
  renovacionId,
  onCerrar,
}: {
  renovacionId: string
  onCerrar: () => void
}) {
  const qc = useQueryClient()
  const [texto, setTexto] = useState('')
  const [destinatario, setDestinatario] = useState('')
  const [plantilla, setPlantilla] = useState('')
  const [error, setError] = useState<string | null>(null)

  const { data, isLoading } = useQuery<CorreoRenovacion>({
    queryKey: ['renovacion', renovacionId, 'correo'],
    queryFn: () => api.get(`/renovaciones/${renovacionId}/correo`).then((r) => r.data),
  })

  useEffect(() => {
    if (!data) return
    setTexto(data.texto)
    setDestinatario(data.destinatario)
    setPlantilla(data.plantilla ?? '')
  }, [data])

  const enviar = useMutation({
    mutationFn: () =>
      api.post(`/renovaciones/${renovacionId}/enviar-correo`, {
        texto,
        destinatario,
        ...(plantilla ? { plantilla } : {}),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['renovaciones'] })
      onCerrar()
    },
    onError: (e: any) => {
      const m = e?.response?.data?.message
      setError(Array.isArray(m) ? m.join(', ') : (m ?? 'No se pudo enviar el correo'))
    },
  })

  if (isLoading || !data) {
    return <p className="py-10 text-center text-sm text-muted-foreground">Cargando…</p>
  }

  const enviado = !!data.yaEnviado
  // Falta el destinatario solo si tampoco lo escribieron a mano: el aviso del
  // servidor se calculó antes de que ella pudiera corregirlo aquí.
  const pendientes = data.faltantes.filter(
    (f) => !(f.includes('correo') && destinatario.trim()),
  )
  const listo = pendientes.length === 0 && !!texto.trim() && !!destinatario.trim()

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-bold" style={{ color: NAVY }}>
            Correo de renovación
          </h2>
          <p className="text-xs text-muted-foreground">
            Revisa el texto, corrige lo que haga falta y envía
          </p>
        </div>
        <button type="button" onClick={onCerrar} aria-label="Cerrar" className="p-1">
          <X className="h-5 w-5" />
        </button>
      </div>

      {enviado && (
        <div className="flex items-start gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2.5 text-sm text-green-800">
          <Check className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-medium">
              Enviado el {new Date(data.yaEnviado!).toLocaleDateString('es-EC')}
            </p>
            <p className="mt-0.5 text-xs">
              Se envió con copia a la ejecutiva, como constancia.
            </p>
          </div>
        </div>
      )}

      {pendientes.length > 0 && !enviado && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5">
          <p className="flex items-center gap-1.5 text-sm font-medium text-amber-900">
            <AlertTriangle className="h-4 w-4" /> Falta completar antes de enviar
          </p>
          <ul className="mt-1.5 space-y-0.5 pl-5 text-xs text-amber-800">
            {pendientes.map((f, i) => (
              <li key={i} className="list-disc">
                {f}
              </li>
            ))}
          </ul>
        </div>
      )}

      {error && (
        <div className="flex items-start justify-between gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} aria-label="Cerrar">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Resumen de los datos que se usaron. Sirve para detectar de un vistazo si
          algo viene mal —una prima o un deducible equivocado— sin tener que
          releer todo el texto buscándolo. */}
      <div className="rounded-xl border p-3.5">
        <p className="mb-2.5 text-xs font-semibold uppercase tracking-wide" style={{ color: GOLD }}>
          Datos usados
        </p>
        <div className="grid gap-x-4 gap-y-2 text-sm sm:grid-cols-2">
          {[
            ['Aseguradora', data.datos.aseguradora],
            ['Plan', data.datos.plan],
            ['Deducible', data.datos.deducible],
            ['Renovación', data.datos.fechaRenovacion],
            ['Forma de pago', data.datos.formaPago],
            ['Prima', data.datos.prima ? `USD ${data.datos.prima}` : null],
            ['Con descuento 5%', data.datos.primaConDescuento ? `USD ${data.datos.primaConDescuento}` : null],
            ['Confirmar hasta', data.datos.fechaLimite],
          ]
            .filter(([, v]) => v)
            .map(([k, v]) => (
              <div key={k as string} className="flex justify-between gap-2">
                <span className="text-muted-foreground">{k}</span>
                <span className="text-right font-medium" style={{ color: NAVY }}>
                  {v}
                </span>
              </div>
            ))}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Enviar a</label>
          <Input
            value={destinatario}
            onChange={(e) => setDestinatario(e.target.value)}
            placeholder="correo@cliente.com"
            disabled={enviado}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Plantilla</label>
          <select
            value={plantilla}
            onChange={(e) => {
              const nueva = e.target.value
              setPlantilla(nueva)
              // Cambiar de plantilla no regenera el texto solo: si ya lo editó,
              // perdería su trabajo sin avisar. Para eso está "Regenerar".
            }}
            disabled={enviado}
            className="h-10 w-full rounded-md border bg-background px-2 text-sm"
          >
            <option value="">— Elegir plantilla —</option>
            {data.plantillasDisponibles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.etiqueta}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between">
          <label className="text-xs text-muted-foreground">Texto del correo</label>
          {!enviado && data.textoGenerado && texto !== data.textoGenerado && (
            <button
              type="button"
              onClick={() => setTexto(data.textoGenerado!)}
              className="flex items-center gap-1 text-[11px] text-muted-foreground underline underline-offset-2"
            >
              <RotateCcw className="h-3 w-3" /> Volver al texto original
            </button>
          )}
        </div>
        <Textarea
          rows={16}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          disabled={enviado}
          className="font-normal leading-relaxed"
        />
        <p className="mt-1 text-[11px] text-muted-foreground">
          Se envía tal como se ve aquí. Los saltos de línea se convierten en párrafos.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
        <Button variant="ghost" onClick={onCerrar}>
          Cerrar
        </Button>
        {!enviado && (
          <Button
            onClick={() => {
              setError(null)
              enviar.mutate()
            }}
            disabled={!listo || enviar.isPending}
            style={{ backgroundColor: NAVY, color: '#fff' }}
          >
            <Send className="mr-1.5 h-4 w-4" />
            {enviar.isPending ? 'Enviando…' : 'Enviar correo'}
          </Button>
        )}
      </div>
    </div>
  )
}
