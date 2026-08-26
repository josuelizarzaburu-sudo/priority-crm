'use client'

import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { AlertTriangle, Check, Eye, Mail, Phone, Send, X } from 'lucide-react'

const NAVY = '#0C2057'
const GOLD = '#DBAA59'

interface DatosBienvenida {
  yaEnviada: string | null
  preexistencias: string | null
  cliente: { nombreCompleto: string; email: string | null; tratamiento: string } | null
  poliza: {
    aseguradora: string | null
    plan: string | null
    deducible: string | null
    vigenciaDesde: string | null
  } | null
  ejecutiva: { nombre: string; email: string; celular: string | null } | null
  faltantes: string[]
}

function Dato({ label, valor }: { label: string; valor?: string | null }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm" style={{ color: valor ? NAVY : '#94a3b8' }}>
        {valor || '— falta'}
      </p>
    </div>
  )
}

/**
 * Formulario de un requerimiento de BIENVENIDA.
 *
 * Es distinto del formulario general de requerimientos a proposito: ahi hay
 * campos que no aplican (paciente, fecha de envio a la aseguradora, contrato) y
 * faltan los que si importan aqui, que son los que salen en la carta.
 *
 * Los datos del plan y de la ejecutiva se muestran de solo lectura: se extraen
 * del cliente y su poliza, y esta pantalla es para REVISARLOS. Si algo esta mal,
 * se corrige en la ficha, que es donde vive el dato — editarlo aqui crearia dos
 * versiones de la misma informacion.
 */
