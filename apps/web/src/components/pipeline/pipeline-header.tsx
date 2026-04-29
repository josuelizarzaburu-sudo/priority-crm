'use client'

import { useState } from 'react'
import { Plus, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { usePipelineStore } from '@/store'
import { api } from '@/lib/api'
import { useQueryClient } from '@tanstack/react-query'
import { cn } from '@/lib/utils'

interface TeamMember {
  id: string
  name: string
}

interface PipelineHeaderProps {
  viewMode: 'mine' | 'all'
  setViewMode: (mode: 'mine' | 'all') => void
  filterUserId: string | null
  setFilterUserId: (id: string | null) => void
  users: TeamMember[]
  isAdminOrManager: boolean
}

export function PipelineHeader({
  viewMode,
  setViewMode,
  filterUserId,
  setFilterUserId,
  users,
  isAdminOrManager,
}: PipelineHeaderProps) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [value, setValue] = useState('')
  const [saving, setSaving] = useState(false)
  const { setSearchQuery, stages } = usePipelineStore()
  const queryClient = useQueryClient()

  async function handleCreate() {
    if (!title.trim()) return
    setSaving(true)
    try {
      await api.post('/pipeline/deals', {
        title,
        value: value ? Number(value) : undefined,
        stageId: stages[0]?.id,
      })
      queryClient.invalidateQueries({ queryKey: ['pipeline'] })
      setOpen(false)
      setTitle('')
      setValue('')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Pipeline</h1>
          <p className="text-sm text-muted-foreground">Gestión de oportunidades de venta</p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Mis deals / Todos toggle */}
          <div className="flex overflow-hidden rounded-md border">
            <button
              className={cn(
                'px-3 py-1.5 text-sm transition-colors',
                viewMode === 'all'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted',
              )}
              onClick={() => setViewMode('all')}
            >
              Todos
            </button>
            <button
              className={cn(
                'border-l px-3 py-1.5 text-sm transition-colors',
                viewMode === 'mine'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted',
              )}
              onClick={() => setViewMode('mine')}
            >
              Mis deals
            </button>
          </div>

          {/* Vendor filter dropdown — admin/manager only */}
          {isAdminOrManager && (
            <Select
              value={filterUserId ?? 'all'}
              onValueChange={(v) => setFilterUserId(v === 'all' ? null : v)}
            >
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Todos los vendedores" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los vendedores</SelectItem>
                {users.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar deals..."
              className="w-52 pl-8"
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <Button onClick={() => setOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Nuevo deal
          </Button>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Crear deal</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Título</Label>
              <Input
                placeholder="ej. Empresa ABC - Plan Premium"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Valor (USD)</Label>
              <Input
                type="number"
                placeholder="0"
                value={value}
                onChange={(e) => setValue(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreate} disabled={saving || !title.trim()}>
              Crear
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
