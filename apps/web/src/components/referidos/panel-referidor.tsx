'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Check, Share2, UserPlus, X } from 'lucide-react'

const NAVY = '#0C2057'
const GOLD = '#DBAA59'
const VERDE = '#15803d'
const AMBAR = '#b45309'

interface Referido {
  id: string
  nombres: string
  interes: string | null
  estado: 'RECIBIDO' | 'EN_GESTION' | 'CERRADO' | 'ACREDITADO' | 'NO_PROSPERO'
  puntos: number | null
  monto: number | null
  motivo: string | null
  createdAt: string
  acreditadoEn: string | null
}

interface Panel {
  codigo: string
  nombres: string
  puntos: number
  ganado: number
  porCobrar: number
  puntosPorReferido: number
  referidos: Referido[]
}

/**
 * Cómo se nombra cada estado al referidor.
 *
 * Se le dice en qué va cada referido —las fuentes coinciden en que la
 * transparencia sostiene la participación— pero sin detalles internos: no ve
 * quién lo está gestionando ni en qué etapa del pipeline está.
 */
const ESTADO: Record<Referido['estado'], { label: string; color?: string; fondo?: string }> = {
  RECIBIDO: { label: 'Recibido' },
  EN_GESTION: { label: 'Lo está viendo un asesor' },
  CERRADO: { label: 'Cerrado' },
  ACREDITADO: { label: 'Acreditado', color: VERDE, fondo: '#f0fdf4' },
  NO_PROSPERO: { label: 'No prosperó', color: AMBAR, fondo: '#fffbeb' },
}

const RAMOS = [
  { valor: 'SALUD', label: 'Salud' },
  { valor: 'AUTO', label: 'Vehículo' },
  { valor: 'VIDA', label: 'Vida' },
  { valor: 'HOGAR', label: 'Hogar' },
]

/**
 * Pantalla del referidor.
 *
 * Entra con su código, que es su credencial: no hay usuario ni contraseña porque
 * pedirle crear una cuenta para mandar un contacto perdería a la mitad antes de
 * empezar.
 */