export function BienvenidaForm({
  requerimientoId,
  onCerrar,
}: {
  requerimientoId: string
  onCerrar: () => void
}) {
  const qc = useQueryClient()
  const [preexistencias, setPreexistencias] = useState('')
  const [error, setError] = useState<string | null>(null)
  /**
   * Vista previa. No es un paso obligatorio antes de enviar: si lo fuera, se
   * aprendería a saltar y dejaría de proteger. Está para mirar cuando se quiera,
   * sobre todo las primeras veces.
   */
  const [previa, setPrevia] = useState(false)

  const { data, isLoading } = useQuery<DatosBienvenida>({
    queryKey: ['requerimiento', requerimientoId, 'bienvenida'],
    queryFn: () => api.get(`/requerimientos/${requerimientoId}/datos-bienvenida`).then((r) => r.data),
  })

  useEffect(() => {
    if (data?.preexistencias) setPreexistencias(data.preexistencias)
  }, [data?.preexistencias])

  const guardar = useMutation({
    mutationFn: () => api.patch(`/requerimientos/${requerimientoId}`, { preexistencias }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['requerimiento', requerimientoId, 'bienvenida'] })
      qc.invalidateQueries({ queryKey: ['requerimientos'] })
    },
    onError: (e: any) => setError(e?.response?.data?.message ?? 'No se pudo guardar'),
  })

  const vistaPrevia = useQuery<{ para: string; copiaA: string; asunto: string; html: string }>({
    queryKey: ['requerimiento', requerimientoId, 'vista-previa'],
    queryFn: () =>
      api.get(`/requerimientos/${requerimientoId}/vista-previa-bienvenida`).then((r) => r.data),
    // Solo se pide cuando se abre: no tiene sentido cargarla si nadie la mira.
    enabled: previa,
  })

  const enviar = useMutation({
    // Se guardan las preexistencias antes de enviar: si se escribieron y no se
    // guardo, la carta saldria sin ellas y no habria como notarlo.
    mutationFn: async () => {
      await api.patch(`/requerimientos/${requerimientoId}`, { preexistencias })
      return api.post(`/requerimientos/${requerimientoId}/enviar-bienvenida`)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['requerimientos'] })
      onCerrar()
    },
    onError: (e: any) => {
      const m = e?.response?.data?.message
      setError(Array.isArray(m) ? m.join(', ') : (m ?? 'No se pudo enviar la carta'))
    },
  })

  if (isLoading || !data) {
    return <p className="py-10 text-center text-sm text-muted-foreground">Cargando…</p>
  }

  const listo = data.faltantes.length === 0
  const enviada = !!data.yaEnviada

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-bold" style={{ color: NAVY }}>
            Carta de bienvenida
          </h2>
          <p className="text-xs text-muted-foreground">
            Revisa los datos y agrega las preexistencias antes de enviar
          </p>
        </div>
        <button type="button" onClick={onCerrar} aria-label="Cerrar" className="p-1">
          <X className="h-5 w-5" />
        </button>
      </div>

      {enviada && (
        <div className="flex items-start gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2.5 text-sm text-green-800">
          <Check className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-medium">
              Enviada el {new Date(data.yaEnviada!).toLocaleDateString('es-EC')}
            </p>
            <p className="mt-0.5 text-xs">
              El requerimiento quedó como solucionado y sale de la bandeja de pendientes.
            </p>
          </div>
        </div>
      )}

      {/* Lo que falta se lista con detalle en vez de un error generico: asi la
          ejecutiva sabe exactamente que completar y en que ficha. */}
      {!listo && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5">
          <p className="flex items-center gap-1.5 text-sm font-medium text-amber-900">
            <AlertTriangle className="h-4 w-4" /> Falta completar antes de enviar
          </p>
          <ul className="mt-1.5 space-y-0.5 pl-5 text-xs text-amber-800">
            {data.faltantes.map((f, i) => (
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

      <div className="rounded-xl border p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide" style={{ color: GOLD }}>
          Cliente y plan
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Dato label="Cliente" valor={data.cliente?.nombreCompleto} />
          <Dato label="Correo" valor={data.cliente?.email} />
          <Dato label="Compañía de seguros" valor={data.poliza?.aseguradora} />
          <Dato label="Plan médico" valor={data.poliza?.plan} />
          <Dato label="Deducible" valor={data.poliza?.deducible} />
          <Dato label="Vigente desde" valor={data.poliza?.vigenciaDesde} />
        </div>
      </div>

      <div className="rounded-xl border p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide" style={{ color: GOLD }}>
          Ejecutiva de cuenta
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Dato label="Nombre" valor={data.ejecutiva?.nombre} />
          <div>
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Correo</p>
            <p className="mt-0.5 flex items-center gap-1 text-sm" style={{ color: NAVY }}>
              <Mail className="h-3 w-3" /> {data.ejecutiva?.email ?? '— falta'}
            </p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Celular</p>
            <p className="mt-0.5 flex items-center gap-1 text-sm" style={{ color: NAVY }}>
              <Phone className="h-3 w-3" /> {data.ejecutiva?.celular ?? '— sin celular'}
            </p>
          </div>
        </div>
        <p className="mt-3 text-[11px] text-muted-foreground">
          La carta se envía con copia a la ejecutiva, como constancia.
        </p>
      </div>

      <div className="rounded-xl border p-4">
        <p className="mb-1 text-xs font-semibold uppercase tracking-wide" style={{ color: GOLD }}>
          Diagnósticos preexistentes
        </p>
        <p className="mb-2 text-[11px] text-muted-foreground">
          Uno por línea, tal como salen en la póliza. Si lo dejas vacío, el párrafo de
          carencias no aparece en la carta.
        </p>
        <Textarea
          rows={4}
          value={preexistencias}
          onChange={(e) => setPreexistencias(e.target.value)}
          placeholder={'Ej:\nHipertensión arterial\nDiabetes tipo 2'}
          disabled={enviada}
        />
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
        <Button variant="ghost" onClick={onCerrar}>
          Cancelar
        </Button>
        <Button variant="outline" onClick={() => setPrevia(true)} disabled={!listo}>
          <Eye className="mr-1.5 h-4 w-4" /> Ver cómo queda
        </Button>
        {!enviada && (
          <>
            <Button
              variant="outline"
              onClick={() => guardar.mutate()}
              disabled={guardar.isPending}
            >
              {guardar.isPending ? 'Guardando…' : 'Guardar'}
            </Button>
            <Button
              onClick={() => {
                setError(null)
                enviar.mutate()
              }}
              disabled={!listo || enviar.isPending}
              style={{ backgroundColor: NAVY, color: '#fff' }}
            >
              <Send className="mr-1.5 h-4 w-4" />
              {enviar.isPending ? 'Enviando…' : 'Enviar carta'}
            </Button>
          </>
        )}
      </div>

      {previa && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4"
          onClick={() => setPrevia(false)}
        >
          <div
            className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl bg-white"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b p-4">
              <div className="min-w-0">
                <p className="text-sm font-semibold" style={{ color: NAVY }}>
                  Así lo recibe el cliente
                </p>
                {vistaPrevia.data && (
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    Para {vistaPrevia.data.para} · copia a {vistaPrevia.data.copiaA}
                  </p>
                )}
              </div>
              <button type="button" onClick={() => setPrevia(false)} aria-label="Cerrar">
                <X className="h-5 w-5" />
              </button>
            </div>

            {vistaPrevia.isLoading ? (
              <p className="p-10 text-center text-sm text-muted-foreground">Cargando…</p>
            ) : vistaPrevia.data ? (
              <>
                <div className="border-b bg-muted/40 px-4 py-2">
                  <p className="text-xs text-muted-foreground">Asunto</p>
                  <p className="text-sm font-medium" style={{ color: NAVY }}>
                    {vistaPrevia.data.asunto}
                  </p>
                </div>
                {/* Se muestra en un iframe aislado a propósito: el HTML del
                    correo trae sus propios estilos y, puesto directamente en la
                    página, se mezclarían con los del CRM y la previa mostraría
                    algo distinto a lo que llega. */}
                <iframe
                  title="Vista previa del correo"
                  srcDoc={vistaPrevia.data.html}
                  sandbox=""
                  className="min-h-[420px] w-full flex-1 border-0"
                />
              </>
            ) : (
              <p className="p-10 text-center text-sm text-muted-foreground">
                No se pudo cargar la vista previa.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
