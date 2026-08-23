'use client'

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useSession } from 'next-auth/react'
import { Pencil, Lock, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { api } from '@/lib/api'
import { enMayusculas } from '@/lib/mayusculas'

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

  /**
   * Un dato de identidad se puede COMPLETAR si llego vacio, aunque no se pueda
   * cambiar si ya tiene valor.
   *
   * Un cliente creado desde un deal ganado suele llegar sin fecha de nacimiento
   * y a veces sin apellidos. Si la ejecutiva no puede llenarlos, queda atrapada:
   * no puede completar la ficha que le asignaron justamente para eso.
   */
  const vacio = (v: unknown) =>
    v === null || v === undefined || (typeof v === 'string' && !v.trim())
  const puedeCompletar = (campo: 'nombres' | 'apellidos' | 'fechaNacimiento') =>
    esJefe || vacio((cliente as any)[campo])

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
      genero: cliente.genero ?? '',
      vieneDeOtroSeguro: (cliente as any).vieneDeOtroSeguro ?? '',
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
        'genero',
        'vieneDeOtroSeguro',
      ]
      for (const c of ['nombres', 'apellidos', 'fechaNacimiento'] as const) {
        if (puedeCompletar(c)) editables.push(c)
      }
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

  // El boton vive en el encabezado de la seccion, que es un contenedor flex
  // estrecho. Por eso el formulario NO se renderiza ahi dentro —quedaba
  // comprimido en esa franja y los campos no se veian, mientras abajo seguian
  // los datos de solo lectura— sino en un panel lateral, como el resto del CRM.
  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={abrir}>
        <Pencil className="mr-2 h-3.5 w-3.5" />
        Editar datos
      </Button>

      {abierto && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-black/30"
          onClick={() => setAbierto(false)}
        >
          <div
            className="h-full w-full max-w-2xl overflow-y-auto bg-background p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold" style={{ color: NAVY }}>
                Editar datos del cliente
              </h3>
              <button
                type="button"
                onClick={() => setAbierto(false)}
                aria-label="Cerrar"
                className="p-1 text-muted-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {/* Identidad: se evalua campo por campo. Cambiar un dato que ya existe
            es del jefe; completar uno vacio lo puede hacer la ejecutiva. */}
        {puedeCompletar('nombres') ? (
          <Campo label={esJefe ? 'Nombres' : 'Nombres (completar)'}>
            <Input value={form.nombres ?? ''} onChange={enMayusculas((v) => set('nombres', v))} />
          </Campo>
        ) : (
          <Bloqueado
            label="Nombres"
            valor={cliente.nombres}
            motivo="Solo el jefe de operaciones puede cambiarlo"
          />
        )}

        {puedeCompletar('apellidos') ? (
          <Campo label={esJefe ? 'Apellidos' : 'Apellidos (completar)'}>
            <Input value={form.apellidos ?? ''} onChange={enMayusculas((v) => set('apellidos', v))} />
          </Campo>
        ) : (
          <Bloqueado
            label="Apellidos"
            valor={cliente.apellidos}
            motivo="Solo el jefe de operaciones puede cambiarlo"
          />
        )}

        {puedeCompletar('fechaNacimiento') ? (
          <Campo label={esJefe ? 'Fecha de nacimiento' : 'Fecha de nacimiento (completar)'}>
            <Input
              type="date"
              value={form.fechaNacimiento ?? ''}
              onChange={(e) => set('fechaNacimiento', e.target.value)}
            />
          </Campo>
        ) : (
          <Bloqueado
            label="Fecha de nacimiento"
            valor={cliente.fechaNacimiento ? cliente.fechaNacimiento.slice(0, 10) : '—'}
            motivo="Solo el jefe de operaciones puede cambiarla"
          />
        )}

        {/* Genero: no estaba en el formulario, asi que si llegaba vacio no habia
            forma de completarlo. Decide si la carta de bienvenida dice
            "Estimada Sra." o "Estimado Sr.". */}
        <Campo label="Género">
          <select
            value={form.genero ?? ''}
            onChange={(e) => set('genero', e.target.value)}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">— Sin especificar —</option>
            <option value="FEMENINO">Femenino</option>
            <option value="MASCULINO">Masculino</option>
          </select>
        </Campo>

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
            onChange={enMayusculas((v) => set('nombrePreferido', v))}
          />
        </Campo>
        <Campo label="Persona de contacto">
          <Input
            placeholder="A quién se contacta"
            value={form.contactoSugerido ?? ''}
            onChange={enMayusculas((v) => set('contactoSugerido', v))}
          />
        </Campo>
        <Campo label="Referido de">
          <Input value={form.referidoDe ?? ''} onChange={enMayusculas((v) => set('referidoDe', v))} />
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
          <Input value={form.ciudad ?? ''} onChange={enMayusculas((v) => set('ciudad', v))} />
        </Campo>
        <div className="md:col-span-2">
          <Campo label="Dirección">
            <Input value={form.direccion ?? ''} onChange={enMayusculas((v) => set('direccion', v))} />
          </Campo>
        </div>

        <div className="md:col-span-3">
          {/* Viene del CRM comercial al ganarse el deal, pero a veces llega
              vacio o el cliente lo aclara despues. Faltaba en el formulario, asi
              que no habia forma de corregirlo desde la ficha. */}
          <Campo label="Viene de otro seguro">
            <Input
              value={form.vieneDeOtroSeguro ?? ''}
              onChange={enMayusculas((v) => set('vieneDeOtroSeguro', v))}
              placeholder="Ej: Sí — BMI"
            />
          </Campo>

          <Campo label="Notas">
            <Input value={form.notas ?? ''} onChange={enMayusculas((v) => set('notas', v))} />
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
        </div>
      )}
    </>
  )
}
