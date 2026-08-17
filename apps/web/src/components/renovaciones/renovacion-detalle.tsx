'use client'

import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Mail, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { api } from '@/lib/api'
import { ESTADOS, ENVIOS } from './renovaciones-page'
import { RenovacionCorreo } from './renovacion-correo'

const NAVY = '#0C2057'
const GOLD = '#DBAA59'

const txt = (v: any) => (v === null || v === undefined ? '' : String(v))
const dia = (v: any) => (v ? String(v).slice(0, 10) : '')

export function RenovacionDetalle({ id, onCerrar }: { id: string; onCerrar: () => void }) {
  // Pantalla del correo. Se abre encima del detalle en vez de reemplazarlo, para
  // poder volver y corregir un valor si al revisar el texto se nota algo mal.
  const [correoAbierto, setCorreoAbierto] = useState(false)
  const qc = useQueryClient()
  const [form, setForm] = useState<Record<string, string>>({})
  const [nota, setNota] = useState('')
  const [error, setError] = useState<string | null>(null)

  const { data: r } = useQuery({
    queryKey: ['renovacion', id],
    queryFn: async () => (await api.get(`/renovaciones/${id}`)).data,
  })

  useEffect(() => {
    if (!r) return
    setForm({
      fechaRenovacion: dia(r.fechaRenovacion),
      valorActual: txt(r.valorActual),
      valorRenovacion: txt(r.valorRenovacion),
      diferidoEspecial: txt(r.diferidoEspecial),
      estado: txt(r.estado) || 'POR_RENOVAR',
      envio: txt(r.envio) || 'NO_ENVIADO',
      comentarios: txt(r.comentarios),
      formaPago: txt(r.poliza?.formaPago),
    })
  }, [r])

  const set = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }))

  const guardar = useMutation({
    mutationFn: async () => {
      const payload: any = {}
      for (const [k, v] of Object.entries(form)) {
        const s = (v ?? '').trim()
        if (['valorActual', 'valorRenovacion', 'diferidoEspecial'].includes(k)) {
          if (s !== '') payload[k] = Number(s)
        } else if (s !== '') {
          payload[k] = s
        }
      }
      const res = (await api.patch(`/renovaciones/${id}`, payload)).data
      if (nota.trim()) {
        await api.post(`/renovaciones/${id}/notas`, { contenido: nota.trim() })
      }
      return res
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['renovaciones'] })
      qc.invalidateQueries({ queryKey: ['renovacion', id] })
      qc.invalidateQueries({ queryKey: ['renovaciones-por-mes'] })
      onCerrar()
    },
    onError: (e: any) =>
      setError(e?.response?.data?.message ?? 'No se pudo guardar.'),
  })

  if (!r) return null

  const c = r.poliza?.cliente
  // El incremento se calcula en vivo mientras se escribe, como en el Excel.
  const actual = Number(form.valorActual) || 0
  const nuevo = Number(form.valorRenovacion) || 0
  const inc = actual > 0 && nuevo > 0 ? (nuevo - actual) / actual : null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4">
      <div className="my-8 w-full max-w-2xl rounded-lg border bg-card p-5 shadow-lg">
        <div className="mb-4 flex items-start justify-between gap-2">
          <div>
            <h2 className="text-base font-bold" style={{ color: NAVY }}>
              {c ? `${c.nombres} ${c.apellidos ?? ''}`.trim() : 'Renovación'}
            </h2>
            <p className="text-xs text-muted-foreground">
              {r.poliza?.aseguradora} · {r.poliza?.plan}
              {r.poliza?.deducible ? ` · Deducible ${r.poliza.deducible}` : ''}
            </p>
          </div>
          <button type="button" onClick={onCerrar} className="text-muted-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        {correoAbierto && (
          <div
            className="fixed inset-0 z-[60] flex justify-end bg-black/30"
            onClick={() => setCorreoAbierto(false)}
          >
            <div
              className="h-full w-full max-w-2xl overflow-y-auto bg-background p-5 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <RenovacionCorreo renovacionId={id} onCerrar={() => setCorreoAbierto(false)} />
            </div>
          </div>
        )}

        {/* Datos que vienen de la ficha del cliente y de la póliza. Se muestran
            de solo lectura: si algo está mal, se corrige en la ficha.
            La excepción es la forma de pago, que cambia justo al renovar y sale
            en el correo al cliente; obligar a salir y buscar la póliza para
            corregirla sería dar un rodeo innecesario. */}
        <div className="mb-4 grid gap-2 rounded-md bg-muted/40 p-3 text-xs md:grid-cols-2">
          <Dato label="Cédula" valor={c?.identificacion} />
          <div className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground">Forma de pago</span>
            <select
              value={form.formaPago ?? ''}
              onChange={(e) => set('formaPago', e.target.value)}
              className="h-7 max-w-[170px] rounded border bg-background px-1.5 text-xs font-medium"
              style={{ color: NAVY }}
            >
              <option value="">— Sin definir —</option>
              <option value="CONTADO">Contado</option>
              <option value="MENSUAL">Débito mensual</option>
              <option value="DIFERIDO">Diferido</option>
              <option value="DIFERIDO_ESPECIAL">Diferido especial</option>
            </select>
          </div>
          <Dato label="Correo" valor={c?.email} />
          <Dato label="Celular" valor={c?.celular} />
          <Dato label="Agente" valor={r.ejecutivoNombre ?? r.ejecutivo?.name} />
          <Dato label="Ramo" valor={r.poliza?.tipo} />
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <Campo label="Fecha de renovación">
            <Input
              type="date"
              value={form.fechaRenovacion ?? ''}
              onChange={(e) => set('fechaRenovacion', e.target.value)}
            />
          </Campo>
          <Campo label="Valor actual (USD)">
            <Input
              inputMode="decimal"
              value={form.valorActual ?? ''}
              onChange={(e) => set('valorActual', e.target.value)}
            />
          </Campo>
          <Campo label="Valor de renovación (USD)">
            <Input
              inputMode="decimal"
              value={form.valorRenovacion ?? ''}
              onChange={(e) => set('valorRenovacion', e.target.value)}
            />
          </Campo>
          <Campo label="% de incremento">
            {/* Calculado, no editable: sale de los dos valores de arriba. */}
            <div
              className="flex h-10 items-center rounded-md border bg-muted/40 px-3 text-sm font-semibold"
              style={{
                color: inc == null ? '#9CA3AF' : inc > 0.15 ? '#C24444' : '#2E9E63',
              }}
            >
              {inc == null ? '—' : `${(inc * 100).toFixed(2)}%`}
            </div>
          </Campo>
          <Campo label="Diferido especial (USD)">
            <Input
              inputMode="decimal"
              value={form.diferidoEspecial ?? ''}
              onChange={(e) => set('diferidoEspecial', e.target.value)}
            />
          </Campo>
          <Campo label="Estado">
            <select
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={form.estado ?? ''}
              onChange={(e) => set('estado', e.target.value)}
            >
              {ESTADOS.map((e) => (
                <option key={e.valor} value={e.valor}>
                  {e.label}
                </option>
              ))}
            </select>
          </Campo>
          <Campo label="Envío">
            <select
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={form.envio ?? ''}
              onChange={(e) => set('envio', e.target.value)}
            >
              {ENVIOS.map((e) => (
                <option key={e.valor} value={e.valor}>
                  {e.label}
                </option>
              ))}
            </select>
            {r.fechaPrimerEnvio && (
              <p className="mt-1 text-[11px] text-muted-foreground">
                Primer envío: {new Date(r.fechaPrimerEnvio).toLocaleDateString('es-EC')}
              </p>
            )}
          </Campo>
          <div className="md:col-span-2">
            <Campo label="Comentarios">
              <textarea
                rows={2}
                className="w-full rounded-md border border-input bg-background p-2 text-sm"
                value={form.comentarios ?? ''}
                onChange={(e) => set('comentarios', e.target.value)}
              />
            </Campo>
          </div>
          <div className="md:col-span-2">
            <Campo label="Agregar nota a la bitácora">
              <textarea
                rows={2}
                className="w-full rounded-md border border-input bg-background p-2 text-sm"
                placeholder="Queda registrada con tu nombre y fecha. No se puede editar."
                value={nota}
                onChange={(e) => setNota(e.target.value)}
              />
            </Campo>
          </div>
        </div>

        {(r.notas ?? []).length > 0 && (
          <div className="mt-4 space-y-2 border-t pt-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Bitácora
            </p>
            {r.notas.map((n: any) => (
              <div key={n.id} className="rounded-md border bg-muted/30 p-2">
                <p className="whitespace-pre-wrap text-sm">{n.contenido}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {n.autorNombre ?? 'Usuario eliminado'} ·{' '}
                  {new Date(n.createdAt).toLocaleString('es-EC', {
                    day: '2-digit', month: '2-digit', year: '2-digit',
                    hour: '2-digit', minute: '2-digit',
                  })}
                </p>
              </div>
            ))}
          </div>
        )}

        {error && <p className="mt-3 rounded-md bg-red-50 p-2 text-xs text-red-600">{error}</p>}

        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <Button type="button" variant="outline" onClick={onCerrar}>
            Cancelar
          </Button>
          {/* El correo va aparte del guardado: es una comunicación al cliente y
              debe ser una acción explícita, no un efecto de guardar cambios. */}
          <Button
            type="button"
            variant="outline"
            onClick={() => setCorreoAbierto(true)}
          >
            <Mail className="mr-1.5 h-4 w-4" />
            {r.envio === 'ENVIADO' ? 'Ver correo enviado' : 'Preparar correo'}
          </Button>
          <Button
            type="button"
            disabled={guardar.isPending}
            onClick={() => {
              setError(null)
              guardar.mutate()
            }}
            style={{ backgroundColor: GOLD, color: '#fff' }}
          >
            {guardar.isPending ? 'Guardando…' : 'Guardar'}
          </Button>
        </div>
      </div>
    </div>
  )
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  )
}

function Dato({ label, valor }: { label: string; valor?: string | null }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{valor || '—'}</span>
    </div>
  )
}
