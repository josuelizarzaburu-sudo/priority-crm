'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Check, Copy, Settings, UserPlus, Users } from 'lucide-react'

const NAVY = '#0C2057'
const GOLD = '#DBAA59'
const VERDE = '#15803d'
const AMBAR = '#b45309'

interface Resumen {
  referidoresActivos: number
  referidosDelMes: number
  cerradosDelMes: number
  totalPorPagar: number
  porPagar: {
    id: string
    codigo: string
    nombres: string
    apellidos: string
    debe: number
    puntos: number
  }[]
}

interface Referido {
  id: string
  nombres: string
  celular: string
  email: string | null
  interes: string | null
  nota: string | null
  estado: string
  motivo: string | null
  puntos: number | null
  monto: number | null
  createdAt: string
  referidor: { codigo: string; nombres: string; apellidos: string }
  deal: { id: string; title: string; assignedTo: { name: string } | null } | null
}

const ESTADO: Record<string, { label: string; color?: string; fondo?: string }> = {
  RECIBIDO: { label: 'Sin asignar', color: AMBAR, fondo: '#fffbeb' },
  EN_GESTION: { label: 'En gestión' },
  CERRADO: { label: 'Cerrado', color: VERDE, fondo: '#f0fdf4' },
  ACREDITADO: { label: 'Acreditado', color: VERDE, fondo: '#f0fdf4' },
  NO_PROSPERO: { label: 'No prosperó' },
}

/**
 * Programa de referidos, desde el CRM.
 *
 * Tres cosas: qué referidos entraron y en qué van, cuánto se le debe a cada
 * referidor, y las reglas del programa.
 */
export function ReferidosPage() {
  const qc = useQueryClient()
  const [vista, setVista] = useState<'referidos' | 'pagos' | 'reglas'>('referidos')
  const [estado, setEstado] = useState('')
  const [nuevoAbierto, setNuevoAbierto] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { data: resumen } = useQuery<Resumen>({
    queryKey: ['referidos', 'resumen'],
    queryFn: () => api.get('/referidos/resumen').then((r) => r.data),
  })

  const { data: referidos = [] } = useQuery<Referido[]>({
    queryKey: ['referidos', 'lista', estado],
    queryFn: () =>
      api.get('/referidos', { params: estado ? { estado } : {} }).then((r) => r.data),
    enabled: vista === 'referidos',
  })

  const refrescar = () => qc.invalidateQueries({ queryKey: ['referidos'] })

  const fallo = (e: any) => {
    const m = e?.response?.data?.message
    setError(Array.isArray(m) ? m.join(', ') : (m ?? 'No se pudo completar'))
  }

  const acreditar = useMutation({
    mutationFn: ({ id, primaAnual }: { id: string; primaAnual?: number }) =>
      api.post(`/referidos/${id}/acreditar`, { primaAnual }),
    onSuccess: () => {
      setError(null)
      refrescar()
    },
    onError: fallo,
  })

  const cambiarEstado = useMutation({
    mutationFn: ({ id, estado: e, motivo }: { id: string; estado: string; motivo?: string }) =>
      api.patch(`/referidos/${id}/estado`, { estado: e, motivo }),
    onSuccess: () => {
      setError(null)
      refrescar()
    },
    onError: fallo,
  })

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-1">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold md:text-3xl" style={{ color: NAVY }}>
            Referidos
          </h1>
          <p className="text-sm text-muted-foreground">
            Contactos que trae la red de referidores
          </p>
        </div>
        <Button onClick={() => setNuevoAbierto(true)} style={{ backgroundColor: NAVY, color: '#fff' }}>
          <UserPlus className="mr-1.5 h-4 w-4" /> Nuevo referidor
        </Button>
      </div>

      {error && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          {error}
        </p>
      )}

      {resumen && (
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border p-4">
            <p className="text-xs text-muted-foreground">Referidores activos</p>
            <p className="mt-1 text-2xl font-bold" style={{ color: NAVY }}>
              {resumen.referidoresActivos}
            </p>
          </div>
          <div className="rounded-xl border p-4">
            <p className="text-xs text-muted-foreground">Referidos este mes</p>
            <p className="mt-1 text-2xl font-bold" style={{ color: NAVY }}>
              {resumen.referidosDelMes}
            </p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {resumen.cerradosDelMes} cerrados
            </p>
          </div>
          {/* Lo que cuesta el programa este mes: la cifra que hay que mirar
              antes de pagar. */}
          <div className="rounded-xl border p-4" style={{ borderColor: GOLD, backgroundColor: '#fffbf3' }}>
            <p className="text-xs text-muted-foreground">Por pagar</p>
            <p className="mt-1 text-2xl font-bold" style={{ color: NAVY }}>
              ${resumen.totalPorPagar.toFixed(2)}
            </p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              a {resumen.porPagar.length} referidor(es)
            </p>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-1.5">
        {(
          [
            ['referidos', 'Referidos'],
            ['pagos', 'Por pagar'],
            ['reglas', 'Reglas'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setVista(id)}
            className="rounded-full border px-3 py-1 text-xs font-medium transition-colors"
            style={vista === id ? { backgroundColor: NAVY, color: '#fff', borderColor: NAVY } : undefined}
          >
            {label}
          </button>
        ))}
      </div>

      {vista === 'referidos' && (
        <>
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                ['', 'Todos'],
                ['RECIBIDO', 'Sin asignar'],
                ['EN_GESTION', 'En gestión'],
                ['ACREDITADO', 'Acreditados'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setEstado(id)}
                className="rounded-md border px-2.5 py-1 text-[11px]"
                style={estado === id ? { borderColor: NAVY, color: NAVY } : undefined}
              >
                {label}
              </button>
            ))}
          </div>

          {referidos.length === 0 ? (
            <div className="rounded-xl border border-dashed py-12 text-center">
              <Users className="mx-auto h-8 w-8 text-muted-foreground/40" />
              <p className="mt-3 text-sm text-muted-foreground">No hay referidos que mostrar.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {referidos.map((r) => (
                <FilaReferido
                  key={r.id}
                  referido={r}
                  onAcreditar={(primaAnual) => acreditar.mutate({ id: r.id, primaAnual })}
                  onCambiarEstado={(estado, motivo) =>
                    cambiarEstado.mutate({ id: r.id, estado, motivo })
                  }
                  ocupado={acreditar.isPending || cambiarEstado.isPending}
                />
              ))}
            </div>
          )}
        </>
      )}

      {vista === 'pagos' && <VistaPagos porPagar={resumen?.porPagar ?? []} onHecho={refrescar} onError={fallo} />}
      {vista === 'reglas' && <VistaReglas onHecho={refrescar} onError={fallo} />}

      {nuevoAbierto && (
        <NuevoReferidor
          onCerrar={() => setNuevoAbierto(false)}
          onCreado={() => {
            setNuevoAbierto(false)
            refrescar()
          }}
          onError={fallo}
        />
      )}
    </div>
  )
}

