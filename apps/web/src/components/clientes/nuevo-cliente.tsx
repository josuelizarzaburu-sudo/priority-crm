'use client'

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { Plus, X } from 'lucide-react'
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

/**
 * Valida cédula ecuatoriana con el dígito verificador (módulo 10), y acepta
 * RUC de 13 dígitos para clientes empresa.
 * Devuelve null si está bien, o el motivo del problema.
 */
export function revisarIdentificacion(valor: string): string | null {
  const s = (valor ?? '').trim()
  if (!s) return null // vacío se maneja aparte
  if (!/^\d+$/.test(s)) return 'Solo debe tener números'
  if (s.length === 13) {
    return s.endsWith('001') ? null : 'Un RUC debe terminar en 001'
  }
  if (s.length !== 10) return `Tiene ${s.length} dígitos; una cédula tiene 10 y un RUC 13`

  const prov = parseInt(s.slice(0, 2), 10)
  if ((prov < 1 || prov > 24) && prov !== 30) return `La provincia ${s.slice(0, 2)} no existe`
  if (parseInt(s[2], 10) > 5) return 'El tercer dígito no corresponde a una persona natural'

  const coef = [2, 1, 2, 1, 2, 1, 2, 1, 2]
  let total = 0
  for (let i = 0; i < 9; i++) {
    const p = parseInt(s[i], 10) * coef[i]
    total += p > 9 ? p - 9 : p
  }
  const verif = (10 - (total % 10)) % 10
  if (verif !== parseInt(s[9], 10)) return 'El número no es válido (no pasa el dígito verificador)'
  return null
}

interface DepForm {
  nombres: string
  apellidos: string
  identificacion: string
  fechaNacimiento: string
  parentesco: string
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  )
}

