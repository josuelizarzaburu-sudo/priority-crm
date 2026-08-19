'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { api } from '@/lib/api'
import { enMayusculas } from '@/lib/mayusculas'
import { ASEGURADORAS_POR_RAMO, type RamoId } from '@/lib/ramos-seguros'

const NAVY = '#0C2057'

const TIPOS = [
  { valor: 'SALUD', label: 'Salud' },
  { valor: 'AUTO', label: 'Auto' },
  { valor: 'VIDA', label: 'Vida' },
  { valor: 'HOGAR', label: 'Hogar' },
] as const

const ESTADOS = [
  { valor: 'NUEVO', label: 'Nuevo' },
  { valor: 'RENOVADO', label: 'Renovado' },
  { valor: 'CARTA_DE_NOMBRAMIENTO', label: 'Carta de nombramiento' },
]

const PAGOS = [
  { valor: 'CONTADO', label: 'Contado' },
  { valor: 'MENSUAL', label: 'Mensual' },
  { valor: 'DIFERIDO', label: 'Diferido' },
  { valor: 'DIFERIDO_ESPECIAL', label: 'Diferido especial' },
]

interface Dependiente {
  id: string
  nombres: string
  apellidos: string | null
  parentesco: string
}

function Campo({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  )
}

export function AgregarPoliza({
  clienteId,
  dependientes,
}: {
  clienteId: string
  dependientes: Dependiente[]
}) {
  const qc = useQueryClient()
  const [abierto, setAbierto] = useState(false)
  const [tipo, setTipo] = useState<string>('SALUD')

  // Equipo del CRM, para elegir el agente que vendió la póliza.
  const { data: equipo } = useQuery({
    queryKey: ['usuarios-poliza'],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => (await api.get('/users')).data as { id: string; name: string }[],
  })
  const [form, setForm] = useState<Record<string, string>>({})
  const [cubre, setCubre] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }))

  const limpiar = () => {
    setForm({})
    setCubre([])
    setTipo('SALUD')
    setError(null)
  }

  const mutation = useMutation({
    mutationFn: async () => {
      // Solo mandamos lo que tiene valor; los numeros van como number.
      const payload: Record<string, unknown> = { tipo }
      const numericos = ['primaNeta', 'sumaAsegurada', 'anio']
      for (const [k, v] of Object.entries(form)) {
        if (v === undefined || v === null || String(v).trim() === '') continue
        payload[k] = numericos.includes(k) ? Number(v) : v
      }
      if (tipo === 'SALUD' && cubre.length) payload.dependienteIds = cubre
      return (await api.post(`/clientes/${clienteId}/polizas`, payload)).data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cliente', clienteId] })
      setAbierto(false)
      limpiar()
    },
    onError: (e: any) => {
      setError(e?.response?.data?.message ?? 'No se pudo guardar la póliza.')
    },
  })

  if (!abierto) {
    return (
      <Button
        type="button"
        variant="outline"
        className="w-full border-dashed"
        onClick={() => setAbierto(true)}
      >
        <Plus className="mr-2 h-4 w-4" />
        Agregar póliza
      </Button>
    )
  }

  return (
    <div className="rounded-lg border-2 border-dashed p-4">
      <h3 className="mb-3 text-sm font-bold" style={{ color: NAVY }}>
        Nueva póliza
      </h3>

      {/* Tipo de seguro: define qué campos se piden abajo */}
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

      {/* Campos comunes a todos los ramos */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <Campo label="Compañía de seguros">
          {/* Las opciones cambian segun el ramo elegido arriba. Es lista con
              sugerencias, no cerrada, por si aparece una aseguradora nueva. */}
          <Input
            list="aseguradoras-poliza"
            value={form.aseguradora ?? ''}
            onChange={enMayusculas((v) => set('aseguradora', v))}
          />
          <datalist id="aseguradoras-poliza">
            {(ASEGURADORAS_POR_RAMO[tipo as RamoId] ?? []).map((a) => (
              <option key={a} value={a.toLocaleUpperCase('es-EC')} />
            ))}
          </datalist>
        </Campo>
        <Campo label="Plan">
          <Input value={form.plan ?? ''} onChange={enMayusculas((v) => set('plan', v))} />
        </Campo>
        <Campo label="N° de contrato">
          <Input
            value={form.numeroContrato ?? ''}
            onChange={enMayusculas((v) => set('numeroContrato', v))}
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

        <Campo label="Prima anual (USD)">
          <Input
            inputMode="decimal"
            value={form.primaNeta ?? ''}
            onChange={(e) => set('primaNeta', e.target.value)}
          />
        </Campo>

        {/* Suma asegurada: aplica a auto, vida y hogar */}
        {tipo !== 'SALUD' && (
          <Campo label="Suma asegurada (USD)">
            <Input
              inputMode="decimal"
              value={form.sumaAsegurada ?? ''}
              onChange={(e) => set('sumaAsegurada', e.target.value)}
            />
          </Campo>
        )}

        {/* Deducible: salud y auto */}
        {(tipo === 'SALUD' || tipo === 'AUTO') && (
          <Campo label="Deducible">
            <Input value={form.deducible ?? ''} onChange={(e) => set('deducible', e.target.value)} />
          </Campo>
        )}

        {/* Tiempo de cobertura: solo vida */}
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
          {/* Se elige del equipo del CRM en vez de escribirlo: asi el nombre queda
              siempre bien escrito y la poliza queda enlazada al usuario real. */}
          <select
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={form.agenteId ?? ''}
            onChange={(e) => {
              const u = (equipo ?? []).find((x) => x.id === e.target.value)
              set('agenteId', e.target.value)
              set('agenteNombre', u?.name ?? '')
            }}
          >
            <option value="">Selecciona</option>
            {(equipo ?? []).map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </Campo>
      </div>

      {/* Datos del vehículo: solo auto */}
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

      {/* A quién cubre: solo salud, y solo si el cliente tiene dependientes */}
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
          <Input value={form.observacion ?? ''} onChange={(e) => set('observacion', e.target.value)} />
        </Campo>
      </div>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      <div className="mt-4 flex justify-end gap-2">
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            setAbierto(false)
            limpiar()
          }}
        >
          Cancelar
        </Button>
        <Button
          type="button"
          style={{ backgroundColor: NAVY, color: '#fff' }}
          disabled={mutation.isPending}
          onClick={() => {
            setError(null)
            mutation.mutate()
          }}
        >
          {mutation.isPending ? 'Guardando…' : 'Guardar póliza'}
        </Button>
      </div>
    </div>
  )
}
