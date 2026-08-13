'use client'

import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Plus, Trash2, X } from 'lucide-react'

const NAVY = '#0C2057'

/** Quién puede asignarle tareas a otra persona. Debe coincidir con la API. */
const PUEDE_ASIGNAR = ['SUPER_ADMIN', 'OWNER', 'MANAGER', 'JEFE_OPERACIONES']

interface Persona {
  id: string
  name: string
  role: string
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

const ESTILO_PRIORIDAD: Record<string, { fondo: string; texto: string; label: string }> = {
  ALTA: { fondo: '#fee2e2', texto: '#b91c1c', label: 'Alta' },
  MEDIA: { fondo: '#fef3c7', texto: '#b45309', label: 'Media' },
  BAJA: { fondo: '#f1f5f9', texto: '#64748b', label: 'Baja' },
}

/** Hoy en Ecuador como 'YYYY-MM-DD'. */
function hoyISO(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Guayaquil',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

/** Día de la tarea. Se lee en UTC porque se guarda como fecha sin hora. */
function diaDe(fecha: string | null): string | null {
  return fecha ? fecha.slice(0, 10) : null
}

function fechaLegible(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`)
  return d.toLocaleDateString('es-EC', { day: 'numeric', month: 'short' })
}

export function TareasPage() {
  const qc = useQueryClient()
  const { data: session } = useSession()
  const yo = (session?.user as any)?.id as string | undefined
  const rol = (session?.user as any)?.role ?? ''
  const puedeAsignar = PUEDE_ASIGNAR.includes(rol)

  const [creando, setCreando] = useState(false)
  const [titulo, setTitulo] = useState('')
  const [prioridad, setPrioridad] = useState('MEDIA')
  const [fechaLimite, setFechaLimite] = useState(hoyISO())
  const [asignadoId, setAsignadoId] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [verTodas, setVerTodas] = useState(false)

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

  const crear = useMutation({
    mutationFn: () =>
      api.post('/tareas', {
        titulo,
        prioridad,
        ...(fechaLimite ? { fechaLimite } : {}),
        ...(asignadoId ? { asignadoId } : {}),
      }),
    onSuccess: () => {
      setTitulo('')
      setPrioridad('MEDIA')
      setFechaLimite(hoyISO())
      setAsignadoId('')
      setCreando(false)
      setError(null)
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

  // Se agrupan por urgencia y no por fecha exacta: lo que importa al abrir la
  // pantalla es "que se me paso" y "que toca hoy", no el calendario completo.
  const grupos = useMemo(() => {
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
      const dia = diaDe(t.fechaLimite)
      if (!dia) sinFecha.push(t)
      else if (dia < hoy) vencidas.push(t)
      else if (dia === hoy) deHoy.push(t)
      else proximas.push(t)
    }
    return { vencidas, deHoy, proximas, sinFecha, hechas }
  }, [tareas])

  const Fila = ({ t, vencida }: { t: Tarea; vencida?: boolean }) => {
    const p = ESTILO_PRIORIDAD[t.prioridad]
    const hecha = !!t.completadaEn
    // Se muestra quien la pidio solo si fue otra persona: en las propias seria
    // ruido leer el nombre de uno mismo en cada linea.
    const pedidaPorOtro = t.solicitante.id !== yo && t.solicitante.id !== t.asignado.id
    const asignadaAOtro = t.asignado.id !== yo

    return (
      <div
        className="flex items-start gap-2.5 border-b px-3 py-2.5 last:border-b-0"
        style={{
          backgroundColor: vencida && !hecha ? '#fef2f2' : undefined,
          opacity: hecha ? 0.55 : 1,
        }}
      >
        <button
          type="button"
          onClick={() => alternar.mutate(t.id)}
          aria-label={hecha ? 'Marcar como pendiente' : 'Marcar como hecha'}
          className="mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded border-2 text-[11px] text-white transition-colors"
          style={{
            borderColor: hecha ? '#5FD38D' : '#cbd5e1',
            backgroundColor: hecha ? '#5FD38D' : 'transparent',
          }}
        >
          {hecha && '✓'}
        </button>

        <div className="min-w-0 flex-1">
          <p
            className="text-sm"
            style={{ textDecoration: hecha ? 'line-through' : undefined }}
          >
            {t.titulo}
          </p>
          <p className="mt-0.5 flex flex-wrap gap-x-2 text-[11px] text-muted-foreground">
            {t.fechaLimite && <span>{fechaLegible(diaDe(t.fechaLimite)!)}</span>}
            {t.cliente && (
              <Link href={`/clientes/${t.cliente.id}`} className="underline">
                {t.cliente.nombres} {t.cliente.apellidos}
              </Link>
            )}
            {asignadaAOtro && <span>Para {t.asignado.name}</span>}
            {pedidaPorOtro && <span>Pedido de {t.solicitante.name}</span>}
          </p>
        </div>

        {!hecha && (
          <span
            className="shrink-0 rounded px-2 py-0.5 text-[11px]"
            style={{ backgroundColor: p.fondo, color: p.texto }}
          >
            {p.label}
          </span>
        )}

        <button
          type="button"
          onClick={() => borrar.mutate(t.id)}
          className="shrink-0 text-muted-foreground transition-colors hover:text-red-600"
          aria-label="Eliminar"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    )
  }

  const Grupo = ({
    titulo: t,
    lista,
    vencida,
  }: {
    titulo: string
    lista: Tarea[]
    vencida?: boolean
  }) =>
    lista.length === 0 ? null : (
      <section className="mb-4">
        <p
          className="mb-1.5 text-xs font-semibold"
          style={{ color: vencida ? '#b91c1c' : '#64748b' }}
        >
          {t} ({lista.length})
        </p>
        <div className="rounded-lg border">
          {lista.map((x) => (
            <Fila key={x.id} t={x} vencida={vencida} />
          ))}
        </div>
      </section>
    )

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold" style={{ color: NAVY }}>
            Tareas
          </h1>
          <p className="text-xs text-muted-foreground">
            {PUEDE_ASIGNAR.includes(rol)
              ? 'Tus tareas y las del equipo'
              : 'Solo tú y quien te asigna trabajo ven esta lista'}
          </p>
        </div>
        <Button
          onClick={() => setCreando((v) => !v)}
          style={{ backgroundColor: NAVY, color: '#fff' }}
        >
          <Plus className="mr-1 h-4 w-4" /> Nueva
        </Button>
      </div>

      {error && (
        <div className="flex items-start justify-between gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} aria-label="Cerrar">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {creando && (
        <div className="space-y-2 rounded-lg border p-3">
          <Input
            autoFocus
            placeholder="¿Qué hay que hacer?"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            onKeyDown={(e) => {
              // Enter crea la tarea: anotar algo rapido no deberia exigir
              // soltar el teclado para buscar el boton.
              if (e.key === 'Enter' && titulo.trim()) crear.mutate()
            }}
          />
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={prioridad}
              onChange={(e) => setPrioridad(e.target.value)}
              className="h-9 rounded-md border bg-background px-2 text-sm"
            >
              <option value="ALTA">Alta</option>
              <option value="MEDIA">Media</option>
              <option value="BAJA">Baja</option>
            </select>
            <Input
              type="date"
              value={fechaLimite}
              onChange={(e) => setFechaLimite(e.target.value)}
              className="h-9 max-w-[160px] text-sm"
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
            <Button
              onClick={() => crear.mutate()}
              disabled={!titulo.trim() || crear.isPending}
              style={{ backgroundColor: NAVY, color: '#fff' }}
            >
              Agregar
            </Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <p className="py-10 text-center text-sm text-muted-foreground">Cargando…</p>
      ) : tareas.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          No tienes tareas pendientes.
        </p>
      ) : (
        <div>
          <Grupo titulo="⚠ Vencidas" lista={grupos.vencidas} vencida />
          <Grupo titulo="Hoy" lista={grupos.deHoy} />
          <Grupo titulo="Próximas" lista={grupos.proximas} />
          <Grupo titulo="Sin fecha" lista={grupos.sinFecha} />
          <Grupo titulo="Hechas" lista={grupos.hechas} />
        </div>
      )}

      <button
        type="button"
        onClick={() => setVerTodas((v) => !v)}
        className="text-xs text-muted-foreground underline"
      >
        {verTodas ? 'Ocultar completadas anteriores' : 'Ver completadas anteriores'}
      </button>
    </div>
  )
}
