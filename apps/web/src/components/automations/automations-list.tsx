'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Zap, MoreHorizontal } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { api } from '@/lib/api'
import { formatDate } from '@/lib/utils'
import type { Automation } from '@priority-crm/shared'

const TRIGGER_LABELS: Record<string, string> = {
  'deal.stage.changed': 'Deal stage changed',
  'deal.created': 'Deal created',
  'deal.won': 'Deal won',
  'deal.lost': 'Deal lost',
  'contact.created': 'Contact created',
  'message.received': 'Message received',
  'task.overdue': 'Task overdue',
}

export function AutomationsList() {
  const queryClient = useQueryClient()

  const { data: automations = [] } = useQuery<Automation[]>({
    queryKey: ['automations'],
    queryFn: () => api.get('/automations').then((r) => r.data),
  })

  const toggleMutation = useMutation({
    mutationFn: (id: string) => api.put(`/automations/${id}/toggle`, {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['automations'] }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/automations/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['automations'] }),
  })

  if (automations.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 rounded-lg border bg-card py-20 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
          <Zap className="h-7 w-7 text-primary" />
        </div>
        <div>
          <p className="font-medium">No automations yet</p>
          <p className="text-sm text-muted-foreground">
            Create your first automation to save time
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {automations.map((automation) => (
        <Card key={automation.id}>
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10">
                  <Zap className="h-4 w-4 text-primary" />
                </div>
                <CardTitle className="text-base">{automation.name}</CardTitle>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem>Edit</DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-destructive"
                    onClick={() => deleteMutation.mutate(automation.id)}
                  >
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-1.5">
              <Badge variant="outline" className="text-xs">
                {TRIGGER_LABELS[automation.trigger] ?? automation.trigger}
              </Badge>
              <Badge variant="secondary" className="text-xs">
                {automation.actions.length} action{automation.actions.length !== 1 ? 's' : ''}
              </Badge>
            </div>
            {automation.description && (
              <p className="text-xs text-muted-foreground line-clamp-2">{automation.description}</p>
            )}
            <div className="flex items-center justify-between border-t pt-3">
              <span className="text-xs text-muted-foreground">
                Created {formatDate(automation.createdAt)}
              </span>
              <Switch
                checked={automation.isActive}
                onCheckedChange={() => toggleMutation.mutate(automation.id)}
              />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
