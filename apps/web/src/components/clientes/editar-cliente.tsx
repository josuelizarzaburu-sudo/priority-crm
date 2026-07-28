'use client'

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useSession } from 'next-auth/react'
import { Pencil, Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { api } from '@/lib/api'

const NAVY = '#0C2057'
const JEFES = ['SUPER_ADMIN', 'OWNER', 'JEFE_OPERACIONES']

interface Cliente {
  id: string
  nombres: string
  apellidos: string
  identificacion: string
  nombrePreferido: string | null
  referidoDe: string | null
  contactoSugerido: string | null
  genero: string | null
  fechaNacimiento: string | null
  email: string | null
  telefono: string | null
  celular: string | null
  ciudad: string | null
  direccion: string | null
  notas: string | null
  cedulaEditada: boolean
}

// Campo de solo lectura: se ve el dato pero con candado y explicación.
function Bloqueado({ label, valor, motivo }: { label: string; valor: string; motivo: string }) {
  return (
    <div className="space-y-1">
      <Label className="flex items-center gap-1 text-xs text-muted-foreground">
        <Lock className="h-3 w-3" /> {label}
      </Label>
      <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
        {valor || '—'}
      </div>
      <p className="text-[11px] text-muted-foreground">{motivo}</p>
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

export function EditarCliente({ cliente }: { cliente: Cliente }) {
  const qc = useQueryClient()
  const { data: session } = useSession()
  const rol = (session?.user as any)?.role ?? ''
  const esJefe = JEFES.includes(rol)

  const [abierto, setAbierto] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState<Record<string, string>>({})

  // La ejecutiva tiene UNA corrección de cédula; después queda congelada.
  const puedeEditarCedula = esJefe || !cliente.cedulaEditada

  const abrir = () => {
    setForm({
      nombres: cliente.nombres ?? '',
      apellidos: cliente.apellidos ?? '',
      identificacion: cliente.identificacion ?? '',
      nombrePreferido: cliente.nombrePreferido ?? '',
      referidoDe: cliente.referidoDe ?? '',
      contactoSugerido: cliente.contactoSugerido ?? '',
      email: cliente.email ?? '',
      telefono: cliente.telefono ?? '',
      celular: cliente.celular ?? '',
      ciudad: cliente.ciudad ?? '',
      direccion: cliente.direccion ?? '',
      notas: cliente.notas ?? '',
      fechaNacimiento: cliente.fechaNacimiento ? cliente.fechaNacimiento.slice(0, 10) : '',
    })
    setError(null)
    setAbierto(true)
  }

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }))

  const guardar = useMutation({
    mutationFn: async () => {
      const payload: Record<string, unknown> = {}
      // Solo mandamos lo que el usuario realmente puede cambiar.
      const editables = [
        'nombrePreferido',
        'referidoDe',
        'contactoSugerido',
        'email',
        'telefono',
        'celular',
        'ciudad',
        'direccion',
        'notas',
      ]
      if (esJefe) editables.push('nombres', 'apellidos', 'fechaNacimiento')
      if (puedeEditarCedula) editables.push('identificacion')

      for (const k of editables) {
        const v = (form[k] ?? '').trim()
        payload[k] = v === '' ? null : v
      }
      return (await api.patch(`/clientes/${cliente.id}`, payload)).data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cliente', cliente.id] })
      qc.invalidateQueries({ queryKey: ['clientes'] })
      setAbierto(false)
    },
    onError: (e: any) => {
      setError(e?.response?.data?.message ?? 'No se pudo guardar.')
    },
  })

  if (!abierto) {
    return (
      <Button type="button" variant="outline" size="sm" onClick={abrir}>
        <Pencil className="mr-2 h-3.5 w-3.5" />
        Editar datos
      </Button>
    )
  }

  return (
    <div className="rounded-lg border-2 border-dashed p-4">
      <h3 className="mb-3 text-sm font-bold" style={{ color: NAVY }}>
        Editar datos del cliente
      </h3>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {/* Identidad: bloqueada para la ejecutiva */}
        {esJefe ? (
          <>
            <Campo label="Nombres">
              <Input value={form.nombres ?? ''} onChange={(e) => set('nombres', e.target.value)} />
            </Campo>
            <Campo label="Apellidos">
              <Input value={form.apellidos ?? ''} onChange={(e) => set('apellidos', e.target.value)} />
            </Campo>
            <Campo label="Fecha de nacimiento">
              <Input
                type="date"
                value={form.fechaNacimiento ?? ''}
                onChange={(e) => set('fechaNacimiento', e.target.value)}
              />
            </Campo>
          </>
        ) : (
          <>
            <Bloqueado
              label="Nombres"
              valor={cliente.nombres}
              motivo="Solo el jefe de operaciones puede cambiarlo"
            />
            <Bloqueado
              label="Apellidos"
              valor={cliente.apellidos}
              motivo="Solo el jefe de operaciones puede cambiarlo"
            />
            <Bloqueado
              label="Fecha de nacimiento"
              valor={cliente.fechaNacimiento ? cliente.fechaNacimiento.slice(0, 10) : '—'}
              motivo="Solo el jefe de operaciones puede cambiarla"
            />
          </>
        )}

        {/* Cédula: una sola corrección para la ejecutiva */}
        {puedeEditarCedula ? (
          <Campo label={esJefe ? 'Cédula / RUC' : 'Cédula / RUC (una sola corrección)'}>
            <Input
              value={form.identificacion ?? ''}
              onChange={(e) => set('identificacion', e.target.value)}
            />
            {!esJefe && (
              <p className="text-[11px] text-amber-700">
                Puedes corregirla una vez. Después tendrás que pedírselo al jefe de operaciones.
              </p>
            )}
          </Campo>
        ) : (
          <Bloqueado
            label="Cédula / RUC"
            valor={cliente.identificacion}
            motivo="Ya se corrigió una vez. Pídeselo al jefe de operaciones."
          />
        )}

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

        <Campo label="Ciudad">
          <Input value={form.ciudad ?? ''} onChange={(e) => set('ciudad', e.target.value)} />
        </Campo>
        <div className="md:col-span-2">
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
