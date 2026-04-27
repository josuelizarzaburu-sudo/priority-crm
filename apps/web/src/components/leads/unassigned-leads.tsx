'use client'

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

export function UnassignedLeads() {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const { data: deals = [], isLoading } = useQuery<Deal[]>({
    queryKey: ['pipeline', 'unassigned'],
    queryFn: () => api.get('/pipeline/unassigned').then((r) => r.data),
    refetchInterval: 30_000,
  })

  const { data: agents = [] } = useQuery<Agent[]>({
    queryKey: ['users'],
    queryFn: () => api.get('/users').then((r) => r.data),
    select: (users) => users.filter((u: Agent) => u.role === 'MEMBER'),
  })

  const assignMutation = useMutation({
    mutationFn: ({ dealId, agentId }: { dealId: string; agentId: string }) =>
      api.put(`/pipeline/deals/${dealId}/assign`, { agentId }),
    onSuccess: (_, { dealId }) => {
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
      <div className="flex flex-col items-center justify-center gap-4 rounded-lg border bg-card py-20 text-center">
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
        />
      ))}
    </div>
  )
}

function LeadCard({
  deal,
  agents,
  onAssign,
  isAssigning,
}: {
  deal: Deal
  agents: Agent[]
  onAssign: (agentId: string) => void
  isAssigning: boolean
}) {
  const [selectedAgent, setSelectedAgent] = useState('')
  const cf = deal.customFields as Record<string, string> | null
  const insuranceType = cf?.insuranceType
  const source = cf?.source

  const SOURCE_LABEL: Record<string, string> = {
    WEB: 'Formulario web',
    WHATSAPP: 'WhatsApp',
    CALL: 'Llamada',
  }

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="flex items-center gap-4 p-4">
        {/* Avatar */}
        <Avatar className="h-10 w-10 shrink-0">
          <AvatarFallback>
            {deal.contact ? getInitials(`${deal.contact.firstName} ${deal.contact.lastName ?? ''}`) : '?'}
          </AvatarFallback>
        </Avatar>

        {/* Lead info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm">
              {deal.contact
                ? `${deal.contact.firstName} ${deal.contact.lastName ?? ''}`.trim()
                : deal.title}
            </span>
            {insuranceType && (
              <Badge variant="outline" className="text-xs gap-1">
                {insuranceType === 'SALUD' ? (
                  <Shield className="h-3 w-3" />
                ) : (
                  <Car className="h-3 w-3" />
                )}
                Seguro de {insuranceType === 'SALUD' ? 'Salud' : 'Auto'}
              </Badge>
            )}
            {source && (
              <Badge variant="secondary" className="text-xs">
                {SOURCE_LABEL[source] ?? source}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
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

        {/* Assign control */}
        <div className="flex items-center gap-2 shrink-0">
          <Select value={selectedAgent} onValueChange={setSelectedAgent}>
            <SelectTrigger className="w-44 h-8 text-xs">
              <SelectValue placeholder="Seleccionar agente" />
            </SelectTrigger>
            <SelectContent>
              {agents.length === 0 ? (
                <SelectItem value="none" disabled>
                  No hay agentes disponibles
                </SelectItem>
              ) : (
                agents.map((agent) => (
                  <SelectItem key={agent.id} value={agent.id}>
                    {agent.name}
                  </SelectItem>
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
    </Card>
  )
}
