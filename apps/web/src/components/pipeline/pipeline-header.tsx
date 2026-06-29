'use client'

import { useState } from 'react'
import { Plus, Search, Car, HeartPulse } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { CreateDealDialog } from './create-deal-dialog'
import { usePipelineStore } from '@/store'
import { cn } from '@/lib/utils'

interface TeamMember {
  id: string
  name: string
}

export type OriginFilter = 'ALL' | 'PRIORITY_HEALTH' | 'PROPIO'
export type InsuranceFilter = 'ALL' | 'SALUD' | 'AUTO'

interface PipelineHeaderProps {
  viewMode: 'mine' | 'all'
  setViewMode: (mode: 'mine' | 'all') => void
  filterUserId: string | null
  setFilterUserId: (id: string | null) => void
  originFilter: OriginFilter
  setOriginFilter: (origin: OriginFilter) => void
  insuranceFilter: InsuranceFilter
  setInsuranceFilter: (f: InsuranceFilter) => void
  users: TeamMember[]
  isAdminOrManager: boolean
  userRole: string
}

export function PipelineHeader({
  viewMode,
  setViewMode,
  filterUserId,
  setFilterUserId,
  originFilter,
  setOriginFilter,
  insuranceFilter,
  setInsuranceFilter,
  users,
  isAdminOrManager,
  userRole,
}: PipelineHeaderProps) {
  const isSuperAdmin = userRole === 'SUPER_ADMIN'

  const [open, setOpen] = useState(false)
  const { setSearchQuery } = usePipelineStore()

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
            {/* Mine / All toggle */}
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

            {/* Origin filter — managers/admin only */}
            {isAdminOrManager && (
              <Select
                value={originFilter}
                onValueChange={(v) => setOriginFilter(v as OriginFilter)}
              >
                <SelectTrigger className="w-44">
                  <SelectValue placeholder="Origen" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todos los orígenes</SelectItem>
                  <SelectItem value="PRIORITY_HEALTH">Priority Health</SelectItem>
                  <SelectItem value="PROPIO">Propios</SelectItem>
                </SelectContent>
              </Select>
            )}

            {/* Insurance type filter */}
            <div className="flex overflow-hidden rounded-lg border border-[#25324b]/15">
              <button
                className={cn(
                  'px-3.5 py-1.5 text-sm font-medium transition-colors',
                  insuranceFilter === 'ALL'
                    ? 'bg-[#25324b] text-[#d3ac76]'
                    : 'text-[#25324b]/60 hover:bg-[#25324b]/5',
                )}
                onClick={() => setInsuranceFilter('ALL')}
              >
                Todos
              </button>
              <button
                className={cn(
                  'flex items-center gap-1 border-l border-[#25324b]/15 px-3.5 py-1.5 text-sm font-medium transition-colors',
                  insuranceFilter === 'SALUD'
                    ? 'bg-[#25324b] text-[#d3ac76]'
                    : 'text-[#25324b]/60 hover:bg-[#25324b]/5',
                )}
                onClick={() => setInsuranceFilter('SALUD')}
              >
                <HeartPulse className="h-3.5 w-3.5" />
                Salud
              </button>
              <button
                className={cn(
                  'flex items-center gap-1 border-l border-[#25324b]/15 px-3.5 py-1.5 text-sm font-medium transition-colors',
                  insuranceFilter === 'AUTO'
                    ? 'bg-[#25324b] text-[#d3ac76]'
                    : 'text-[#25324b]/60 hover:bg-[#25324b]/5',
                )}
                onClick={() => setInsuranceFilter('AUTO')}
              >
                <Car className="h-3.5 w-3.5" />
                Auto
              </button>
            </div>

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

          {/* ── New deal button — SUPER_ADMIN only ─────────────────── */}
          {isSuperAdmin && (
            <Button onClick={() => setOpen(true)} size="sm" className="md:text-sm">
              <Plus className="h-4 w-4 md:mr-2" />
              <span className="hidden md:inline">Nuevo deal</span>
            </Button>
          )}
        </div>
      </div>

      {/* ── Mobile filter strip ──────────────────────────────────────── */}
      <div className="flex items-center gap-2 md:hidden">
        {/* Mine / All toggle */}
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

        {/* Compact origin select */}
        {isAdminOrManager && (
          <Select
            value={originFilter}
            onValueChange={(v) => setOriginFilter(v as OriginFilter)}
          >
            <SelectTrigger className="h-8 flex-1 text-xs">
              <SelectValue placeholder="Origen" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todos</SelectItem>
              <SelectItem value="PRIORITY_HEALTH">Priority Health</SelectItem>
              <SelectItem value="PROPIO">Propios</SelectItem>
            </SelectContent>
          </Select>
        )}

        {/* Compact insurance type select */}
        <Select
          value={insuranceFilter}
          onValueChange={(v) => setInsuranceFilter(v as InsuranceFilter)}
        >
          <SelectTrigger className="h-8 flex-1 text-xs">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todos</SelectItem>
            <SelectItem value="SALUD">Salud</SelectItem>
            <SelectItem value="AUTO">Auto</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <CreateDealDialog open={open} onOpenChange={setOpen} showOriginSelector />
    </div>
  )
}
