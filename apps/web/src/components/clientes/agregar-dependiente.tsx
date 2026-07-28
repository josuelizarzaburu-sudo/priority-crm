'use client'

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { api } from '@/lib/api'

const NAVY = '#0C2057'

const PARENTESCOS = [
  { valor: 'CONYUGE', label: 'Cónyuge' },
  { valor: 'HIJO', label: 'Hijo' },
  { valor: 'HIJA', label: 'Hija' },
  { valor: 'PADRE', label: 'Padre' },
  { valor: 'MADRE', label: 'Madre' },
  { valor: 'HERMANO', label: 'Hermano' },
  { valor: 'HERMANA', label: 'Hermana' },
  { valor: 'CUNADO', label: 'Cuñado' },
  { valor: 'OTRO', label: 'Otro' },
]

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  )
}

export function AgregarDependiente({ clienteId }: { clienteId: string }) {
  const qc = useQueryClient()
  const [abierto, setAbierto] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState<Record<string, string>>({ parentesco: 'HIJO' })

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }))

  const guardar = useMutation({
    mutationFn: async () => {
      const payload: Record<string, unknown> = { parentesco: form.parentesco || 'OTRO' }
      for (const k of ['nombres', 'apellidos', 'identificacion', 'fechaNacimiento']) {
        const v = (form[k] ?? '').trim()
        if (v) payload[k] = v
      }
      return (await api.post(`/clientes/${clienteId}/dependientes`, payload)).data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cliente', clienteId] })
      setForm({ parentesco: 'HIJO' })
      setAbierto(false)
    },
    onError: (e: any) => setError(e?.response?.data?.message ?? 'No se pudo guardar.'),
  })

  if (!abierto) {
    return (
      <Button type="button" variant="outline" size="sm" onClick={() => setAbierto(true)}>
        <Plus className="mr-1 h-3.5 w-3.5" /> Agregar dependiente
      </Button>
    )
  }

  return (
    <div className="mt-3 rounded-md border-2 border-dashed p-3">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Campo label="Nombres *">
          <Input value={form.nombres ?? ''} onChange={(e) => set('nombres', e.target.value)} />
        </Campo>
        <Campo label="Apellidos">
          <Input value={form.apellidos ?? ''} onChange={(e) => set('apellidos', e.target.value)} />
        </Campo>
        <Campo label="Cédula">
          <Input
            value={form.identificacion ?? ''}
            onChange={(e) => set('identificacion', e.target.value)}
          />
        </Campo>
        <Campo label="Nacimiento">
          <Input
            type="date"
            value={form.fechaNacimiento ?? ''}
            onChange={(e) => set('fechaNacimiento', e.target.value)}
          />
        </Campo>
        <Campo label="Parentesco">
          <select
            className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm"
            value={form.parentesco ?? 'HIJO'}
            onChange={(e) => set('parentesco', e.target.value)}
          >
            {PARENTESCOS.map((p) => (
              <option key={p.valor} value={p.valor}>
                {p.label}
              </option>
            ))}
          </select>
        </Campo>
      </div>

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      <p className="mt-2 text-[11px] text-muted-foreground">
        Después podrás marcar en cada póliza si esta persona queda cubierta.
      </p>

      <div className="mt-3 flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={() => setAbierto(false)}>
          Cancelar
        </Button>
        <Button
          type="button"
          size="sm"
          style={{ backgroundColor: NAVY, color: '#fff' }}
          disabled={guardar.isPending || !(form.nombres ?? '').trim()}
          onClick={() => {
            setError(null)
            guardar.mutate()
          }}
        >
          {guardar.isPending ? 'Guardando…' : 'Guardar'}
        </Button>
      </div>
    </div>
  )
}
