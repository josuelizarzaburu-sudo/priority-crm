'use client'

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useSession } from 'next-auth/react'
import { X, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { api } from '@/lib/api'

const NAVY = '#0C2057'
const JEFES = ['SUPER_ADMIN', 'OWNER', 'JEFE_OPERACIONES']

const ESTADOS = [
  { valor: 'EN_TRAMITE', label: 'En trámite' },
  { valor: 'LIQUIDADO', label: 'Liquidado' },
  { valor: 'NEGADO', label: 'Negado' },
  { valor: 'DEVUELTO', label: 'Devuelto' },
]

const ASEGURADORAS = ['BMI', 'HUMANA', 'CONFIAMED', 'SALUDSA', 'BUPA', 'PALIG', 'VUMI', 'SEGUROS ATLANTIDA']
const MEDIOS = ['CORREO', 'WHATSAPP', 'FISICO', 'CORREO - WHATSAPP']

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  )
}

const dia = (v: string | null | undefined) => (v ? String(v).slice(0, 10) : '')
const txt = (v: any) => (v === null || v === undefined ? '' : String(v))

/**
 * Formulario de reclamo. Sirve para crear (sin `reclamo`) y para editar.
 * Se muestra como panel lateral para no perder de vista la lista.
 */
export function ReclamoForm({
  reclamo,
  onCerrar,
}: {
  reclamo?: any
  onCerrar: () => void
}) {
  const qc = useQueryClient()
  const { data: session } = useSession()
  const esJefe = JEFES.includes((session?.user as any)?.role ?? '')
  const editando = Boolean(reclamo?.id)

  const [error, setError] = useState<string | null>(null)
  const [confirmarBorrar, setConfirmarBorrar] = useState(false)
  const [form, setForm] = useState<Record<string, string>>({
    clienteNombre: txt(reclamo?.clienteNombre),
    pacienteNombre: txt(reclamo?.pacienteNombre),
    aseguradora: txt(reclamo?.aseguradora),
    contrato: txt(reclamo?.contrato) || 'INDIVIDUAL',
    diagnostico: txt(reclamo?.diagnostico),
    fechaRecepcion: dia(reclamo?.fechaRecepcion),
    fechaEnvioAseguradora: dia(reclamo?.fechaEnvioAseguradora),
    liquidacion: txt(reclamo?.liquidacion),
    fechaLiquidacion: dia(reclamo?.fechaLiquidacion),
    fechaEnvioCliente: dia(reclamo?.fechaEnvioCliente),
    valor: txt(reclamo?.valor),
    estado: txt(reclamo?.estado) || 'EN_TRAMITE',
    medioComunicacion: txt(reclamo?.medioComunicacion),
    observaciones: txt(reclamo?.observaciones),
    detalle: txt(reclamo?.detalle),
  })

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }))

  const refrescar = () => {
    qc.invalidateQueries({ queryKey: ['reclamos'] })
    qc.invalidateQueries({ queryKey: ['reclamos-resumen'] })
  }

  const guardar = useMutation({
    mutationFn: async () => {
      const payload: Record<string, unknown> = {}
      for (const [k, v] of Object.entries(form)) {
        const s = (v ?? '').trim()
        if (k === 'valor') {
          payload[k] = s === '' ? null : Number(s)
        } else {
          payload[k] = s === '' ? null : s
        }
      }
      payload.clienteNombre = (form.clienteNombre ?? '').trim()
      return editando
        ? (await api.patch(`/reclamos/${reclamo.id}`, payload)).data
        : (await api.post('/reclamos', payload)).data
    },
    onSuccess: () => {
      refrescar()
      onCerrar()
    },
    onError: (e: any) => setError(e?.response?.data?.message ?? 'No se pudo guardar.'),
  })

  const borrar = useMutation({
    mutationFn: async () => (await api.delete(`/reclamos/${reclamo.id}`)).data,
    onSuccess: () => {
      refrescar()
      onCerrar()
    },
    onError: (e: any) => setError(e?.response?.data?.message ?? 'No se pudo eliminar.'),
  })

  // Los días se calculan solos; aquí solo se muestran como referencia.
  const dias = (a: string, b: string) => {
    if (!form[a] || !form[b]) return null
    const d = Math.round(
      (new Date(form[b]).getTime() - new Date(form[a]).getTime()) / 86400000,
    )
    return d >= 0 ? d : null
  }
  const diasLiq = dias('fechaEnvioAseguradora', 'fechaLiquidacion')
  const diasCli = dias('fechaLiquidacion', 'fechaEnvioCliente')

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={onCerrar}>
      <div
        className="h-full w-full max-w-2xl overflow-y-auto bg-background p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold" style={{ color: NAVY }}>
            {editando ? 'Reclamo' : 'Nuevo reclamo'}
          </h2>
          <button type="button" onClick={onCerrar} aria-label="Cerrar" className="p-1">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Campo label="Cliente (titular) *">
            <Input
              value={form.clienteNombre}
              onChange={(e) => set('clienteNombre', e.target.value)}
            />
          </Campo>
          <Campo label="Paciente">
            <Input
              placeholder="Si es distinto del titular"
              value={form.pacienteNombre}
              onChange={(e) => set('pacienteNombre', e.target.value)}
            />
          </Campo>

          <Campo label="Aseguradora">
            <Input
              list="aseguradoras-reclamo"
              value={form.aseguradora}
              onChange={(e) => set('aseguradora', e.target.value)}
            />
            <datalist id="aseguradoras-reclamo">
              {ASEGURADORAS.map((a) => (
                <option key={a} value={a} />
              ))}
            </datalist>
          </Campo>
          <Campo label="Contrato">
            <Input
              placeholder="INDIVIDUAL o nombre de la empresa"
              value={form.contrato}
              onChange={(e) => set('contrato', e.target.value)}
            />
          </Campo>

          <div className="md:col-span-2">
            <Campo label="Diagnóstico">
              <Input
                value={form.diagnostico}
                onChange={(e) => set('diagnostico', e.target.value)}
              />
            </Campo>
          </div>

          <Campo label="Fecha de recepción">
            <Input
              type="date"
              value={form.fechaRecepcion}
              onChange={(e) => set('fechaRecepcion', e.target.value)}
            />
          </Campo>
          <Campo label="Fecha de envío a la aseguradora">
            <Input
              type="date"
              value={form.fechaEnvioAseguradora}
              onChange={(e) => set('fechaEnvioAseguradora', e.target.value)}
            />
          </Campo>

          <Campo label="N° de liquidación">
            <Input value={form.liquidacion} onChange={(e) => set('liquidacion', e.target.value)} />
          </Campo>
          <Campo label="Fecha de liquidación">
            <Input
              type="date"
              value={form.fechaLiquidacion}
              onChange={(e) => set('fechaLiquidacion', e.target.value)}
            />
            {diasLiq !== null && (
              <p className="text-[11px] text-muted-foreground">
                {diasLiq} días desde el envío
              </p>
            )}
          </Campo>

          <Campo label="Fecha de envío al cliente">
            <Input
              type="date"
              value={form.fechaEnvioCliente}
              onChange={(e) => set('fechaEnvioCliente', e.target.value)}
            />
            {diasCli !== null && (
              <p className="text-[11px] text-muted-foreground">
                {diasCli} días desde la liquidación
              </p>
            )}
          </Campo>
          <Campo label="Valor (USD)">
            <Input
              inputMode="decimal"
              value={form.valor}
              onChange={(e) => set('valor', e.target.value)}
            />
          </Campo>

          <Campo label="Estado">
            <select
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={form.estado}
              onChange={(e) => set('estado', e.target.value)}
            >
              {ESTADOS.map((x) => (
                <option key={x.valor} value={x.valor}>
                  {x.label}
                </option>
              ))}
            </select>
          </Campo>
          <Campo label="Medio de comunicación">
            <Input
              list="medios-reclamo"
              value={form.medioComunicacion}
              onChange={(e) => set('medioComunicacion', e.target.value)}
            />
            <datalist id="medios-reclamo">
              {MEDIOS.map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
          </Campo>

          <div className="md:col-span-2">
            <Campo label="Observaciones">
              <Input
                value={form.observaciones}
                onChange={(e) => set('observaciones', e.target.value)}
              />
            </Campo>
          </div>
          <div className="md:col-span-2">
            <Campo label="Detalle">
              <Input value={form.detalle} onChange={(e) => set('detalle', e.target.value)} />
            </Campo>
          </div>
        </div>

        {editando && reclamo?.ejecutivoNombre && (
          <p className="mt-3 text-xs text-muted-foreground">
            Gestionado por {reclamo.ejecutivoNombre}
            {!reclamo.ejecutivo && ' (ya no trabaja en Priority)'}
          </p>
        )}

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

        <div className="mt-5 flex items-center justify-between gap-2">
          <div>
            {editando && esJefe && (
              confirmarBorrar ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">¿Eliminar?</span>
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    disabled={borrar.isPending}
                    onClick={() => borrar.mutate()}
                  >
                    Sí, eliminar
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setConfirmarBorrar(false)}
                  >
                    Cancelar
                  </Button>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground hover:text-red-600"
                  onClick={() => setConfirmarBorrar(true)}
                >
                  <Trash2 className="mr-1 h-4 w-4" /> Eliminar
                </Button>
              )
            )}
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="ghost" onClick={onCerrar}>
              Cancelar
            </Button>
            <Button
              type="button"
              style={{ backgroundColor: NAVY, color: '#fff' }}
              disabled={guardar.isPending || !form.clienteNombre.trim()}
              onClick={() => {
                setError(null)
                guardar.mutate()
              }}
            >
              {guardar.isPending ? 'Guardando…' : 'Guardar'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
