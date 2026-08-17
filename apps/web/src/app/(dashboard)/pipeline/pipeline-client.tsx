'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { useQuery } from '@tanstack/react-query'
import { KanbanBoard } from '@/components/pipeline/kanban-board'
import { PipelineHeader, type OriginFilter, type InsuranceFilter, type MesFilter } from '@/components/pipeline/pipeline-header'
import { DealPanel } from '@/components/pipeline/deal-panel'
import { api } from '@/lib/api'

interface TeamMember {
  id: string
  name: string
  email: string
  role: string
}

export function PipelineClient() {
  const { data: session } = useSession()
  const userRole = session?.user?.role?.toUpperCase() ?? ''
  const currentUserId = session?.user?.id ?? ''
  const isAdminOrManager = ['SUPER_ADMIN', 'OWNER', 'MANAGER'].includes(userRole)
  const esJefeEquipo = userRole === 'JEFE_EQUIPO'
  /**
   * Quien puede usar los filtros del encabezado (persona, origen, mes).
   *
   * Al jefe de equipo le sirven —sobre todo el de persona, para ver que tiene
   * cada vendedor suyo— y no le abren nada: la API ya le mando solo los negocios
   * de su equipo, asi que filtrar sobre eso no puede sacar nada de fuera.
   */
  const puedeFiltrar = isAdminOrManager || esJefeEquipo

  // null means "not yet overridden by user" — computed default reacts to session load
  const [viewModeOverride, setViewModeOverride] = useState<'mine' | 'all' | null>(null)
  /**
   * El jefe de equipo arranca en 'all', igual que gerencia.
   *
   * 'all' NO significa "toda la empresa": la API ya le manda solo los negocios de
   * su equipo. Significa "no recortar mas en el navegador".
   *
   * Antes solo se preguntaba por gerencia, asi que el jefe caia en 'mine' y el
   * frontend le volvia a filtrar a sus propios negocios ENCIMA del filtro del
   * backend — por eso veia solo los suyos aunque su equipo estuviera bien
   * armado.
   */
  const viewMode = viewModeOverride ?? (isAdminOrManager || esJefeEquipo ? 'all' : 'mine')

  const [filterUserId, setFilterUserId] = useState<string | null>(null)
  const [originFilter, setOriginFilter] = useState<OriginFilter>('ALL')
  const [insuranceFilter, setInsuranceFilter] = useState<InsuranceFilter>('ALL')
  // Arranca en 'ALL' para no cambiarle el tablero a nadie sin avisar: quien no
  // toque el filtro sigue viendo exactamente lo mismo que antes.
  const [mesFilter, setMesFilter] = useState<MesFilter>('ALL')
  const [selectedDealId, setSelectedDealId] = useState<string | null>(null)

  const { data: miEquipo } = useQuery<{ jefe: TeamMember; miembros: TeamMember[] } | null>({
    queryKey: ['equipos', 'mi-equipo'],
    queryFn: () => api.get('/equipos/mi-equipo').then((r) => r.data),
    enabled: esJefeEquipo,
  })

  const { data: todosLosUsuarios = [] } = useQuery<TeamMember[]>({
    queryKey: ['users'],
    queryFn: () => api.get('/users').then((r) => r.data),
    // El jefe necesita la lista para poder filtrar por sus vendedores.
    enabled: puedeFiltrar,
  })

  /**
   * Estado del equipo del jefe. Sin equipo armado, el pipeline le muestra solo
   * sus propios negocios — que es correcto, pero indistinguible de "mi equipo no
   * ha vendido nada". El aviso convierte ese silencio en algo accionable.
   */
  const { data: estadoEquipo } = useQuery<{
    tieneEquipo: boolean
    nombre: string | null
    miembros: number
  }>({
    queryKey: ['equipos', 'mi-equipo', 'estado'],
    queryFn: () => api.get('/equipos/mi-equipo/estado').then((r) => r.data),
    enabled: userRole === 'JEFE_EQUIPO',
  })

  const avisoEquipo =
    userRole === 'JEFE_EQUIPO' && estadoEquipo
      ? !estadoEquipo.tieneEquipo
        ? 'Todavía no tienes un equipo asignado, así que aquí solo ves tus propios negocios. Pídele a administración que cree tu equipo en Equipos.'
        : estadoEquipo.miembros === 0
          ? `Tu equipo "${estadoEquipo.nombre}" aún no tiene integrantes, así que aquí solo ves tus propios negocios. Pídele a administración que los agregue en Equipos.`
          : null
      : null

  /**
   * A quién puede filtrar en el desplegable de persona.
   *
   * Al jefe se le muestra solo su equipo. No es por seguridad —la API ya le
   * mandó solo sus negocios, así que filtrar por alguien de fuera no sacaría
   * nada— sino para que la lista no ofrezca nombres que siempre darían vacío,
   * lo que parecería un error.
   */
  const users = esJefeEquipo
    ? miEquipo
      ? [miEquipo.jefe, ...miEquipo.miembros]
      : []
    : todosLosUsuarios

  return (
    <div className="flex h-full flex-col gap-4">
      {avisoEquipo && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-900">
          {avisoEquipo}
        </div>
      )}
      <PipelineHeader
        viewMode={viewMode}
        setViewMode={setViewModeOverride}
        filterUserId={filterUserId}
        setFilterUserId={setFilterUserId}
        originFilter={originFilter}
        setOriginFilter={setOriginFilter}
        insuranceFilter={insuranceFilter}
        setInsuranceFilter={setInsuranceFilter}
        mesFilter={mesFilter}
        setMesFilter={setMesFilter}
        users={users}
        isAdminOrManager={puedeFiltrar}
        userRole={userRole}
      />
      <KanbanBoard
        viewMode={viewMode}
        filterUserId={filterUserId}
        originFilter={originFilter}
        insuranceFilter={insuranceFilter}
        mesFilter={mesFilter}
        currentUserId={currentUserId}
        userRole={userRole}
        onSelectDeal={setSelectedDealId}
      />

      <DealPanel
        dealId={selectedDealId}
        onClose={() => setSelectedDealId(null)}
        userRole={userRole}
        users={users}
      />
    </div>
  )
}
