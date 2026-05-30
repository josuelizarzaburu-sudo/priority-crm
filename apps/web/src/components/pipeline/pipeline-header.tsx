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
      <div className="flex items-center justify-between gap-3">
        {/* Title */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#25324b] md:text-3xl">Pipeline</h1>
          <p className="hidden text-sm text-[#25324b]/50 sm:block">
            Gestión de oportunidades de venta
          </p>
        </div>

        <div className="flex items-center gap-2 md:gap-3">
          {/* ── Desktop-only filter controls ────────────────────────── */}
          <div className="hidden items-center gap-3 md:flex">
            {/* Mine / All toggle — only for admins/managers */}
            {isAdminOrManager ? (
              <div className="flex overflow-hidden rounded-lg border border-[#25324b]/15">
                <button
                  className={cn(
                    'px-3.5 py-1.5 text-sm font-medium transition-colors',
                    viewMode === 'all'
                      ? 'bg-[#25324b] text-[#d3ac76]'
                      : 'text-[#25324b]/60 hover:bg-[#25324b]/5',
                  )}
                  onClick={() => setViewMode('all')}
                >
                  Todos
                </button>
                <button
                  className={cn(
                    'border-l border-[#25324b]/15 px-3.5 py-1.5 text-sm font-medium transition-colors',
                    viewMode === 'mine'
                      ? 'bg-[#25324b] text-[#d3ac76]'
                      : 'text-[#25324b]/60 hover:bg-[#25324b]/5',
                  )}
                  onClick={() => setViewMode('mine')}
                >
                  Mis deals
                </button>
              </div>
            ) : (
              <span className="rounded-lg border border-[#25324b]/15 bg-[#25324b] px-3.5 py-1.5 text-sm font-medium text-[#d3ac76]">
                Mis deals
              </span>
            )}

            {/* Vendor filter */}
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
          </div>

          {/* ── New deal button — always visible ───────────────────── */}
          <Button onClick={() => setOpen(true)} size="sm" className="md:text-sm">
            <Plus className="h-4 w-4 md:mr-2" />
            <span className="hidden md:inline">Nuevo deal</span>
          </Button>
        </div>
      </div>

      {/* ── Mobile filter strip ──────────────────────────────────────── */}
      <div className="flex items-center gap-2 md:hidden">
        {/* Mine / All toggle — only for admins/managers */}
        {isAdminOrManager ? (
          <div className="flex overflow-hidden rounded-lg border border-[#25324b]/15 text-xs">
            <button
              className={cn(
                'px-3 py-1.5 font-medium transition-colors',
                viewMode === 'all'
                  ? 'bg-[#25324b] text-[#d3ac76]'
                  : 'text-[#25324b]/60',
              )}
              onClick={() => setViewMode('all')}
            >
              Todos
            </button>
            <button
              className={cn(
                'border-l border-[#25324b]/15 px-3 py-1.5 font-medium transition-colors',
                viewMode === 'mine'
                  ? 'bg-[#25324b] text-[#d3ac76]'
                  : 'text-[#25324b]/60',
              )}
              onClick={() => setViewMode('mine')}
            >
              Mis deals
            </button>
          </div>
        ) : (
          <span className="rounded-lg border border-[#25324b]/15 bg-[#25324b] px-3 py-1.5 text-xs font-medium text-[#d3ac76]">
            Mis deals
          </span>
        )}

        {/* Compact vendor select */}
        {isAdminOrManager && (
          <Select
            value={filterUserId ?? 'all'}
            onValueChange={(v) => setFilterUserId(v === 'all' ? null : v)}
          >
            <SelectTrigger className="h-8 flex-1 text-xs">
              <SelectValue placeholder="Vendedor" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {users.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Create deal dialog */}
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
