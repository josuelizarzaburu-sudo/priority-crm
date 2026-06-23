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
  userRole: string
}

type ProfileType = 'A' | 'B' | 'C' | 'D'

const PROFILES: Record<ProfileType, { label: string; className: string }> = {
  A: { label: 'Deportista con seguro',   className: 'bg-green-100 text-green-700 border-green-200' },
  B: { label: 'Con seguro, sin deporte', className: 'bg-orange-100 text-orange-700 border-orange-200' },
  C: { label: 'Deportista sin seguro',   className: 'bg-blue-100 text-blue-700 border-blue-200' },
  D: { label: 'Sin seguro, sin deporte', className: 'bg-violet-100 text-violet-700 border-violet-200' },
}

function computeProfile(sport: boolean, insured: boolean): ProfileType {
  if (sport && insured) return 'A'
  if (sport && !insured) return 'B'
  if (!sport && insured) return 'C'
  return 'D'
}

export function PipelineHeader({
  viewMode,
  setViewMode,
  filterUserId,
  setFilterUserId,
  users,
  isAdminOrManager,
  userRole,
}: PipelineHeaderProps) {
  const isSuperAdmin = userRole === 'SUPER_ADMIN'

  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  // Form fields
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName]   = useState('')
  const [phone, setPhone]         = useState('')
  const [email, setEmail]         = useState('')
  const [doSport, setDoSport]     = useState<boolean | null>(null)
  const [hasInsurance, setHasInsurance] = useState<boolean | null>(null)

  const { setSearchQuery, stages } = usePipelineStore()
  const queryClient = useQueryClient()

  const profile =
    doSport !== null && hasInsurance !== null
      ? computeProfile(doSport, hasInsurance)
      : null

  function resetForm() {
    setFirstName('')
    setLastName('')
    setPhone('')
    setEmail('')
    setDoSport(null)
    setHasInsurance(null)
  }

  async function handleCreate() {
    if (!firstName.trim() || !lastName.trim() || !phone.trim()) return
    if (doSport === null || hasInsurance === null) return
    setSaving(true)
    try {
      const profileType = computeProfile(doSport, hasInsurance)

      const contact = await api
        .post('/contacts', {
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          phone: phone.trim(),
          ...(email.trim() ? { email: email.trim() } : {}),
          status: 'LEAD',
        })
        .then((r) => r.data)

      await api.post('/pipeline/deals', {
        title: `${firstName.trim()} ${lastName.trim()}`,
        stageId: stages[0]?.id,
        contactId: contact.id,
        customFields: {
          profileType,
          sport: doSport,
          insured: hasInsurance,
          source: 'MANUAL',
          leadCreatedAt: new Date().toISOString(),
        },
      })

      queryClient.invalidateQueries({ queryKey: ['pipeline'] })
      setOpen(false)
      resetForm()
    } finally {
      setSaving(false)
    }
  }

  const canSubmit =
    firstName.trim() &&
    lastName.trim() &&
    phone.trim() &&
    doSport !== null &&
    hasInsurance !== null

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
      </div>

      {/* ── Create deal dialog ─────────────────────────────────────────── */}
      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm() }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nuevo deal</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Name row */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Nombre <span className="text-red-500">*</span></Label>
                <Input
                  placeholder="Juan"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Apellido <span className="text-red-500">*</span></Label>
                <Input
                  placeholder="Pérez"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                />
              </div>
            </div>

            {/* Contact row */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Teléfono <span className="text-red-500">*</span></Label>
                <Input
                  placeholder="+593 99 000 0000"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Correo</Label>
                <Input
                  type="email"
                  placeholder="juan@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            {/* Survey */}
            <div className="rounded-xl border border-[#25324b]/10 bg-[#f8f9fb] p-4 space-y-4">
              {/* Q1 */}
              <div className="space-y-2">
                <p className="text-sm font-medium text-[#25324b]">
                  ¿El cliente hace deporte o actividad física?
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setDoSport(true)}
                    className={cn(
                      'flex-1 rounded-lg border py-2 text-sm font-medium transition-all',
                      doSport === true
                        ? 'border-green-400 bg-green-50 text-green-700'
                        : 'border-[#25324b]/15 bg-white text-[#25324b]/70 hover:border-green-300',
                    )}
                  >
                    ✅ Sí
                  </button>
                  <button
                    type="button"
                    onClick={() => setDoSport(false)}
                    className={cn(
                      'flex-1 rounded-lg border py-2 text-sm font-medium transition-all',
                      doSport === false
                        ? 'border-red-300 bg-red-50 text-red-700'
                        : 'border-[#25324b]/15 bg-white text-[#25324b]/70 hover:border-red-200',
                    )}
                  >
                    ❌ No
                  </button>
                </div>
              </div>

              {/* Q2 */}
              <div className="space-y-2">
                <p className="text-sm font-medium text-[#25324b]">
                  ¿El cliente tiene seguro de salud actualmente?
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setHasInsurance(true)}
                    className={cn(
                      'flex-1 rounded-lg border py-2 text-sm font-medium transition-all',
                      hasInsurance === true
                        ? 'border-green-400 bg-green-50 text-green-700'
                        : 'border-[#25324b]/15 bg-white text-[#25324b]/70 hover:border-green-300',
                    )}
                  >
                    ✅ Sí
                  </button>
                  <button
                    type="button"
                    onClick={() => setHasInsurance(false)}
                    className={cn(
                      'flex-1 rounded-lg border py-2 text-sm font-medium transition-all',
                      hasInsurance === false
                        ? 'border-red-300 bg-red-50 text-red-700'
                        : 'border-[#25324b]/15 bg-white text-[#25324b]/70 hover:border-red-200',
                    )}
                  >
                    ❌ No
                  </button>
                </div>
              </div>

              {/* Computed profile badge */}
              {profile && (
                <div className={cn(
                  'flex items-center gap-2 rounded-lg border px-3 py-2',
                  PROFILES[profile].className,
                )}>
                  <span className="text-xs font-semibold uppercase tracking-wide">
                    Perfil {profile}
                  </span>
                  <span className="text-xs">—</span>
                  <span className="text-xs font-medium">{PROFILES[profile].label}</span>
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setOpen(false); resetForm() }}>
              Cancelar
            </Button>
            <Button onClick={handleCreate} disabled={saving || !canSubmit}>
              {saving ? 'Creando...' : 'Crear deal'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
