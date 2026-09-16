'use client'

import { useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Car, Check, MessageSquare, Paperclip, Send, TriangleAlert, X } from 'lucide-react'
import { ASEGURADORAS_VEHICULO, FORMAS_PAGO_VEHICULO, planesDe } from './planes-vehiculo'

const NAVY = '#0C2057'
const GOLD = '#DBAA59'
const VERDE = '#15803d'
const ROJO = '#dc2626'
const AMBAR = '#b45309'

/**
 * Límite de los adjuntos.
 *
 * El mismo que en los correos de renovación: el servidor rechaza peticiones más
 * grandes, y avisar aquí evita que el comercial pierda el trabajo al enviar.
 */
const MAX_MB = 8
const MAX_ARCHIVOS = 5

type Estado = 'DE_INSPECCION' | 'APROBADO' | 'RECHAZADO_DEFINITIVO' | 'RECHAZADO_OBSERVACION'

const COMO_SE_VE: Record<Estado, { label: string; color: string; fondo: string }> = {
  DE_INSPECCION: { label: 'De inspección', color: AMBAR, fondo: '#fffbeb' },
  APROBADO: { label: 'Aprobado', color: VERDE, fondo: '#f0fdf4' },
  RECHAZADO_DEFINITIVO: { label: 'Rechazado', color: ROJO, fondo: '#fef2f2' },
  RECHAZADO_OBSERVACION: { label: 'Rechazado con observación', color: ROJO, fondo: '#fef2f2' },
}

interface Inspeccion {
  id: string
  estado: Estado
  aseguradora: string | null
  marca: string | null
  modelo: string | null
  anio: number | null
  placa: string | null
  enviadaEn: string | null
  resueltaEn: string | null
  observacion: string | null
  intentos: number
  notas: { id: string; texto: string; autorNombre: string | null; createdAt: string }[]
}

/**
 * Inspección del vehículo, previa al cierre.
 *
 * Solo aparece en negocios de AUTO: en salud no existe este paso y mostrarlo
 * sería ruido para quien vende planes médicos.
 */
