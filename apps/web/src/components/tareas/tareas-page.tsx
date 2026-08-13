'use client'

import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { BuscadorCliente, type ClienteSugerido } from '@/components/reclamos/buscador-cliente'
import {
  AlertTriangle,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Inbox,
  Plus,
  Trash2,
  User,
  X,
} from 'lucide-react'

const NAVY = '#0C2057'
const GOLD = '#DBAA59'
const VERDE = '#5FD38D'

/** Quién puede asignarle tareas a otra persona. Debe coincidir con la API. */
const PUEDE_ASIGNAR = ['SUPER_ADMIN', 'OWNER', 'MANAGER', 'JEFE_OPERACIONES']

interface Persona {
  id: string
  name: string
}

interface Tarea {
  id: string
  titulo: string
  detalle: string | null
  prioridad: 'ALTA' | 'MEDIA' | 'BAJA'
  fechaLimite: string | null
  completadaEn: string | null
  asignado: { id: string; name: string }
  solicitante: { id: string; name: string }
  cliente: { id: string; nombres: string; apellidos: string } | null
}

const PRIORIDAD: Record<string, { color: string; fondo: string; label: string }> = {
  ALTA: { color: '#dc2626', fondo: '#fef2f2', label: 'Alta' },
  MEDIA: { color: '#d97706', fondo: '#fffbeb', label: 'Media' },
  BAJA: { color: '#64748b', fondo: '#f8fafc', label: 'Baja' },
}

function hoyISO(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Guayaquil',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

const diaDe = (f: string | null) => (f ? f.slice(0, 10) : null)

function fechaLegible(iso: string): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString('es-EC', {
    day: 'numeric',
    month: 'short',
  })
}

/**
 * Rejilla del mes: 6 semanas de 7 días, con los días de relleno del mes anterior
 * y el siguiente para que las columnas cuadren con los nombres de los días.
 *
 * Todo se calcula en UTC porque las fechas de las tareas se guardan sin hora. Si
 * se usara la hora local, en Ecuador (UTC-5) los días saldrían corridos.
 */
function armarMes(ancla: string): { iso: string; delMes: boolean }[] {
  const [a, m] = ancla.split('-').map(Number)
  const primero = new Date(Date.UTC(a, m - 1, 1))
  // Retrocede hasta el domingo de esa semana.
  const inicio = new Date(primero)
  inicio.setUTCDate(inicio.getUTCDate() - inicio.getUTCDay())

  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(inicio)
    d.setUTCDate(inicio.getUTCDate() + i)
    return { iso: d.toISOString().slice(0, 10), delMes: d.getUTCMonth() === m - 1 }
  })
}