export function PanelReferidor({ codigo }: { codigo: string }) {
  const qc = useQueryClient()
  const [abierto, setAbierto] = useState(false)
  const [copiado, setCopiado] = useState(false)
  const [form, setForm] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)

  const { data, isLoading, isError } = useQuery<Panel>({
    queryKey: ['panel-referidor', codigo],
    queryFn: () => api.get(`/referidos/panel/${codigo}`).then((r) => r.data),
  })

  const referir = useMutation({
    mutationFn: () => api.post(`/referidos/panel/${codigo}/referir`, form),
    onSuccess: () => {
      setForm({})
      setAbierto(false)
      setError(null)
      qc.invalidateQueries({ queryKey: ['panel-referidor', codigo] })
    },
    onError: (e: any) => {
      const m = e?.response?.data?.message
      setError(Array.isArray(m) ? m.join(', ') : (m ?? 'No se pudo enviar'))
    },
  })

  if (isLoading) {
    return <p className="py-20 text-center text-sm text-muted-foreground">Cargando…</p>
  }

  if (isError || !data) {
    return (
      <div className="mx-auto max-w-sm px-4 py-20 text-center">
        <p className="text-sm text-muted-foreground">
          No encontramos ese código. Revisa el enlace que te compartieron.
        </p>
      </div>
    )
  }

  /** Cuánto falta para el premio más cercano. */
  const faltaParaPremio = (() => {
    // Los premios reales se cargan después; esto da la sensación de meta desde
    // el primer día, que es lo que sostiene la participación.
    const escalones = [20, 50, 80]
    const siguiente = escalones.find((e) => e > data.puntos)
    return siguiente ? siguiente - data.puntos : null
  })()

  const enlace = typeof window !== 'undefined' ? `${window.location.origin}/r/${data.codigo}` : ''

  return (
    <div className="mx-auto max-w-lg space-y-4 px-4 py-6">
      <div>
        <p className="text-sm text-muted-foreground">Hola, {data.nombres}</p>
        <h1 className="text-2xl font-bold" style={{ color: NAVY }}>
          Tus referidos
        </h1>
      </div>

      {/* El código, grande: es lo que comparte y lo que le van a preguntar. */}
      <div
        className="flex items-center justify-between gap-3 rounded-xl p-4"
        style={{ backgroundColor: NAVY }}
      >
        <div className="min-w-0">
          <p className="text-xs text-white/70">Tu código</p>
          <p className="text-xl font-bold tracking-wide text-white">{data.codigo}</p>
        </div>
        <button
          type="button"
          onClick={() => {
            navigator.clipboard?.writeText(enlace)
            setCopiado(true)
            setTimeout(() => setCopiado(false), 2000)
          }}
          className="flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium"
          style={{ backgroundColor: GOLD, color: NAVY }}
        >
          {copiado ? <Check className="h-3.5 w-3.5" /> : <Share2 className="h-3.5 w-3.5" />}
          {copiado ? 'Copiado' : 'Compartir'}
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-xl border p-3">
          <p className="text-[11px] text-muted-foreground">Puntos</p>
          <p className="text-xl font-bold" style={{ color: NAVY }}>
            {data.puntos}
          </p>
          {faltaParaPremio !== null && (
            <p className="mt-0.5 text-[10px] text-muted-foreground">
              {faltaParaPremio} para el siguiente premio
            </p>
          )}
        </div>
        <div className="rounded-xl border p-3">
          <p className="text-[11px] text-muted-foreground">Ganado</p>
          <p className="text-xl font-bold" style={{ color: NAVY }}>
            ${data.ganado.toFixed(0)}
          </p>
        </div>
        <div className="rounded-xl border p-3">
          <p className="text-[11px] text-muted-foreground">Por cobrar</p>
          <p className="text-xl font-bold" style={{ color: data.porCobrar > 0 ? VERDE : NAVY }}>
            ${data.porCobrar.toFixed(0)}
          </p>
        </div>
      </div>

      {!abierto ? (
        <button
          type="button"
          onClick={() => setAbierto(true)}
          className="flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-white"
          style={{ backgroundColor: NAVY }}
        >
          <UserPlus className="h-4 w-4" /> Referir a alguien
        </button>
      ) : (
        <div className="space-y-2.5 rounded-xl border p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold" style={{ color: NAVY }}>
              Referir a alguien
            </p>
            <button type="button" onClick={() => setAbierto(false)}>
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>

          {error && (
            <p className="rounded-lg bg-amber-50 px-2.5 py-2 text-xs text-amber-900">{error}</p>
          )}

          <input
            autoFocus
            value={form.nombres ?? ''}
            onChange={(e) => setForm((f) => ({ ...f, nombres: e.target.value }))}
            placeholder="Nombre de tu contacto"
            className="h-10 w-full rounded-lg border px-3 text-sm"
          />
          <input
            value={form.celular ?? ''}
            onChange={(e) => setForm((f) => ({ ...f, celular: e.target.value }))}
            placeholder="Celular"
            inputMode="tel"
            className="h-10 w-full rounded-lg border px-3 text-sm"
          />
          <input
            value={form.email ?? ''}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            placeholder="Correo (opcional)"
            inputMode="email"
            className="h-10 w-full rounded-lg border px-3 text-sm"
          />

          <div>
            <p className="mb-1.5 text-[11px] text-muted-foreground">¿Qué le interesa?</p>
            <div className="flex flex-wrap gap-1.5">
              {RAMOS.map((r) => (
                <button
                  key={r.valor}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, interes: r.valor }))}
                  className="rounded-full border px-3 py-1 text-xs"
                  style={
                    form.interes === r.valor
                      ? { backgroundColor: NAVY, color: '#fff', borderColor: NAVY }
                      : undefined
                  }
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          <input
            value={form.nota ?? ''}
            onChange={(e) => setForm((f) => ({ ...f, nota: e.target.value }))}
            placeholder="Algo que debamos saber (opcional)"
            className="h-10 w-full rounded-lg border px-3 text-sm"
          />

          <button
            type="button"
            onClick={() => referir.mutate()}
            disabled={!form.nombres?.trim() || !form.celular?.trim() || referir.isPending}
            className="w-full rounded-lg py-2.5 text-sm font-semibold text-white disabled:opacity-40"
            style={{ backgroundColor: NAVY }}
          >
            {referir.isPending ? 'Enviando…' : 'Enviar'}
          </button>
          <p className="text-center text-[11px] text-muted-foreground">
            Un asesor lo contacta y tú ganas {data.puntosPorReferido} puntos cuando cierre.
          </p>
        </div>
      )}

      {data.referidos.length > 0 && (
        <div>
          <p className="mb-2 text-xs text-muted-foreground">
            Tus referidos ({data.referidos.length})
          </p>
          <div className="overflow-hidden rounded-xl border">
            {data.referidos.map((r, i) => {
              const e = ESTADO[r.estado]
              return (
                <div
                  key={r.id}
                  className="flex items-start justify-between gap-3 px-3.5 py-2.5"
                  style={{ borderTop: i > 0 ? '1px solid #e5e7eb' : undefined }}
                >
                  <div className="min-w-0">
                    <p className="text-sm" style={{ color: NAVY }}>
                      {r.nombres}
                    </p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {RAMOS.find((x) => x.valor === r.interes)?.label ?? 'Sin definir'} ·{' '}
                      {new Date(r.createdAt).toLocaleDateString('es-EC', {
                        day: 'numeric',
                        month: 'short',
                      })}
                    </p>
                    {/* Cuando no prospera se dice por qué: sin eso, la próxima
                        vez refiere otro contacto igual. */}
                    {r.motivo && (
                      <p className="mt-0.5 text-[11px]" style={{ color: AMBAR }}>
                        {r.motivo}
                      </p>
                    )}
                  </div>

                  <span
                    className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium"
                    style={{
                      backgroundColor: e.fondo ?? '#f4f5f7',
                      color: e.color ?? '#6b7280',
                    }}
                  >
                    {r.estado === 'ACREDITADO' && r.puntos
                      ? `+${r.puntos} pts · $${r.monto}`
                      : e.label}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {data.referidos.length === 0 && !abierto && (
        <p className="py-8 text-center text-xs text-muted-foreground">
          Todavía no has referido a nadie. Cada persona que contrate te suma{' '}
          {data.puntosPorReferido} puntos.
        </p>
      )}
    </div>
  )
}