export function BloqueInspeccion({
  dealId,
  puedeResolver,
  cedulaActual,
  correoActual,
  onGuardarCedula,
}: {
  dealId: string
  /** Fidelización y gerencia registran el resultado; el comercial solo envía. */
  puedeResolver: boolean
  /** Cédula y correo del cliente: la aseguradora los exige para la inspección. */
  cedulaActual?: string | null
  correoActual?: string | null
  onGuardarCedula?: (cedula: string) => void
}) {
  const qc = useQueryClient()
  const archivoRef = useRef<HTMLInputElement>(null)

  const [form, setForm] = useState<Record<string, string>>({})
  const [nota, setNota] = useState('')
  const [adjuntos, setAdjuntos] = useState<{ filename: string; content: string; size: number }[]>([])
  const [error, setError] = useState<string | null>(null)
  const [cedula, setCedula] = useState('')

  /**
   * Lo que la aseguradora exige para abrir el trámite.
   *
   * Se comprueba ANTES de enviar y no después: mandar una solicitud incompleta
   * hace que Gianella tenga que volver a pedir los datos, y eso son días.
   */
  const faltan = [
    !(cedulaActual ?? cedula).trim() ? 'cédula' : '',
    !correoActual?.trim() ? 'correo' : '',
    !form.direccion?.trim() ? 'dirección' : '',
    !form.aseguradora?.trim() ? 'aseguradora' : '',
    !form.plan?.trim() ? 'plan' : '',
    !form.formaPago?.trim() ? 'forma de pago' : '',
    !form.placa?.trim() ? 'placa' : '',
    !form.marca?.trim() ? 'marca' : '',
    !form.modelo?.trim() ? 'modelo' : '',
    !form.anio?.trim() ? 'año' : '',
    adjuntos.length === 0 ? 'la cotización o la matrícula' : '',
  ].filter(Boolean)

  const planesDisponibles = planesDe(form.aseguradora)
  const [observacion, setObservacion] = useState('')
  const [resolviendo, setResolviendo] = useState<Estado | null>(null)

  const { data: insp, isLoading } = useQuery<Inspeccion | null>({
    queryKey: ['inspeccion', dealId],
    queryFn: () => api.get(`/inspecciones/deal/${dealId}`).then((r) => r.data),
  })

  const refrescar = () => {
    qc.invalidateQueries({ queryKey: ['inspeccion', dealId] })
    qc.invalidateQueries({ queryKey: ['deal', dealId] })
  }

  const fallo = (e: any) => {
    const m = e?.response?.data?.message
    setError(Array.isArray(m) ? m.join(', ') : (m ?? 'No se pudo completar'))
  }

  const enviar = useMutation({
    mutationFn: () =>
      api.post(`/inspecciones/deal/${dealId}/enviar`, {
        ...form,
        ...(form.anio ? { anio: Number(form.anio) } : {}),
        nota: nota.trim() || undefined,
        adjuntos: adjuntos.map(({ filename, content }) => ({ filename, content })),
      }),
    onSuccess: () => {
      setAdjuntos([])
      setNota('')
      setError(null)
      refrescar()
    },
    onError: fallo,
  })

  /**
   * Comentar sin cambiar el estado.
   *
   * Va en los dos sentidos: Fidelización avisa que coordinó la cita, el comercial
   * responde que el cliente cambió de día. Antes eso se hablaba por fuera y no
   * quedaba en ningún lado.
   */
  const [comentando, setComentando] = useState(false)
  const [comentario, setComentario] = useState('')

  const comentar = useMutation({
    mutationFn: () =>
      api.post(`/inspecciones/deal/${dealId}/comentar`, { texto: comentario }),
    onSuccess: () => {
      setComentario('')
      setComentando(false)
      setError(null)
      refrescar()
    },
    onError: fallo,
  })

  const resolver = useMutation({
    mutationFn: (estado: Estado) =>
      api.post(`/inspecciones/deal/${dealId}/resolver`, {
        estado,
        observacion: observacion.trim() || undefined,
      }),
    onSuccess: () => {
      setObservacion('')
      setResolviendo(null)
      setError(null)
      refrescar()
    },
    onError: fallo,
  })

  async function agregarArchivos(files: FileList) {
    setError(null)
    const nuevos: typeof adjuntos = []

    for (const f of Array.from(files)) {
      if (adjuntos.length + nuevos.length >= MAX_ARCHIVOS) {
        setError(`Máximo ${MAX_ARCHIVOS} archivos`)
        break
      }
      const b64 = await new Promise<string>((res, rej) => {
        const r = new FileReader()
        r.onload = () => res(String(r.result).split(',')[1] ?? '')
        r.onerror = () => rej(new Error('No se pudo leer el archivo'))
        r.readAsDataURL(f)
      })
      nuevos.push({ filename: f.name, content: b64, size: f.size })
    }

    const total = [...adjuntos, ...nuevos].reduce((s, a) => s + a.size, 0)
    if (total > MAX_MB * 1024 * 1024) {
      setError(`Los archivos suman más de ${MAX_MB} MB. Quita alguno o compártelo por otro medio.`)
      return
    }
    setAdjuntos((a) => [...a, ...nuevos])
  }

  if (isLoading) return null

  const estado = insp?.estado
  const v = estado ? COMO_SE_VE[estado] : null

  return (
    <div className="rounded-xl border p-3.5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-sm font-semibold" style={{ color: NAVY }}>
          <Car className="h-4 w-4" style={{ color: GOLD }} />
          Inspección del vehículo
        </p>
        {v && (
          <span
            className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
            style={{ backgroundColor: v.fondo, color: v.color }}
          >
            {v.label}
            {insp!.intentos > 1 && ` · intento ${insp!.intentos}`}
          </span>
        )}
      </div>

      {error && (
        <div className="mb-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2 text-xs text-amber-900">
          <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Aprobada: el trabajo está hecho y lo único que importa es que se puede
          cerrar. Sin formularios de por medio. */}
      {estado === 'APROBADO' && (
        <p className="rounded-lg px-3 py-2 text-xs" style={{ backgroundColor: '#f0fdf4', color: VERDE }}>
          <Check className="mr-1 inline h-3.5 w-3.5" />
          Inspección aprobada. Ya puedes cerrar el negocio.
        </p>
      )}

      {estado === 'RECHAZADO_DEFINITIVO' && (
        <div className="rounded-lg px-3 py-2 text-xs" style={{ backgroundColor: '#fef2f2', color: ROJO }}>
          <p className="font-medium">Rechazada en definitivo.</p>
          {insp?.observacion && <p className="mt-0.5">{insp.observacion}</p>}
          <p className="mt-1 opacity-80">
            No se puede emitir esta póliza. Si vas a intentar con otra aseguradora, déjalo
            anotado en el negocio.
          </p>
        </div>
      )}

      {estado === 'RECHAZADO_OBSERVACION' && (
        <div className="mb-3 rounded-lg px-3 py-2 text-xs" style={{ backgroundColor: '#fef2f2', color: ROJO }}>
          <p className="font-medium">Rechazada con observación:</p>
          <p className="mt-0.5">{insp?.observacion}</p>
          <p className="mt-1 opacity-80">
            Cuando esté corregido, vuelve a enviarla más abajo.
          </p>
        </div>
      )}

      {/* Formulario de envío: al inicio, y también tras una observación para
          poder reinspeccionar. */}
      {(!insp || estado === 'RECHAZADO_OBSERVACION') && (
        <div className="space-y-2.5">
          {/* La cédula se pide AQUÍ porque la aseguradora la exige para abrir
              el trámite, y hasta ahora no había dónde ponerla antes de cerrar:
              solo aparecía en el modal de cierre, que es un paso posterior. */}
          {!cedulaActual && (
            <div>
              <Input
                placeholder="Cédula o RUC del cliente"
                value={cedula}
                onChange={(e) => setCedula(e.target.value)}
                onBlur={() => cedula.trim() && onGuardarCedula?.(cedula.trim())}
                className="h-9 text-sm"
              />
              <p className="mt-1 text-[11px] text-muted-foreground">
                La aseguradora la necesita para la inspección.
              </p>
            </div>
          )}

          {!correoActual && (
            <p className="rounded-md bg-amber-50 px-2.5 py-1.5 text-[11px] text-amber-900">
              Falta el correo del cliente. Cárgalo arriba, en los datos del contacto.
            </p>
          )}

          <Input
            placeholder="Dirección del cliente"
            value={form.direccion ?? ''}
            onChange={(e) => setForm((f) => ({ ...f, direccion: e.target.value }))}
            className="h-9 text-sm"
          />

          <div className="grid gap-2 sm:grid-cols-2">
            <select
              value={form.aseguradora ?? insp?.aseguradora ?? ''}
              onChange={(e) =>
                // Al cambiar de aseguradora se limpia el plan: los planes de una
                // no existen en la otra.
                setForm((f) => ({ ...f, aseguradora: e.target.value, plan: '' }))
              }
              className="h-9 rounded-md border bg-background px-2 text-sm"
            >
              <option value="">Aseguradora…</option>
              {ASEGURADORAS_VEHICULO.map((a) => (
                <option key={a.nombre} value={a.nombre}>
                  {a.nombre}
                </option>
              ))}
            </select>

            {/* El plan sale de la aseguradora elegida. Si no tiene lista —o el
                plan no está en ella— se escribe: las aseguradoras cambian su
                oferta y esperar a que se actualice bloquearía una venta. */}
            {planesDisponibles.length > 0 ? (
              <select
                value={form.plan ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, plan: e.target.value }))}
                className="h-9 rounded-md border bg-background px-2 text-sm"
              >
                <option value="">Plan…</option>
                {planesDisponibles.map((pl) => (
                  <option key={pl} value={pl}>
                    {pl}
                  </option>
                ))}
                <option value="__otro">Otro (escribir)</option>
              </select>
            ) : (
              <Input
                placeholder="Plan"
                value={form.plan ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, plan: e.target.value }))}
                className="h-9 text-sm"
              />
            )}

            {form.plan === '__otro' && (
              <Input
                autoFocus
                placeholder="Escribe el plan"
                value={form.planLibre ?? ''}
                onChange={(e) =>
                  setForm((f) => ({ ...f, planLibre: e.target.value, plan: e.target.value }))
                }
                className="h-9 text-sm sm:col-span-2"
              />
            )}

            <select
              value={form.formaPago ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, formaPago: e.target.value }))}
              className="h-9 rounded-md border bg-background px-2 text-sm"
            >
              <option value="">Forma de pago…</option>
              {FORMAS_PAGO_VEHICULO.map((fp) => (
                <option key={fp} value={fp}>
                  {fp}
                </option>
              ))}
            </select>

            <Input
              placeholder="Placa"
              value={form.placa ?? insp?.placa ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, placa: e.target.value.toUpperCase() }))}
              className="h-9 text-sm"
            />
            <Input
              placeholder="Marca"
              value={form.marca ?? insp?.marca ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, marca: e.target.value }))}
              className="h-9 text-sm"
            />
            <Input
              placeholder="Modelo"
              value={form.modelo ?? insp?.modelo ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, modelo: e.target.value }))}
              className="h-9 text-sm"
            />
            <Input
              placeholder="Año"
              inputMode="numeric"
              value={form.anio ?? (insp?.anio ? String(insp.anio) : '')}
              onChange={(e) => setForm((f) => ({ ...f, anio: e.target.value }))}
              className="h-9 text-sm"
            />
          </div>

          <Input
            placeholder="Nota para Fidelización (opcional)"
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            className="h-9 text-sm"
          />

          {/* Adjuntos: la cotización de la aseguradora y la matrícula. Viajan en
              el correo y no se guardan. */}
          <div>
            <input
              ref={archivoRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files?.length) agregarArchivos(e.target.files)
                e.target.value = ''
              }}
            />
            <button
              type="button"
              onClick={() => archivoRef.current?.click()}
              className="flex items-center gap-1.5 text-xs underline underline-offset-2"
              style={{ color: NAVY }}
            >
              <Paperclip className="h-3.5 w-3.5" />
              Adjuntar cotización y matrícula
            </button>

            {adjuntos.length > 0 && (
              <div className="mt-1.5 space-y-1">
                {adjuntos.map((a, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between gap-2 rounded border px-2 py-1 text-[11px]"
                  >
                    <span className="min-w-0 flex-1 truncate">{a.filename}</span>
                    <span className="shrink-0 text-muted-foreground">
                      {Math.round(a.size / 1024)} KB
                    </span>
                    <button
                      type="button"
                      onClick={() => setAdjuntos((x) => x.filter((_, j) => j !== i))}
                      className="shrink-0 text-muted-foreground hover:text-red-600"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Se dice QUE falta, no solo que el botón está apagado. */}
          {faltan.length > 0 && (
            <p className="rounded-md bg-amber-50 px-2.5 py-1.5 text-[11px] text-amber-900">
              Falta para poder enviar: {faltan.join(', ')}.
            </p>
          )}

          <Button
            size="sm"
            onClick={() => enviar.mutate()}
            disabled={enviar.isPending || faltan.length > 0}
            style={{ backgroundColor: NAVY, color: '#fff' }}
          >
            <Send className="mr-1.5 h-3.5 w-3.5" />
            {enviar.isPending
              ? 'Enviando…'
              : estado === 'RECHAZADO_OBSERVACION'
                ? 'Volver a enviar'
                : 'Enviar a inspección'}
          </Button>
        </div>
      )}

      {/* Registrar el resultado: solo Fidelización, y solo mientras está en
          curso. */}
      {puedeResolver && estado === 'DE_INSPECCION' && (
        <div className="mt-3 space-y-2 border-t pt-3">
          <p className="text-xs font-medium text-muted-foreground">Registrar el resultado</p>

          {resolviendo && resolviendo !== 'APROBADO' && (
            <Input
              placeholder={
                resolviendo === 'RECHAZADO_OBSERVACION'
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
              onClick={() => resolver.mutate('APROBADO')}
              disabled={resolver.isPending}
            >
              <Check className="mr-1 h-3.5 w-3.5" /> Aprobada
            </Button>

            {(
              [
                ['RECHAZADO_OBSERVACION', 'Con observación'],
                ['RECHAZADO_DEFINITIVO', 'Rechazo definitivo'],
              ] as const
            ).map(([id, label]) => (
              <Button
                key={id}
                size="sm"
                variant="outline"
                className="border-red-300 text-red-700 hover:bg-red-50"
                onClick={() => {
                  // Primero se pide el motivo y en el segundo clic se envía: con
                  // observación el motivo es obligatorio, y sin este paso el
                  // servidor rechazaría el envío.
                  if (resolviendo === id) resolver.mutate(id)
                  else setResolviendo(id)
                }}
                disabled={resolver.isPending}
              >
                {resolviendo === id ? 'Confirmar' : label}
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Comentar: disponible siempre que exista la inspección, sin importar su
          estado. La coordinación pasa antes, durante y después del resultado. */}
      {insp && (
        <div className="mt-2.5 border-t pt-2.5">
          {comentando ? (
            <div className="flex gap-1.5">
              <input
                autoFocus
                value={comentario}
                onChange={(e) => setComentario(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && comentario.trim()) comentar.mutate()
                  if (e.key === 'Escape') setComentando(false)
                }}
                placeholder="Ej: el cliente pidió cambiar la cita al viernes"
                className="h-8 flex-1 rounded-md border bg-background px-2 text-xs"
              />
              <button
                type="button"
                onClick={() => comentar.mutate()}
                disabled={!comentario.trim() || comentar.isPending}
                className="rounded-md px-2 text-xs font-medium disabled:opacity-40"
                style={{ color: NAVY }}
              >
                Enviar
              </button>
              <button
                type="button"
                onClick={() => setComentando(false)}
                className="px-1 text-muted-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setComentando(true)}
              className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:underline"
            >
              <MessageSquare className="h-3 w-3" /> Comentar
            </button>
          )}
        </div>
      )}

      {/* Bitácora: qué se envió y qué respondieron, con fecha. */}
      {insp?.notas && insp.notas.length > 0 && (
        <details className="mt-3 border-t pt-2">
          <summary className="cursor-pointer text-[11px] text-muted-foreground">
            Historial ({insp.notas.length})
          </summary>
          <div className="mt-1.5 space-y-1">
            {insp.notas.map((n) => (
              <div key={n.id} className="rounded bg-muted/40 px-2 py-1 text-[11px]">
                <p>{n.texto}</p>
                <p className="mt-0.5 text-muted-foreground">
                  {n.autorNombre ?? 'Alguien'} ·{' '}
                  {new Date(n.createdAt).toLocaleDateString('es-EC', {
                    day: 'numeric',
                    month: 'short',
                  })}
                </p>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  )
}
