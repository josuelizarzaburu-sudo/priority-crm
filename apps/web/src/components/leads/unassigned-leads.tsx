'use client'

import { useSession } from 'next-auth/react'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { UserCheck, Phone, Mail, Shield, Car, Clock } from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { api } from '@/lib/api'
import { formatDate, getInitials } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'
import type { Deal } from '@priority-crm/shared'

interface Agent {
  id: string
  name: string
  email: string
  role: string
}

interface Equipo {
  id: string
  nombre: string
  jefe: Agent
  miembros: Agent[]
}

const PUEDEN_MOVER_DE_EQUIPO = ['SUPER_ADMIN', 'OWNER', 'MANAGER']

export function UnassignedLeads() {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const { data: session } = useSession()
  const rol = (session?.user as any)?.role ?? ''
  const esJefeEquipo = rol === 'JEFE_EQUIPO'
  const puedeMoverDeEquipo = PUEDEN_MOVER_DE_EQUIPO.includes(rol)

  const { data: deals = [], isLoading } = useQuery<Deal[]>({
    queryKey: ['pipeline', 'unassigned'],
    queryFn: () => api.get('/pipeline/unassigned').then((r) => r.data),
    refetchInterval: 30_000,
  })

  const { data: todosLosUsuarios = [] } = useQuery<Agent[]>({
    queryKey: ['users'],
    queryFn: () => api.get('/users').then((r) => r.data),
  })

  // El jefe necesita saber quienes son sus miembros para armar el desplegable.
  // Este endpoint devuelve solo SU equipo, sin darle el listado completo.
  const { data: miEquipo } = useQuery<Equipo | null>({
    queryKey: ['equipos', 'mi-equipo'],
    queryFn: () => api.get('/equipos/mi-equipo').then((r) => r.data),
    enabled: esJefeEquipo,
  })

  // Equipos existentes, para que administracion pueda mover un lead de lote.
  const { data: equipos = [] } = useQuery<Equipo[]>({
    queryKey: ['equipos'],
    queryFn: () => api.get('/equipos').then((r) => r.data),
    enabled: puedeMoverDeEquipo,
  })

  // A quien se le puede asignar un lead.
  //
  // El jefe reparte solo dentro de su equipo, y se incluye a si mismo porque
  // tambien vende y muchas veces se queda el lead. Administracion sigue viendo a
  // todos los vendedores, como siempre.
  const agents: Agent[] = esJefeEquipo
    ? miEquipo
      ? [miEquipo.jefe, ...miEquipo.miembros]
      : []
    // Se incluye JEFE_EQUIPO: tambien vende, asi que gerencia debe poder
    // asignarle un lead directamente.
    : todosLosUsuarios.filter((u) => ['SALES_REP', 'JEFE_EQUIPO'].includes(u.role))

  const moverDeEquipo = useMutation({
    mutationFn: ({ dealId, equipoId }: { dealId: string; equipoId: string | null }) =>
      api.patch(`/pipeline/deals/${dealId}/equipo`, { equipoId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipeline', 'unassigned'] })
      toast({ title: 'Lead movido', description: 'Cambió de equipo.' })
    },
    onError: () => {
      toast({ title: 'Error', description: 'No se pudo mover el lead.', variant: 'destructive' })
    },
  })

  const assignMutation = useMutation({
    mutationFn: ({ dealId, agentId }: { dealId: string; agentId: string }) =>
      api.put(`/pipeline/deals/${dealId}/assign`, { agentId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipeline', 'unassigned'] })
      queryClient.invalidateQueries({ queryKey: ['pipeline'] })
      toast({ title: 'Lead asignado', description: 'El agente fue notificado.' })
    },
    onError: () => {
      toast({ title: 'Error', description: 'No se pudo asignar el lead.', variant: 'destructive' })
    },
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        Cargando leads...
      </div>
    )
  }

  if (deals.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 rounded-xl border bg-card py-20 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-green-100">
          <UserCheck className="h-7 w-7 text-green-600" />
        </div>
        <div>
          <p className="font-medium">Sin leads pendientes</p>
          <p className="text-sm text-muted-foreground">
            Todos los leads están asignados a un agente.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {deals.map((deal) => (
        <LeadCard
          key={deal.id}
          deal={deal}
          agents={agents}
          onAssign={(agentId) => assignMutation.mutate({ dealId: deal.id, agentId })}
          isAssigning={assignMutation.isPending}
          equipos={puedeMoverDeEquipo ? equipos : []}
          onMoverEquipo={(equipoId) => moverDeEquipo.mutate({ dealId: deal.id, equipoId })}
        />
      ))}
    </div>
  )
}

const SOURCE_LABEL: Record<string, string> = {
  WEB: 'Formulario web',
  WHATSAPP: 'WhatsApp',
  CALL: 'Llamada',
}

function LeadCard({
  deal,
  agents,
  onAssign,
  isAssigning,
  equipos,
  onMoverEquipo,
}: {
  deal: Deal
  agents: Agent[]
  onAssign: (agentId: string) => void
  isAssigning: boolean
  /** Vacío para quien no puede mover leads entre equipos. */
  equipos: Equipo[]
  onMoverEquipo: (equipoId: string | null) => void
}) {
  const [selectedAgent, setSelectedAgent] = useState('')
  const cf = (deal as any).customFields as Record<string, string> | null
  const insuranceType = cf?.insuranceType
  const source = cf?.source

  const contactName = deal.contact
    ? `${deal.contact.firstName} ${deal.contact.lastName ?? ''}`.trim()
    : deal.title

  return (
    <Card className="overflow-hidden transition-shadow hover:shadow-md">
      {/* ── Desktop layout (horizontal) ─────────────────────────────── */}
      <CardContent className="hidden items-center gap-4 p-4 md:flex">
        <Avatar className="h-10 w-10 shrink-0">
          <AvatarFallback>{getInitials(contactName)}</AvatarFallback>
        </Avatar>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium">{contactName}</span>
            {insuranceType && (
              <Badge variant="outline" className="gap-1 text-xs">
                {insuranceType === 'SALUD' ? <Shield className="h-3 w-3" /> : <Car className="h-3 w-3" />}
                Seguro de {insuranceType === 'SALUD' ? 'Salud' : 'Auto'}
              </Badge>
            )}
            {source && (
              <Badge variant="secondary" className="text-xs">
                {SOURCE_LABEL[source] ?? source}
              </Badge>
            )}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            {(deal.contact as any)?.phone && (
              <span className="flex items-center gap-1">
                <Phone className="h-3 w-3" />
                {(deal.contact as any).phone}
              </span>
            )}
            {(deal.contact as any)?.email && (
              <span className="flex items-center gap-1">
                <Mail className="h-3 w-3" />
                {(deal.contact as any).email}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatDate(deal.createdAt)}
            </span>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {/* Solo para administracion: de que equipo es este lead y a cual
              moverlo. Un jefe no ve esto porque no mueve leads entre equipos. */}
          {equipos.length > 0 && (
            <Select
              value={(deal as any).equipoId ?? 'ninguno'}
              onValueChange={(v) => onMoverEquipo(v === 'ninguno' ? null : v)}
            >
              <SelectTrigger className="h-8 w-40 text-xs">
                <SelectValue placeholder="Equipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ninguno">Sin equipo</SelectItem>
                {equipos.map((eq) => (
                  <SelectItem key={eq.id} value={eq.id}>{eq.nombre}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Select value={selectedAgent} onValueChange={setSelectedAgent}>
            <SelectTrigger className="h-8 w-44 text-xs">
              <SelectValue placeholder="Seleccionar agente" />
            </SelectTrigger>
            <SelectContent>
              {agents.length === 0 ? (
                <SelectItem value="none" disabled>No hay agentes</SelectItem>
              ) : (
                agents.map((a) => (
                  <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
          <Button
            size="sm"
            disabled={!selectedAgent || isAssigning}
            onClick={() => onAssign(selectedAgent)}
            className="h-8 px-3 text-xs"
          >
            <UserCheck className="mr-1.5 h-3.5 w-3.5" />
            Asignar
          </Button>
        </div>
      </CardContent>

      {/* ── Mobile layout (vertical) ─────────────────────────────────── */}
      <CardContent className="flex flex-col gap-3 p-4 md:hidden">
        {/* Top: avatar + name */}
        <div className="flex items-center gap-3">
          <Avatar className="h-11 w-11 shrink-0">
            <AvatarFallback className="text-sm font-semibold">
              {getInitials(contactName)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-semibold">{contactName}</p>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {insuranceType && (
                <Badge variant="outline" className="gap-1 text-[11px]">
                  {insuranceType === 'SALUD'
                    ? <Shield className="h-3 w-3" />
                    : <Car className="h-3 w-3" />}
                  {insuranceType === 'SALUD' ? 'Salud' : 'Auto'}
                </Badge>
              )}
              {source && (
                <Badge variant="secondary" className="text-[11px]">
                  {SOURCE_LABEL[source] ?? source}
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* Middle: contact details */}
        <div className="space-y-1.5 rounded-lg bg-muted/40 px-3 py-2.5">
          {(deal.contact as any)?.phone && (
            <div className="flex items-center gap-2 text-sm">
              <Phone className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span>{(deal.contact as any).phone}</span>
            </div>
          )}
          {(deal.contact as any)?.email && (
            <div className="flex items-center gap-2 text-sm">
              <Mail className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="truncate">{(deal.contact as any).email}</span>
            </div>
          )}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-3.5 w-3.5 shrink-0" />
            <span>{formatDate(deal.createdAt)}</span>
          </div>
        </div>

        {/* Bottom: full-width agent selector + assign button */}
        <div className="flex gap-2">
          <Select value={selectedAgent} onValueChange={setSelectedAgent}>
            <SelectTrigger className="h-10 flex-1 text-sm">
              <SelectValue placeholder="Seleccionar agente" />
            </SelectTrigger>
            <SelectContent>
              {agents.length === 0 ? (
                <SelectItem value="none" disabled>No hay agentes disponibles</SelectItem>
              ) : (
                agents.map((a) => (
                  <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
          <Button
            disabled={!selectedAgent || isAssigning}
            onClick={() => onAssign(selectedAgent)}
            className="h-10 shrink-0 px-4"
          >
            <UserCheck className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
