'use client'

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
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
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'

type ProfileType = 'A' | 'B' | 'C' | 'D'
type LeadOrigin = 'PRIORITY_HEALTH' | 'PROPIO'

const PROFILES: Record<ProfileType, { label: string; className: string }> = {
  A: { label: 'Deportista con seguro',   className: 'bg-green-100 text-green-700 border-green-200' },
  B: { label: 'Con seguro, sin deporte', className: 'bg-orange-100 text-orange-700 border-orange-200' },
  C: { label: 'Deportista sin seguro',   className: 'bg-blue-100 text-blue-700 border-blue-200' },
  D: { label: 'Sin seguro, sin deporte', className: 'bg-violet-100 text-violet-700 border-violet-200' },
}

function computeProfile(sport: boolean, insured: boolean): ProfileType {
  if (sport && insured) return 'A'
  if (!sport && insured) return 'B'
  if (sport && !insured) return 'C'
  return 'D'
}

interface CreateDealDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Only SUPER_ADMIN gets to pick the lead origin — sales reps always create 'PROPIO' deals. */
  showOriginSelector?: boolean
}

export function CreateDealDialog({ open, onOpenChange, showOriginSelector = false }: CreateDealDialogProps) {
  const [saving, setSaving] = useState(false)

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName]   = useState('')
  const [phone, setPhone]         = useState('')
  const [email, setEmail]         = useState('')
  const [doSport, setDoSport]     = useState<boolean | null>(null)
  const [hasInsurance, setHasInsurance] = useState<boolean | null>(null)
  const [leadOrigin, setLeadOrigin] = useState<LeadOrigin>('PRIORITY_HEALTH')

  const queryClient = useQueryClient()

  const { data: stages = [] } = useQuery<{ id: string; position: number }[]>({
    queryKey: ['pipeline', 'stages'],
    queryFn: () => api.get('/pipeline/stages').then((r) => r.data),
  })
  const leadStage = [...stages].sort((a, b) => a.position - b.position)[0]

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
    setLeadOrigin('PRIORITY_HEALTH')
  }

  async function handleCreate() {
    if (!firstName.trim() || !lastName.trim() || !phone.trim()) return
    if (doSport === null || hasInsurance === null) return
    if (!leadStage) return
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
        stageId: leadStage.id,
        contactId: contact.id,
        customFields: {
          profileType,
          sport: doSport,
          insured: hasInsurance,
          source: 'MANUAL',
          ...(showOriginSelector ? { leadOrigin } : {}),
          leadCreatedAt: new Date().toISOString(),
        },
      })

      queryClient.invalidateQueries({ queryKey: ['pipeline'] })
      onOpenChange(false)
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
    hasInsurance !== null &&
    !!leadStage

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) resetForm() }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nuevo deal</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {showOriginSelector && (
            <div className="space-y-1.5">
              <Label>Origen del lead</Label>
              <Select value={leadOrigin} onValueChange={(v) => setLeadOrigin(v as LeadOrigin)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PRIORITY_HEALTH">Priority Health</SelectItem>
                  <SelectItem value="PROPIO">Propio</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

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
          <Button variant="outline" onClick={() => { onOpenChange(false); resetForm() }}>
            Cancelar
          </Button>
          <Button onClick={handleCreate} disabled={saving || !canSubmit}>
            {saving ? 'Creando...' : 'Crear deal'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