/** Una fila de referido, con lo que se puede hacer con él. */
function FilaReferido({
  referido: r,
  onAcreditar,
  onCambiarEstado,
  ocupado,
}: {
  referido: Referido
  onAcreditar: (primaAnual?: number) => void
  onCambiarEstado: (estado: string, motivo?: string) => void
  ocupado: boolean
}) {
  const [acreditando, setAcreditando] = useState(false)
  const [prima, setPrima] = useState('')
  const [rechazando, setRechazando] = useState(false)
  const [motivo, setMotivo] = useState('')

  const e = ESTADO[r.estado] ?? { label: r.estado }
  const yaAcreditado = r.estado === 'ACREDITADO'

  return (
    <div className="rounded-xl border p-3.5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold" style={{ color: NAVY }}>
            {r.nombres}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {r.celular}
            {r.interes && ` · ${r.interes}`} · por {r.referidor.nombres} ({r.referidor.codigo})
          </p>
          {r.nota && <p className="mt-0.5 text-[11px] text-muted-foreground">{r.nota}</p>}
          {r.motivo && (
            <p className="mt-0.5 text-[11px]" style={{ color: AMBAR }}>
              {r.motivo}
            </p>
          )}
          {r.deal?.assignedTo?.name && (
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Lo lleva {r.deal.assignedTo.name}
            </p>
          )}
        </div>

        <span
          className="shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
          style={{ backgroundColor: e.fondo ?? '#f4f5f7', color: e.color ?? '#6b7280' }}
        >
          {yaAcreditado && r.puntos ? `+${r.puntos} pts · $${r.monto}` : e.label}
        </span>
      </div>

      {!yaAcreditado && (
        <div className="mt-2.5 space-y-2 border-t pt-2.5">
          {acreditando && (
            <div className="flex flex-wrap items-center gap-2">
              <Input
                autoFocus
                value={prima}
                onChange={(ev) => setPrima(ev.target.value)}
                placeholder="Prima anual de la póliza"
                inputMode="decimal"
                className="h-9 max-w-[200px] text-sm"
              />
              <Button
                size="sm"
                onClick={() => onAcreditar(prima ? Number(prima) : undefined)}
                disabled={ocupado}
                style={{ backgroundColor: NAVY, color: '#fff' }}
              >
                Confirmar
              </Button>
              <span className="text-[11px] text-muted-foreground">
                Decide si se le pagan 20 o 30
              </span>
            </div>
          )}

          {rechazando && (
            <div className="flex flex-wrap items-center gap-2">
              <Input
                autoFocus
                value={motivo}
                onChange={(ev) => setMotivo(ev.target.value)}
                placeholder="¿Por qué no prosperó?"
                className="h-9 max-w-[280px] text-sm"
              />
              <Button
                size="sm"
                variant="outline"
                disabled={!motivo.trim() || ocupado}
                onClick={() => onCambiarEstado('NO_PROSPERO', motivo)}
              >
                Confirmar
              </Button>
              <span className="text-[11px] text-muted-foreground">
                Se le dice al referidor, para que aprenda a referir mejor
              </span>
            </div>
          )}

          {!acreditando && !rechazando && (
            <div className="flex flex-wrap gap-1.5">
              {r.estado === 'RECIBIDO' && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onCambiarEstado('EN_GESTION')}
                  disabled={ocupado}
                >
                  Marcar en gestión
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                className="border-green-300 text-green-700 hover:bg-green-50"
                onClick={() => setAcreditando(true)}
                disabled={ocupado}
              >
                <Check className="mr-1 h-3.5 w-3.5" /> Acreditar
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setRechazando(true)} disabled={ocupado}>
                No prosperó
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/** Cuánto se le debe a cada referidor. */
function VistaPagos({
  porPagar,
  onHecho,
  onError,
}: {
  porPagar: Resumen['porPagar']
  onHecho: () => void
  onError: (e: any) => void
}) {
  const [pagando, setPagando] = useState<string | null>(null)
  const [monto, setMonto] = useState('')

  const pagar = useMutation({
    mutationFn: ({ id, monto: m }: { id: string; monto: number }) =>
      api.post(`/referidos/referidores/${id}/pago`, { monto: m }),
    onSuccess: () => {
      setPagando(null)
      setMonto('')
      onHecho()
    },
    onError,
  })

  if (porPagar.length === 0) {
    return (
      <div className="rounded-xl border border-dashed py-12 text-center">
        <p className="text-sm text-muted-foreground">No hay pagos pendientes.</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {porPagar.map((r) => (
        <div key={r.id} className="rounded-xl border p-3.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="font-semibold" style={{ color: NAVY }}>
                {r.nombres} {r.apellidos}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {r.codigo} · {r.puntos} puntos
              </p>
            </div>

            {pagando === r.id ? (
              <div className="flex items-center gap-2">
                <Input
                  autoFocus
                  value={monto}
                  onChange={(e) => setMonto(e.target.value)}
                  placeholder={String(r.debe)}
                  inputMode="decimal"
                  className="h-9 w-[110px] text-sm"
                />
                <Button
                  size="sm"
                  onClick={() => pagar.mutate({ id: r.id, monto: Number(monto || r.debe) })}
                  disabled={pagar.isPending}
                  style={{ backgroundColor: NAVY, color: '#fff' }}
                >
                  Confirmar
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setPagando(null)}>
                  No
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold" style={{ color: NAVY }}>
                  ${r.debe.toFixed(2)}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setPagando(r.id)
                    setMonto(String(r.debe))
                  }}
                >
                  Pagar
                </Button>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

/** Los números del programa. */
function VistaReglas({ onHecho, onError }: { onHecho: () => void; onError: (e: any) => void }) {
  const [form, setForm] = useState<Record<string, string>>({})

  const { data } = useQuery<any>({
    queryKey: ['referidos', 'reglas'],
    queryFn: () => api.get('/referidos/reglas').then((r) => r.data),
  })

  const guardar = useMutation({
    mutationFn: () =>
      api.patch('/referidos/reglas', {
        ...(form.puntosPorReferido ? { puntosPorReferido: Number(form.puntosPorReferido) } : {}),
        ...(form.cortePrima ? { cortePrima: Number(form.cortePrima) } : {}),
        ...(form.montoBajo ? { montoBajo: Number(form.montoBajo) } : {}),
        ...(form.montoAlto ? { montoAlto: Number(form.montoAlto) } : {}),
      }),
    onSuccess: () => {
      setForm({})
      onHecho()
    },
    onError,
  })

  if (!data) return null

  const campos = [
    { k: 'puntosPorReferido', label: 'Puntos por referido cerrado', v: data.puntosPorReferido },
    { k: 'cortePrima', label: 'Prima anual a partir de la cual se paga más', v: data.cortePrima },
    { k: 'montoBajo', label: 'Se paga hasta esa prima', v: data.montoBajo },
    { k: 'montoAlto', label: 'Se paga por encima', v: data.montoAlto },
  ]

  return (
    <div className="max-w-md space-y-3 rounded-xl border p-4">
      <p className="flex items-center gap-1.5 text-sm font-semibold" style={{ color: NAVY }}>
        <Settings className="h-4 w-4" /> Reglas del programa
      </p>

      {campos.map((c) => (
        <div key={c.k}>
          <label className="mb-1 block text-xs text-muted-foreground">{c.label}</label>
          <Input
            value={form[c.k] ?? String(c.v)}
            onChange={(e) => setForm((f) => ({ ...f, [c.k]: e.target.value }))}
            inputMode="decimal"
            className="h-9 text-sm"
          />
        </div>
      ))}

      {/* Lo ya acreditado no se recalcula: cambiar el pasado destruiría la
          confianza en el programa más rápido que cualquier otra cosa. */}
      <p className="text-[11px] text-muted-foreground">
        Los cambios afectan solo a los referidos que se acrediten de aquí en adelante. Lo ya
        ganado no se toca.
      </p>

      <Button
        onClick={() => guardar.mutate()}
        disabled={Object.keys(form).length === 0 || guardar.isPending}
        style={{ backgroundColor: NAVY, color: '#fff' }}
      >
        {guardar.isPending ? 'Guardando…' : 'Guardar'}
      </Button>
    </div>
  )
}

/** Alta de un referidor: se le genera el código y se le comparte el enlace. */
function NuevoReferidor({
  onCerrar,
  onCreado,
  onError,
}: {
  onCerrar: () => void
  onCreado: () => void
  onError: (e: any) => void
}) {
  const [form, setForm] = useState<Record<string, string>>({})
  const [creado, setCreado] = useState<{ codigo: string; nombres: string } | null>(null)
  const [copiado, setCopiado] = useState(false)

  const crear = useMutation({
    mutationFn: () => api.post('/referidos/referidores', form).then((r) => r.data),
    onSuccess: (d) => setCreado(d),
    onError,
  })

  const enlace =
    creado && typeof window !== 'undefined'
      ? `${window.location.origin}/r/${creado.codigo}`
      : ''

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onCerrar}>
      <div
        className="w-full max-w-md space-y-3 rounded-xl bg-white p-5"
        onClick={(e) => e.stopPropagation()}
      >
        {creado ? (
          <>
            <p className="text-sm font-semibold" style={{ color: NAVY }}>
              {creado.nombres} ya tiene su código
            </p>
            <div className="rounded-xl p-4 text-center" style={{ backgroundColor: NAVY }}>
              <p className="text-2xl font-bold tracking-wide text-white">{creado.codigo}</p>
            </div>
            {/* El enlace es lo que de verdad se comparte: el código solo sirve
                para decirlo por teléfono. */}
            <div className="flex items-center gap-2 rounded-lg border p-2">
              <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{enlace}</span>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard?.writeText(enlace)
                  setCopiado(true)
                  setTimeout(() => setCopiado(false), 2000)
                }}
                className="shrink-0 text-xs font-medium"
                style={{ color: NAVY }}
              >
                {copiado ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>
            <Button className="w-full" onClick={onCreado} style={{ backgroundColor: NAVY, color: '#fff' }}>
              Listo
            </Button>
          </>
        ) : (
          <>
            <p className="text-sm font-semibold" style={{ color: NAVY }}>
              Nuevo referidor
            </p>
            {[
              { k: 'nombres', p: 'Nombres' },
              { k: 'apellidos', p: 'Apellidos' },
              { k: 'celular', p: 'Celular' },
              { k: 'email', p: 'Correo (opcional)' },
              { k: 'identificacion', p: 'Cédula (opcional)' },
            ].map((c) => (
              <Input
                key={c.k}
                value={form[c.k] ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, [c.k]: e.target.value }))}
                placeholder={c.p}
                className="h-10 text-sm"
              />
            ))}
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={onCerrar}>
                Cancelar
              </Button>
              <Button
                onClick={() => crear.mutate()}
                disabled={
                  !form.nombres?.trim() ||
                  !form.apellidos?.trim() ||
                  !form.celular?.trim() ||
                  crear.isPending
                }
                style={{ backgroundColor: NAVY, color: '#fff' }}
              >
                {crear.isPending ? 'Creando…' : 'Crear'}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