export function NuevoCliente() {
  const qc = useQueryClient()
  const router = useRouter()
  const [abierto, setAbierto] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState<Record<string, string>>({})
  const [deps, setDeps] = useState<DepForm[]>([])

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }))

  // Aviso en vivo mientras digita, para no ensuciar la base desde el inicio.
  const avisoCedula = revisarIdentificacion(form.identificacion ?? '')

  const limpiar = () => {
    setForm({})
    setDeps([])
    setError(null)
  }

  const crear = useMutation({
    mutationFn: async () => {
      const payload: Record<string, unknown> = {}
      for (const [k, v] of Object.entries(form)) {
        const s = (v ?? '').trim()
        if (s) payload[k] = s
      }
      const limpios = deps
        .filter((d) => d.nombres.trim())
        .map((d) => ({
          nombres: d.nombres.trim(),
          apellidos: d.apellidos.trim() || undefined,
          identificacion: d.identificacion.trim() || undefined,
          fechaNacimiento: d.fechaNacimiento || undefined,
          parentesco: d.parentesco || 'OTRO',
        }))
      if (limpios.length) payload.dependientes = limpios
      return (await api.post('/clientes', payload)).data
    },
    onSuccess: (cliente: any) => {
      qc.invalidateQueries({ queryKey: ['clientes'] })
      setAbierto(false)
      limpiar()
      // Lo abrimos de una para que pueda cargarle la póliza.
      if (cliente?.id) router.push(`/clientes/${cliente.id}`)
    },
    onError: (e: any) => {
      setError(e?.response?.data?.message ?? 'No se pudo crear el cliente.')
    },
  })

  const faltanObligatorios =
    !(form.nombres ?? '').trim() ||
    !(form.apellidos ?? '').trim() ||
    !(form.identificacion ?? '').trim()

  if (!abierto) {
    return (
      <Button type="button" style={{ backgroundColor: NAVY, color: '#fff' }} onClick={() => setAbierto(true)}>
        <Plus className="mr-2 h-4 w-4" />
        Nuevo cliente
      </Button>
    )
  }

  return (
    <div className="rounded-lg border-2 border-dashed bg-card p-4">
      <h3 className="mb-3 text-sm font-bold" style={{ color: NAVY }}>
        Nuevo cliente
      </h3>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <Campo label="Nombres *">
          <Input value={form.nombres ?? ''} onChange={(e) => set('nombres', e.target.value)} />
        </Campo>
        <Campo label="Apellidos *">
          <Input value={form.apellidos ?? ''} onChange={(e) => set('apellidos', e.target.value)} />
        </Campo>
        <Campo label="Cédula o RUC *">
          <Input
            inputMode="numeric"
            value={form.identificacion ?? ''}
            onChange={(e) => set('identificacion', e.target.value)}
          />
          {avisoCedula && <p className="text-[11px] text-amber-700">{avisoCedula}</p>}
        </Campo>

        <Campo label="Nombre preferido">
          <Input
            placeholder="Cómo le gusta que le llamen"
            value={form.nombrePreferido ?? ''}
            onChange={(e) => set('nombrePreferido', e.target.value)}
          />
        </Campo>
        <Campo label="Contacto sugerido">
          <Input
            placeholder="A quién se contacta"
            value={form.contactoSugerido ?? ''}
            onChange={(e) => set('contactoSugerido', e.target.value)}
          />
        </Campo>
        <Campo label="Referido de">
          <Input value={form.referidoDe ?? ''} onChange={(e) => set('referidoDe', e.target.value)} />
        </Campo>

        <Campo label="Celular">
          <Input value={form.celular ?? ''} onChange={(e) => set('celular', e.target.value)} />
        </Campo>
        <Campo label="Teléfono">
          <Input value={form.telefono ?? ''} onChange={(e) => set('telefono', e.target.value)} />
        </Campo>
        <Campo label="Correo">
          <Input value={form.email ?? ''} onChange={(e) => set('email', e.target.value)} />
        </Campo>

        <Campo label="Género">
          <select
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={form.genero ?? ''}
            onChange={(e) => set('genero', e.target.value)}
          >
            <option value="">Selecciona</option>
            <option value="MASCULINO">Masculino</option>
            <option value="FEMENINO">Femenino</option>
            <option value="OTRO">Otro</option>
          </select>
        </Campo>
        <Campo label="Fecha de nacimiento">
          <Input
            type="date"
            value={form.fechaNacimiento ?? ''}
            onChange={(e) => set('fechaNacimiento', e.target.value)}
          />
        </Campo>
        <Campo label="Ciudad">
          <Input value={form.ciudad ?? ''} onChange={(e) => set('ciudad', e.target.value)} />
        </Campo>

        <div className="md:col-span-3">
          <Campo label="Dirección">
            <Input value={form.direccion ?? ''} onChange={(e) => set('direccion', e.target.value)} />
          </Campo>
        </div>
        <div className="md:col-span-3">
          <Campo label="Notas">
            <Input value={form.notas ?? ''} onChange={(e) => set('notas', e.target.value)} />
          </Campo>
        </div>
      </div>

      {/* Dependientes: opcionales al crear, se pueden sumar después */}
      <div className="mt-5 border-t pt-4">
        <div className="mb-2 flex items-center justify-between">
          <Label className="text-xs font-semibold" style={{ color: NAVY }}>
            Dependientes (opcional)
          </Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              setDeps((d) => [
                ...d,
                { nombres: '', apellidos: '', identificacion: '', fechaNacimiento: '', parentesco: 'HIJO' },
              ])
            }
          >
            <Plus className="mr-1 h-3.5 w-3.5" /> Agregar
          </Button>
        </div>

        {deps.length === 0 && (
          <p className="text-xs text-muted-foreground">
            Puedes agregarlos ahora o después, desde la ficha del cliente.
          </p>
        )}

        {deps.map((d, i) => (
          <div key={i} className="mb-2 grid grid-cols-2 items-end gap-2 rounded-md border p-2 md:grid-cols-6">
            <Campo label="Nombres">
              <Input
                value={d.nombres}
                onChange={(e) =>
                  setDeps((arr) => arr.map((x, j) => (j === i ? { ...x, nombres: e.target.value } : x)))
                }
              />
            </Campo>
            <Campo label="Apellidos">
              <Input
                value={d.apellidos}
                onChange={(e) =>
                  setDeps((arr) => arr.map((x, j) => (j === i ? { ...x, apellidos: e.target.value } : x)))
                }
              />
            </Campo>
            <Campo label="Cédula">
              <Input
                value={d.identificacion}
                onChange={(e) =>
                  setDeps((arr) =>
                    arr.map((x, j) => (j === i ? { ...x, identificacion: e.target.value } : x)),
                  )
                }
              />
            </Campo>
            <Campo label="Nacimiento">
              <Input
                type="date"
                value={d.fechaNacimiento}
                onChange={(e) =>
                  setDeps((arr) =>
                    arr.map((x, j) => (j === i ? { ...x, fechaNacimiento: e.target.value } : x)),
                  )
                }
              />
            </Campo>
            <Campo label="Parentesco">
              <select
                className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm"
                value={d.parentesco}
                onChange={(e) =>
                  setDeps((arr) => arr.map((x, j) => (j === i ? { ...x, parentesco: e.target.value } : x)))
                }
              >
                {PARENTESCOS.map((p) => (
                  <option key={p.valor} value={p.valor}>
                    {p.label}
                  </option>
                ))}
              </select>
            </Campo>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setDeps((arr) => arr.filter((_, j) => j !== i))}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ))}
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
          disabled={crear.isPending || faltanObligatorios}
          onClick={() => {
            setError(null)
            crear.mutate()
          }}
        >
          {crear.isPending ? 'Creando…' : 'Crear cliente'}
        </Button>
      </div>
    </div>
  )
}
