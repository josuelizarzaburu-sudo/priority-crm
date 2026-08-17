'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Users, Plus, X } from 'lucide-react'

const NAVY = '#0B2545'

interface Persona {
  id: string
  name: string
  email: string
  role: string
  equipoId?: string | null
}

interface Equipo {
  id: string
  nombre: string
  activo: boolean
  jefe: Persona
  miembros: Persona[]
}

/**
 * Administracion de equipos comerciales. Solo super admin y dueño.
 *
 * Aqui se define quien lidera cada equipo y quien lo integra. Los jefes NO se
 * auto-asignan gente: reparten leads dentro del equipo que se les arme desde
 * esta pantalla.
 */
export function EquiposPage() {
  const qc = useQueryClient()
  const [nombre, setNombre] = useState('')
  const [jefeId, setJefeId] = useState('')
  const [error, setError] = useState<string | null>(null)

  const { data: equipos, isLoading } = useQuery({
    queryKey: ['equipos'],
    queryFn: () => api.get('/equipos').then((r) => r.data as Equipo[]),
  })

  const { data: usuarios } = useQuery({
    queryKey: ['users'],
    queryFn: () => api.get('/users').then((r) => r.data as Persona[]),
  })

  const invalidar = () => {
    qc.invalidateQueries({ queryKey: ['equipos'] })
    qc.invalidateQueries({ queryKey: ['users'] })
  }

  const mostrarError = (e: any) =>
    setError(e?.response?.data?.message ?? 'No se pudo completar la acción')

  const crear = useMutation({
    mutationFn: () => api.post('/equipos', { nombre, jefeId }),
    onSuccess: () => {
      setNombre('')
      setJefeId('')
      setError(null)
      invalidar()
    },
    onError: mostrarError,
  })

  const moverMiembro = useMutation({
    mutationFn: ({ userId, equipoId }: { userId: string; equipoId: string | null }) =>
      api.patch(`/equipos/miembros/${userId}`, { equipoId }),
    onSuccess: () => {
      setError(null)
      invalidar()
    },
    onError: mostrarError,
  })

  const activos = (equipos ?? []).filter((e) => e.activo)

  // Candidatos a jefe: cualquiera con rol comercial. El rol JEFE_EQUIPO se asigna
  // aparte, en la pantalla de Usuarios; aqui solo se elige a la persona.
  const candidatosJefe = (usuarios ?? []).filter((u) =>
    ['JEFE_EQUIPO', 'SALES_REP', 'MANAGER'].includes(u.role),
  )

  // Quien puede integrar un equipo: cualquier perfil comercial que no este ya en
  // otro equipo ni sea jefe de uno.
  //
  // No se limita a SALES_REP a proposito. El super admin y el dueño tambien
  // venden, y estar en un equipo les permite recibir leads del reparto y tener
  // seguimiento de un jefe. No les recorta nada: el filtro por equipo solo se
  // aplica al rol JEFE_EQUIPO, asi que siguen viendo toda la empresa.
  const ROLES_QUE_VENDEN = ['SALES_REP', 'SUPER_ADMIN', 'OWNER', 'MANAGER']
  const idsJefes = new Set(activos.map((e) => e.jefe.id))
  const sinEquipo = (usuarios ?? []).filter(
    (u) => ROLES_QUE_VENDEN.includes(u.role) && !u.equipoId && !idsJefes.has(u.id),
  )

  // Etiqueta corta del rol, para distinguir en el desplegable a un vendedor de
  // alguien de gerencia que se suma al equipo.
  const etiquetaRol: Record<string, string> = {
    SUPER_ADMIN: 'admin',
    OWNER: 'dueño',
    MANAGER: 'gerencia',
    SALES_REP: 'vendedor',
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4">
      <div>
        <h1 className="text-xl font-bold" style={{ color: NAVY }}>
          Equipos comerciales
        </h1>
        <p className="text-xs text-muted-foreground">
          Cada jefe ve y reparte únicamente los leads de su equipo. Los leads
          propios de un vendedor no se pueden reasignar.
        </p>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Crear equipo */}
      <div className="space-y-2 rounded-lg border p-3">
        <p className="text-sm font-semibold" style={{ color: NAVY }}>
          Nuevo equipo
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            placeholder="Nombre del equipo"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            className="max-w-[220px]"
          />
          <Select value={jefeId} onValueChange={setJefeId}>
            <SelectTrigger className="max-w-[240px]">
              <SelectValue placeholder="Jefe del equipo" />
            </SelectTrigger>
            <SelectContent>
              {candidatosJefe.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            onClick={() => crear.mutate()}
            disabled={!nombre.trim() || !jefeId || crear.isPending}
            style={{ backgroundColor: NAVY }}
          >
            <Plus className="mr-1 h-4 w-4" />
            Crear
          </Button>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Recuerda darle el rol <strong>Jefe de equipo</strong> en Usuarios, o no
          verá el tablero de su equipo.
        </p>
      </div>

      {isLoading ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Cargando…</p>
      ) : activos.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          Todavía no hay equipos creados.
        </p>
      ) : (
        <div className="space-y-4">
          {activos.map((eq) => (
            <section key={eq.id} className="space-y-2 rounded-lg border p-3">
              <div className="flex items-baseline justify-between gap-2 border-b pb-1.5">
                <div>
                  <h2 className="text-sm font-bold" style={{ color: NAVY }}>
                    {eq.nombre}
                  </h2>
                  <p className="text-[11px] text-muted-foreground">
                    Jefe: {eq.jefe.name}
                    {eq.jefe.role !== 'JEFE_EQUIPO' && (
                      <span className="ml-1 text-amber-600">
                        · le falta el rol Jefe de equipo
                      </span>
                    )}
                  </p>
                </div>
                <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                  <Users className="h-3.5 w-3.5" />
                  {eq.miembros.length}
                </span>
              </div>

              {eq.miembros.length === 0 ? (
                // Un equipo vacío no es un detalle estético: su jefe solo ve sus
                // propios negocios y parece que el sistema está roto.
                <p className="rounded-md border border-amber-200 bg-amber-50 px-2.5 py-2 text-xs text-amber-900">
                  Sin integrantes. Mientras el equipo esté vacío, {eq.jefe.name} solo
                  verá sus propios negocios y contactos en el CRM.
                </p>
              ) : (
                <ul className="space-y-1">
                  {eq.miembros.map((m) => (
                    <li
                      key={m.id}
                      className="flex items-center justify-between rounded-md border px-2.5 py-1.5 text-sm"
                    >
                      <span>
                        {m.name}
                        {m.role !== 'SALES_REP' && (
                          <span className="ml-1.5 text-[11px] text-muted-foreground">
                            {etiquetaRol[m.role] ?? m.role}
                          </span>
                        )}
                      </span>
                      <button
                        type="button"
                        onClick={() => moverMiembro.mutate({ userId: m.id, equipoId: null })}
                        disabled={moverMiembro.isPending}
                        className="text-muted-foreground transition-colors hover:text-red-600"
                        title="Sacar del equipo"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {sinEquipo.length > 0 && (
                <Select
                  value=""
                  onValueChange={(userId) => moverMiembro.mutate({ userId, equipoId: eq.id })}
                >
                  <SelectTrigger className="max-w-[260px]">
                    <SelectValue placeholder="Agregar vendedor…" />
                  </SelectTrigger>
                  <SelectContent>
                    {sinEquipo.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.name}
                        {u.role !== 'SALES_REP' && ` · ${etiquetaRol[u.role] ?? u.role}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
