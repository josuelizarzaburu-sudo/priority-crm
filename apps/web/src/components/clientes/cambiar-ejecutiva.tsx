'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { X, UserCog } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { api } from '@/lib/api'

const NAVY = '#0C2057'
const GOLD = '#DBAA59'

// Perfiles que atienden clientes. Son los únicos a los que se puede reasignar.
const ROLES_EJECUTIVA = ['OPERACIONES', 'JEFE_OPERACIONES']

interface Usuario {
  id: string
  name: string
  role: string
}

/**
 * Cambio de ejecutiva asignada a un cliente.
 *
 * Nace de un caso real: a veces el cliente se queja del trato recibido y pide
 * que lo atienda otra persona. Por eso el motivo es obligatorio y queda escrito
 * en la bitácora — así después se puede reconstruir por qué se reasignó.
 *
 * El botón solo se muestra a jefe de operaciones y admin; el permiso de verdad
 * lo aplica el servidor, esto es solo para no mostrar lo que no se puede usar.
 */
export function CambiarEjecutiva({
  clienteId,
  ejecutivaActual,
  ejecutivaActualId,
  onCerrar,
}: {
  clienteId: string
  ejecutivaActual: string | null
  ejecutivaActualId: string | null
  onCerrar: () => void
}) {
  const qc = useQueryClient()
  const [ejecutivoId, setEjecutivoId] = useState('')
  const [motivo, setMotivo] = useState('')
  const [error, setError] = useState<string | null>(null)

  const { data: usuarios, isLoading } = useQuery({
    queryKey: ['usuarios-ejecutivas'],
    queryFn: async () => (await api.get('/users')).data as Usuario[],
    select: (us: Usuario[]) =>
      (us ?? []).filter(
        (u) => ROLES_EJECUTIVA.includes(u.role) && u.id !== ejecutivaActualId,
      ),
  })

  const guardar = useMutation({
    mutationFn: async () =>
      (await api.patch(`/clientes/${clienteId}/ejecutiva`, {
        ejecutivoId,
        motivo: motivo.trim(),
      })).data,
    onSuccess: () => {
      // La ficha y la bitácora cambian, y la lista muestra la ejecutiva en columna
      qc.invalidateQueries({ queryKey: ['cliente', clienteId] })
      qc.invalidateQueries({ queryKey: ['clientes'] })
      onCerrar()
    },
    onError: (e: any) =>
      setError(e?.response?.data?.message ?? 'No se pudo cambiar la ejecutiva.'),
  })

  const listo = ejecutivoId !== '' && motivo.trim().length > 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-lg border bg-card p-5 shadow-lg">
        <div className="mb-4 flex items-start justify-between gap-2">
          <h2 className="flex items-center gap-2 text-sm font-bold" style={{ color: NAVY }}>
            <UserCog className="h-4 w-4" /> Cambiar ejecutiva
          </h2>
          <button type="button" onClick={onCerrar} className="text-muted-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="mb-4 text-xs text-muted-foreground">
          Ejecutiva actual:{' '}
          <span className="font-medium" style={{ color: NAVY }}>
            {ejecutivaActual ?? 'sin asignar'}
          </span>
        </p>

        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Nueva ejecutiva *</Label>
            <select
              value={ejecutivoId}
              onChange={(e) => setEjecutivoId(e.target.value)}
              className="h-9 w-full rounded-md border bg-background px-2 text-sm"
            >
              <option value="">
                {isLoading ? 'Cargando…' : 'Selecciona una ejecutiva'}
              </option>
              {(usuarios ?? []).map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
            {!isLoading && (usuarios ?? []).length === 0 && (
              <p className="text-[11px] text-muted-foreground">
                No hay otras ejecutivas disponibles.
              </p>
            )}
          </div>

          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Motivo del cambio *</Label>
            <textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              rows={3}
              placeholder="Ej: el cliente pidió el cambio por inconformidad con la atención."
              className="w-full rounded-md border bg-background p-2 text-sm"
            />
            <p className="text-[11px] text-muted-foreground">
              Queda registrado en la bitácora del cliente y no se puede borrar.
            </p>
          </div>

          {error && (
            <p className="rounded-md bg-red-50 p-2 text-xs text-red-600">{error}</p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" size="sm" onClick={onCerrar}>
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={!listo || guardar.isPending}
              onClick={() => {
                setError(null)
                guardar.mutate()
              }}
              style={{ backgroundColor: GOLD, color: '#fff' }}
            >
              {guardar.isPending ? 'Guardando…' : 'Cambiar ejecutiva'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
