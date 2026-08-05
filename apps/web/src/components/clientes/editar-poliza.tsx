'use client'

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { api } from '@/lib/api'

const NAVY = '#0C2057'

const TIPOS = [
  { valor: 'SALUD', label: 'Salud' },
  { valor: 'AUTO', label: 'Auto' },
  { valor: 'VIDA', label: 'Vida' },
  { valor: 'HOGAR', label: 'Hogar' },
]

const ESTADOS = [
  { valor: 'NUEVO', label: 'Nuevo' },
  { valor: 'RENOVADO', label: 'Renovado' },
  { valor: 'CARTA_DE_NOMBRAMIENTO', label: 'Carta de nombramiento' },
  { valor: 'CANCELADA', label: 'Cancelada' },
]

const PAGOS = [
  { valor: 'CONTADO', label: 'Contado' },
  { valor: 'MENSUAL', label: 'Mensual' },
  { valor: 'DIFERIDO', label: 'Diferido' },
  { valor: 'DIFERIDO_ESPECIAL', label: 'Diferido especial' },
]

interface Poliza {
  id: string
  tipo: string
  numeroContrato: string | null
  estado: string | null
  aseguradora: string | null
  plan: string | null
  deducible: string | null
  formaPago: string | null
  fechaEmision: string | null
  primaNeta: string | number | null
  sumaAsegurada: string | number | null
  marca: string | null
  modelo: string | null
  anio: number | null
  placa: string | null
  tiempoCobertura: string | null
  observacion: string | null
  agenteNombre: string | null
  dependientes: { dependiente: { id: string } }[]
}

interface Dependiente {
  id: string
  nombres: string
  apellidos: string | null
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  )
}

const txt = (v: string | number | null | undefined) =>
  v === null || v === undefined ? '' : String(v)