function nombreMes(ancla: string): string {
  const [a, m] = ancla.split('-').map(Number)
  const t = new Date(Date.UTC(a, m - 1, 1)).toLocaleDateString('es-EC', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
  return t.charAt(0).toUpperCase() + t.slice(1)
}

function moverMes(ancla: string, delta: number): string {
  const [a, m] = ancla.split('-').map(Number)
  const d = new Date(Date.UTC(a, m - 1 + delta, 1))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

const DIAS_SEMANA = ['D', 'L', 'M', 'M', 'J', 'V', 'S']

export function TareasPage() {
  const qc = useQueryClient()
  const { data: session } = useSession()
  const yo = (session?.user as any)?.id as string | undefined
  const rol = (session?.user as any)?.role ?? ''
  const puedeAsignar = PUEDE_ASIGNAR.includes(rol)

  const [creando, setCreando] = useState(false)
  const [titulo, setTitulo] = useState('')
  const [detalle, setDetalle] = useState('')
  const [prioridad, setPrioridad] = useState('MEDIA')
  const [fechaLimite, setFechaLimite] = useState(hoyISO())
  const [asignadoId, setAsignadoId] = useState('')
  const [clienteTexto, setClienteTexto] = useState('')
  const [clienteId, setClienteId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [verTodas, setVerTodas] = useState(false)
  const [mes, setMes] = useState(() => hoyISO().slice(0, 7))
  /** Día seleccionado en el calendario. null = ver todo. */
  const [diaFiltro, setDiaFiltro] = useState<string | null>(null)

  const { data: tareas = [], isLoading } = useQuery<Tarea[]>({
    queryKey: ['tareas', verTodas],
    queryFn: () =>
      api.get(`/tareas${verTodas ? '?incluirCompletadas=true' : ''}`).then((r) => r.data),
  })

  const { data: equipo = [] } = useQuery<Persona[]>({
    queryKey: ['users'],
    queryFn: () => api.get('/users').then((r) => r.data),
    enabled: puedeAsignar,
  })

  const refrescar = () => qc.invalidateQueries({ queryKey: ['tareas'] })
  const fallo = (e: any) =>
    setError(e?.response?.data?.message ?? 'No se pudo completar la acción')

  function limpiar() {
    setTitulo('')
    setDetalle('')
    setPrioridad('MEDIA')
    setFechaLimite(hoyISO())
    setAsignadoId('')
    setClienteTexto('')
    setClienteId(null)
    setCreando(false)
    setError(null)
  }

  const crear = useMutation({
    mutationFn: () =>
      api.post('/tareas', {
        titulo,
        // Si escribieron un nombre suelto sin elegir de la base, se guarda en el
        // detalle: sirve igual para saber de quién se trata, sin obligar a que
        // exista la ficha.
        ...(detalle.trim() || (clienteTexto.trim() && !clienteId)
          ? {
              detalle: [detalle.trim(), !clienteId && clienteTexto.trim() ? `Cliente: ${clienteTexto.trim()}` : '']
                .filter(Boolean)
                .join(' · '),
            }
          : {}),
        prioridad,
        ...(fechaLimite ? { fechaLimite } : {}),
        ...(asignadoId ? { asignadoId } : {}),
        ...(clienteId ? { clienteId } : {}),
      }),
    onSuccess: () => {
      limpiar()
      refrescar()
    },
    onError: fallo,
  })

  const alternar = useMutation({
    mutationFn: (id: string) => api.patch(`/tareas/${id}/completada`),
    onSuccess: refrescar,
    onError: fallo,
  })

  const borrar = useMutation({
    mutationFn: (id: string) => api.delete(`/tareas/${id}`),
    onSuccess: refrescar,
    onError: fallo,
  })

  // Se agrupa por urgencia y no por fecha exacta: al abrir la pantalla lo que
  // importa es "qué se me pasó" y "qué toca hoy".
  const g = useMemo(() => {
    const hoy = hoyISO()
    const vencidas: Tarea[] = []
    const deHoy: Tarea[] = []
    const proximas: Tarea[] = []
    const sinFecha: Tarea[] = []
    const hechas: Tarea[] = []
    for (const t of tareas) {
      if (t.completadaEn) {
        hechas.push(t)
        continue
      }
      const d = diaDe(t.fechaLimite)
      if (!d) sinFecha.push(t)
      else if (d < hoy) vencidas.push(t)
      else if (d === hoy) deHoy.push(t)
      else proximas.push(t)
    }
    return { vencidas, deHoy, proximas, sinFecha, hechas }
  }, [tareas])

  const pendientes = g.vencidas.length + g.deHoy.length + g.proximas.length + g.sinFecha.length

  /**
   * Cuantas tareas pendientes tiene cada dia, para pintar los puntos del
   * calendario. Solo pendientes: un dia lleno de tareas ya hechas no deberia
   * verse igual de cargado que uno con trabajo por delante.
   */
  const porDia = useMemo(() => {
    const m = new Map<string, { total: number; alta: boolean }>()
    for (const t of tareas) {
      if (t.completadaEn) continue
      const d = diaDe(t.fechaLimite)
      if (!d) continue
      const actual = m.get(d) ?? { total: 0, alta: false }
      m.set(d, { total: actual.total + 1, alta: actual.alta || t.prioridad === 'ALTA' })
    }
    return m
  }, [tareas])

  /** Tareas del dia elegido en el calendario. */
  const tareasDelDia = useMemo(
    () => (diaFiltro ? tareas.filter((t) => diaDe(t.fechaLimite) === diaFiltro) : []),
    [tareas, diaFiltro],
  )

  const Tarjeta = ({ t, urgente }: { t: Tarea; urgente?: boolean }) => {
    const p = PRIORIDAD[t.prioridad]
    const hecha = !!t.completadaEn
    const pedidaPorOtro = t.solicitante.id !== yo && t.solicitante.id !== t.asignado.id
    const asignadaAOtro = t.asignado.id !== yo

    return (
      <div
        className="group flex items-start gap-3 rounded-xl border bg-card p-3.5 transition-shadow hover:shadow-sm"
        style={{
          // Franja de color a la izquierda: la prioridad se lee de un vistazo,
          // sin recorrer la etiqueta de cada tarjeta.
          borderLeftWidth: 4,
          borderLeftColor: hecha ? '#e2e8f0' : p.color,
          opacity: hecha ? 0.6 : 1,
        }}
      >
        <button
          type="button"
          onClick={() => alternar.mutate(t.id)}
          aria-label={hecha ? 'Marcar como pendiente' : 'Marcar como hecha'}
          className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors"
          style={{
            borderColor: hecha ? VERDE : '#cbd5e1',
            backgroundColor: hecha ? VERDE : 'transparent',
          }}
        >
          {hecha && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
        </button>

        <div className="min-w-0 flex-1">
          <p
            className="text-sm font-medium leading-snug"
            style={{
              color: hecha ? '#94a3b8' : NAVY,
              textDecoration: hecha ? 'line-through' : undefined,
            }}
          >
            {t.titulo}
          </p>

          {t.detalle && (
            <p className="mt-1 whitespace-pre-line text-xs text-muted-foreground">{t.detalle}</p>
          )}

          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
            {t.fechaLimite && (
              <span
                className="inline-flex items-center gap-1"
                style={{ color: urgente && !hecha ? '#dc2626' : undefined }}
              >
                <CalendarDays className="h-3 w-3" />
                {fechaLegible(diaDe(t.fechaLimite)!)}
              </span>
            )}
            {t.cliente && (
              <Link
                href={`/clientes/${t.cliente.id}`}
                className="inline-flex items-center gap-1 underline underline-offset-2 hover:text-foreground"
              >
                <User className="h-3 w-3" />
                {t.cliente.nombres} {t.cliente.apellidos}
              </Link>
            )}
            {asignadaAOtro && <span>Para {t.asignado.name}</span>}
            {pedidaPorOtro && (
              <span className="rounded bg-slate-100 px-1.5 py-0.5">
                Pedido de {t.solicitante.name}
              </span>
            )}
          </div>
        </div>

        {!hecha && (
          <span
            className="shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-medium"
            style={{ backgroundColor: p.fondo, color: p.color }}
          >
            {p.label}
          </span>
        )}

        {/* Aparece al pasar el mouse: siempre visible ensuciaría la lista y
            haría fácil borrar sin querer. */}
        <button
          type="button"
          onClick={() => borrar.mutate(t.id)}
          className="shrink-0 text-muted-foreground opacity-0 transition-opacity hover:text-red-600 group-hover:opacity-100"
          aria-label="Eliminar tarea"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    )
  }

  const Seccion = ({
    icono,
    titulo: t,
    lista,
    color,
    urgente,
  }: {
    icono: React.ReactNode
    titulo: string
    lista: Tarea[]
    color?: string
    urgente?: boolean
  }) =>
    lista.length === 0 ? null : (
      <section className="space-y-2">
        <div className="flex items-center gap-2">
          <span style={{ color: color ?? '#64748b' }}>{icono}</span>
          <h2 className="text-sm font-semibold" style={{ color: color ?? '#475569' }}>
            {t}
          </h2>
          <span className="text-xs text-muted-foreground">{lista.length}</span>
        </div>
        <div className="space-y-2">
          {lista.map((x) => (
            <Tarjeta key={x.id} t={x} urgente={urgente} />
          ))}
        </div>
      </section>
    )

  const Calendario = () => {
    const hoy = hoyISO()
    const dias = armarMes(mes)

    return (
      <div className="rounded-2xl border bg-card p-4">
        <div className="mb-3 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setMes(moverMes(mes, -1))}
            className="rounded p-1 text-muted-foreground hover:bg-muted"
            aria-label="Mes anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <p className="text-sm font-semibold" style={{ color: NAVY }}>
            {nombreMes(mes)}
          </p>
          <button
            type="button"
            onClick={() => setMes(moverMes(mes, 1))}
            className="rounded p-1 text-muted-foreground hover:bg-muted"
            aria-label="Mes siguiente"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <div className="mb-1 grid grid-cols-7 gap-1 text-center text-[10px] text-muted-foreground">
          {DIAS_SEMANA.map((d, i) => (
            <span key={i}>{d}</span>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {dias.map(({ iso, delMes }) => {
            const info = porDia.get(iso)
            const esHoy = iso === hoy
            const elegido = iso === diaFiltro
            const vencido = iso < hoy && !!info

            return (
              <button
                key={iso}
                type="button"
                // Volver a pulsar el mismo dia quita el filtro: es lo que uno
                // intenta por instinto para "salir" de la seleccion.
                onClick={() => setDiaFiltro(elegido ? null : iso)}
                className="relative flex aspect-square flex-col items-center justify-center rounded-lg text-xs transition-colors"
                style={{
                  backgroundColor: elegido ? NAVY : esHoy ? '#eef2f8' : undefined,
                  color: elegido
                    ? '#fff'
                    : !delMes
                      ? '#cbd5e1'
                      : esHoy
                        ? NAVY
                        : undefined,
                  fontWeight: esHoy || elegido ? 700 : 400,
                }}
              >
                {Number(iso.slice(8, 10))}
                {/* Punto solo si hay pendientes. Rojo si el dia ya paso o si
                    alguna es de prioridad alta. */}
                {info && (
                  <span
                    className="absolute bottom-1 h-1 w-1 rounded-full"
                    style={{
                      backgroundColor: elegido
                        ? '#fff'
                        : vencido || info.alta
                          ? '#dc2626'
                          : GOLD,
                    }}
                  />
                )}
              </button>
            )
          })}
        </div>

        {diaFiltro && (
          <div className="mt-3 border-t pt-3">
            <p className="text-xs font-semibold" style={{ color: NAVY }}>
              {fechaLegible(diaFiltro)}
            </p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {tareasDelDia.length === 0
                ? 'Sin tareas ese día'
                : `${tareasDelDia.length} tarea${tareasDelDia.length === 1 ? '' : 's'}`}
            </p>
            <button
              type="button"
              onClick={() => setDiaFiltro(null)}
              className="mt-2 text-[11px] underline underline-offset-2"
            >
              Ver todas
            </button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-4">
      {/* Resumen del día arriba: al abrir, lo primero que se quiere saber es
          cuánto falta, no la lista completa. */}
      <div
        className="rounded-2xl p-5 text-white"
        style={{ background: `linear-gradient(135deg, ${NAVY} 0%, #1a3a6b 100%)` }}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold">Mis tareas</h1>
            <p className="mt-1 text-sm text-slate-300">
              {pendientes === 0
                ? '¡Todo al día!'
                : `${pendientes} pendiente${pendientes === 1 ? '' : 's'}`}
              {g.vencidas.length > 0 && (
                <span style={{ color: GOLD }}>
                  {' '}
                  · {g.vencidas.length} vencida{g.vencidas.length === 1 ? '' : 's'}
                </span>
              )}
            </p>
          </div>
          <Button
            onClick={() => setCreando((v) => !v)}
            className="shrink-0"
            style={{ backgroundColor: GOLD, color: NAVY }}
          >
            <Plus className="mr-1 h-4 w-4" /> Nueva
          </Button>
        </div>

        {g.hechas.length > 0 && (
          <div className="mt-4 flex items-center gap-2 text-xs text-slate-300">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/20">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${Math.round((g.hechas.length / (pendientes + g.hechas.length)) * 100)}%`,
                  backgroundColor: VERDE,
                }}
              />
            </div>
            <span>
              {g.hechas.length} hecha{g.hechas.length === 1 ? '' : 's'}
            </span>
          </div>
        )}
      </div>

      {error && (
        <div className="flex items-start justify-between gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} aria-label="Cerrar">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {creando && (
        <div className="space-y-3 rounded-xl border bg-card p-4">
          <Input
            autoFocus
            placeholder="¿Qué hay que hacer?"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            onKeyDown={(e) => {
              // Enter crea la tarea: anotar algo rápido no debería exigir buscar
              // el botón con el mouse.
              if (e.key === 'Enter' && titulo.trim()) crear.mutate()
            }}
            className="text-sm"
          />

          <Input
            placeholder="Motivo o detalle (opcional)"
            value={detalle}
            onChange={(e) => setDetalle(e.target.value)}
            className="text-sm"
          />

          {/* Cliente relacionado. No es obligatorio: muchas tareas no son de un
              cliente concreto, y forzarlo haría que se ponga cualquier cosa con
              tal de poder guardar. */}
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Cliente (opcional)</label>
            <BuscadorCliente
              valor={clienteTexto}
              clienteId={clienteId}
              onSeleccionar={(c: ClienteSugerido) => {
                setClienteTexto(`${c.nombres} ${c.apellidos}`.trim())
                setClienteId(c.id)
              }}
              onTextoLibre={(txt) => {
                setClienteTexto(txt)
                setClienteId(null)
              }}
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={prioridad}
              onChange={(e) => setPrioridad(e.target.value)}
              className="h-9 rounded-md border bg-background px-2 text-sm"
            >
              <option value="ALTA">Prioridad alta</option>
              <option value="MEDIA">Prioridad media</option>
              <option value="BAJA">Prioridad baja</option>
            </select>
            <Input
              type="date"
              value={fechaLimite}
              onChange={(e) => setFechaLimite(e.target.value)}
              className="h-9 max-w-[155px] text-sm"
            />
            {puedeAsignar && (
              <select
                value={asignadoId}
                onChange={(e) => setAsignadoId(e.target.value)}
                className="h-9 rounded-md border bg-background px-2 text-sm"
              >
                <option value="">Para mí</option>
                {equipo.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            )}
            <div className="ml-auto flex gap-2">
              <Button variant="ghost" onClick={limpiar}>
                Cancelar
              </Button>
              <Button
                onClick={() => crear.mutate()}
                disabled={!titulo.trim() || crear.isPending}
                style={{ backgroundColor: NAVY, color: '#fff' }}
              >
                Agregar
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Dos columnas en pantallas anchas: el calendario aprovecha el espacio que
          antes quedaba vacio a los lados, y de paso deja filtrar por dia. En
          movil se apila, con el calendario debajo de la lista. */}
      <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
        <div className="order-2 lg:order-1">
      {isLoading ? (
        <p className="py-12 text-center text-sm text-muted-foreground">Cargando…</p>
      ) : tareas.length === 0 ? (
        <div className="rounded-xl border border-dashed py-12 text-center">
          <Inbox className="mx-auto h-8 w-8 text-muted-foreground/40" />
          <p className="mt-3 text-sm text-muted-foreground">No tienes tareas pendientes.</p>
        </div>
      ) : (
        <div className="space-y-5">
          {/* Con un dia elegido en el calendario, la lista muestra SOLO ese dia:
              mezclarlo con las secciones de siempre haria confuso saber que se
              esta viendo. */}
          {diaFiltro ? (
            tareasDelDia.length === 0 ? (
              <div className="rounded-xl border border-dashed py-10 text-center">
                <p className="text-sm text-muted-foreground">
                  Sin tareas el {fechaLegible(diaFiltro)}.
                </p>
                <button
                  type="button"
                  onClick={() => setDiaFiltro(null)}
                  className="mt-2 text-xs underline underline-offset-2"
                >
                  Ver todas
                </button>
              </div>
            ) : (
              <Seccion
                icono={<CalendarDays className="h-4 w-4" />}
                titulo={fechaLegible(diaFiltro)}
                lista={tareasDelDia}
                color={NAVY}
                urgente={diaFiltro < hoyISO()}
              />
            )
          ) : (
          <>
          <Seccion
            icono={<AlertTriangle className="h-4 w-4" />}
            titulo="Vencidas"
            lista={g.vencidas}
            color="#dc2626"
            urgente
          />
          <Seccion
            icono={<CalendarDays className="h-4 w-4" />}
            titulo="Hoy"
            lista={g.deHoy}
            color={NAVY}
          />
          <Seccion
            icono={<CalendarDays className="h-4 w-4" />}
            titulo="Próximas"
            lista={g.proximas}
          />
          <Seccion icono={<Inbox className="h-4 w-4" />} titulo="Sin fecha" lista={g.sinFecha} />
          <Seccion icono={<Check className="h-4 w-4" />} titulo="Hechas" lista={g.hechas} />
          </>
          )}
        </div>
      )}

          <button
            type="button"
            onClick={() => setVerTodas((v) => !v)}
            className="mt-4 text-xs text-muted-foreground underline underline-offset-2"
          >
            {verTodas ? 'Ocultar completadas anteriores' : 'Ver completadas anteriores'}
          </button>
        </div>

        <div className="order-1 lg:order-2">
          {/* Sticky para que el calendario siga a la vista al bajar por una lista
              larga, que es cuando mas sirve para saltar a otro dia. */}
          <div className="lg:sticky lg:top-4">
            <Calendario />
          </div>
        </div>
      </div>
    </div>
  )
}