export function EditarPoliza({
  clienteId,
  poliza,
  dependientes,
}: {
  clienteId: string
  poliza: Poliza
  dependientes: Dependiente[]
}) {
  const qc = useQueryClient()
  const [abierto, setAbierto] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tipo, setTipo] = useState(poliza.tipo)
  const [form, setForm] = useState<Record<string, string>>({})
  const [cubre, setCubre] = useState<string[]>([])

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }))

  const abrir = () => {
    setTipo(poliza.tipo)
    setForm({
      aseguradora: txt(poliza.aseguradora),
      plan: txt(poliza.plan),
      numeroContrato: txt(poliza.numeroContrato),
      estado: txt(poliza.estado),
      formaPago: txt(poliza.formaPago),
      fechaEmision: poliza.fechaEmision ? poliza.fechaEmision.slice(0, 10) : '',
      primaNeta: txt(poliza.primaNeta),
      sumaAsegurada: txt(poliza.sumaAsegurada),
      deducible: txt(poliza.deducible),
      tiempoCobertura: txt(poliza.tiempoCobertura),
      marca: txt(poliza.marca),
      modelo: txt(poliza.modelo),
      anio: txt(poliza.anio),
      placa: txt(poliza.placa),
      agenteNombre: txt(poliza.agenteNombre),
      observacion: txt(poliza.observacion),
    })
    setCubre(poliza.dependientes.map((d) => d.dependiente.id))
    setError(null)
    setAbierto(true)
  }

  const guardar = useMutation({
    mutationFn: async () => {
      const numericos = ['primaNeta', 'sumaAsegurada', 'anio']
      const payload: Record<string, unknown> = { tipo }
      for (const [k, v] of Object.entries(form)) {
        const s = (v ?? '').trim()
        if (s === '') {
          payload[k] = null
          continue
        }
        payload[k] = numericos.includes(k) ? Number(s) : s
      }
      // La lista de cubiertos se reemplaza completa.
      payload.dependienteIds = tipo === 'SALUD' ? cubre : []
      return (await api.patch(`/clientes/${clienteId}/polizas/${poliza.id}`, payload)).data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cliente', clienteId] })
      setAbierto(false)
    },
    onError: (e: any) => {
      setError(e?.response?.data?.message ?? 'No se pudo guardar la póliza.')
    },
  })

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={abrir}
        className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
        aria-label="Editar póliza"
        title="Editar póliza"
      >
        <Pencil className="h-4 w-4" />
      </button>
    )
  }

  return (
    <div className="mt-3 w-full rounded-lg border-2 border-dashed p-4">
      <h4 className="mb-3 text-sm font-bold" style={{ color: NAVY }}>
        Editar póliza
      </h4>

      <div className="mb-4">
        <Label className="mb-2 block text-xs text-muted-foreground">Tipo de seguro</Label>
        <div className="flex flex-wrap gap-2">
          {TIPOS.map((t) => (
            <button
              key={t.valor}
              type="button"
              onClick={() => setTipo(t.valor)}
              className="rounded-full border px-4 py-1.5 text-sm font-medium transition-colors"
              style={{
                borderColor: tipo === t.valor ? NAVY : '#d4d4d8',
                backgroundColor: tipo === t.valor ? NAVY : '#fff',
                color: tipo === t.valor ? '#fff' : NAVY,
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <Campo label="Compañía de seguros">
          <Input value={form.aseguradora ?? ''} onChange={(e) => set('aseguradora', e.target.value)} />
        </Campo>
        <Campo label="Plan">
          <Input value={form.plan ?? ''} onChange={(e) => set('plan', e.target.value)} />
        </Campo>
        <Campo label="N° de contrato">
          <Input
            value={form.numeroContrato ?? ''}
            onChange={(e) => set('numeroContrato', e.target.value)}
          />
        </Campo>

        <Campo label="Estado">
          <select
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={form.estado ?? ''}
            onChange={(e) => set('estado', e.target.value)}
          >
            <option value="">Selecciona</option>
            {ESTADOS.map((x) => (
              <option key={x.valor} value={x.valor}>
                {x.label}
              </option>
            ))}
          </select>
        </Campo>
        <Campo label="Forma de pago">
          <select
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={form.formaPago ?? ''}
            onChange={(e) => set('formaPago', e.target.value)}
          >
            <option value="">Selecciona</option>
            {PAGOS.map((x) => (
              <option key={x.valor} value={x.valor}>
                {x.label}
              </option>
            ))}
          </select>
        </Campo>
        <Campo label="Fecha de vigencia">
          <Input
            type="date"
            value={form.fechaEmision ?? ''}
            onChange={(e) => set('fechaEmision', e.target.value)}
          />
        </Campo>

        <Campo label="Prima neta (USD)">
          <Input
            inputMode="decimal"
            value={form.primaNeta ?? ''}
            onChange={(e) => set('primaNeta', e.target.value)}
          />
        </Campo>

        {tipo !== 'SALUD' && (
          <Campo label="Suma asegurada (USD)">
            <Input
              inputMode="decimal"
              value={form.sumaAsegurada ?? ''}
              onChange={(e) => set('sumaAsegurada', e.target.value)}
            />
          </Campo>
        )}

        {(tipo === 'SALUD' || tipo === 'AUTO') && (
          <Campo label="Deducible">
            <Input value={form.deducible ?? ''} onChange={(e) => set('deducible', e.target.value)} />
          </Campo>
        )}

        {tipo === 'VIDA' && (
          <Campo label="Tiempo de cobertura">
            <Input
              placeholder="Ej: 30 años"
              value={form.tiempoCobertura ?? ''}
              onChange={(e) => set('tiempoCobertura', e.target.value)}
            />
          </Campo>
        )}

        <Campo label="Agente">
          <Input
            value={form.agenteNombre ?? ''}
            onChange={(e) => set('agenteNombre', e.target.value)}
          />
        </Campo>
      </div>

      {tipo === 'AUTO' && (
        <div className="mt-4 rounded-md bg-muted/40 p-3">
          <div className="mb-2 text-xs font-semibold" style={{ color: NAVY }}>
            Datos del vehículo
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Campo label="Marca">
              <Input value={form.marca ?? ''} onChange={(e) => set('marca', e.target.value)} />
            </Campo>
            <Campo label="Modelo">
              <Input value={form.modelo ?? ''} onChange={(e) => set('modelo', e.target.value)} />
            </Campo>
            <Campo label="Año">
              <Input
                inputMode="numeric"
                value={form.anio ?? ''}
                onChange={(e) => set('anio', e.target.value)}
              />
            </Campo>
            <Campo label="Placa">
              <Input value={form.placa ?? ''} onChange={(e) => set('placa', e.target.value)} />
            </Campo>
          </div>
        </div>
      )}

      {tipo === 'SALUD' && dependientes.length > 0 && (
        <div className="mt-4">
          <Label className="mb-2 block text-xs text-muted-foreground">
            ¿A qué dependientes cubre esta póliza?
          </Label>
          <div className="flex flex-wrap gap-2">
            {dependientes.map((d) => {
              const marcado = cubre.includes(d.id)
              return (
                <button
                  key={d.id}
                  type="button"
                  onClick={() =>
                    setCubre((c) => (marcado ? c.filter((x) => x !== d.id) : [...c, d.id]))
                  }
                  className="rounded-full border px-3 py-1 text-xs transition-colors"
                  style={{
                    borderColor: marcado ? NAVY : '#d4d4d8',
                    backgroundColor: marcado ? NAVY : '#fff',
                    color: marcado ? '#fff' : NAVY,
                  }}
                >
                  {marcado ? '✓ ' : ''}
                  {d.nombres} {d.apellidos ?? ''}
                </button>
              )
            })}
          </div>
        </div>
      )}

      <div className="mt-4">
        <Campo label="Observación">
          <Input
            value={form.observacion ?? ''}
            onChange={(e) => set('observacion', e.target.value)}
          />
        </Campo>
      </div>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      <div className="mt-4 flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={() => setAbierto(false)}>
          Cancelar
        </Button>
        <Button
          type="button"
          style={{ backgroundColor: NAVY, color: '#fff' }}
          disabled={guardar.isPending}
          onClick={() => {
            setError(null)
            guardar.mutate()
          }}
        >
          {guardar.isPending ? 'Guardando…' : 'Guardar cambios'}
        </Button>
      </div>
    </div>
  )
}
