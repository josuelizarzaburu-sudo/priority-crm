'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  Phone,
  MessageSquare,
  Mail,
  FileText,
  Clock,
  DollarSign,
  UserPlus,
  Plus,
  Building2,
  User,
} from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import { api } from '@/lib/api'
import { getInitials } from '@/lib/utils'

// ─── Types ───────────────────────────────────────────────────────────────────

interface ContactDetail {
  id: string
  firstName: string
  lastName?: string
  email?: string
  phone?: string
  company?: string
  position?: string
  status: string
  customFields?: Record<string, unknown>
  assignedTo?: { id: string; name: string; email: string }
  deals?: Array<{ id: string; title: string; value?: number; status: string; stage?: { name: string } }>
}

interface TimelineActivity {
  id: string
  type: string
  description: string
  createdAt: string
  metadata?: Record<string, unknown>
  user?: { id: string; name: string }
}

// ─── Constants ───────────────────────────────────────────────────────────────

const LEAD_STATUS_OPTIONS = [
  { value: 'SIN_GESTION', label: 'Sin gestión' },
  { value: 'CONTACTADO', label: 'Contactado' },
  { value: 'EN_PROCESO', label: 'En proceso' },
  { value: 'CALIFICADO', label: 'Calificado' },
  { value: 'NO_CALIFICADO', label: 'No calificado' },
]

const INTERACTION_TYPES = [
  { value: 'CALL', label: 'Llamé', icon: Phone, color: 'text-blue-500' },
  { value: 'WHATSAPP', label: 'WhatsApp', icon: MessageSquare, color: 'text-green-500' },
  { value: 'EMAIL', label: 'Email', icon: Mail, color: 'text-purple-500' },
  { value: 'NOTE', label: 'Nota interna', icon: FileText, color: 'text-gray-500' },
] as const

const CALL_RESULTS = [
  { value: 'answered', label: 'Contestó' },
  { value: 'no_answer', label: 'No contestó' },
  { value: 'voicemail', label: 'Buzón de voz' },
]

const TIMELINE_CONFIG: Record<string, { icon: React.ElementType; iconColor: string; bgColor: string }> = {
  CALL: { icon: Phone, iconColor: 'text-blue-500', bgColor: 'bg-blue-50' },
  MESSAGE_SENT: { icon: MessageSquare, iconColor: 'text-green-500', bgColor: 'bg-green-50' },
  EMAIL: { icon: Mail, iconColor: 'text-purple-500', bgColor: 'bg-purple-50' },
  NOTE: { icon: FileText, iconColor: 'text-gray-500', bgColor: 'bg-gray-100' },
  STAGE_CHANGE: { icon: Clock, iconColor: 'text-yellow-600', bgColor: 'bg-yellow-50' },
  DEAL_CREATED: { icon: DollarSign, iconColor: 'text-emerald-500', bgColor: 'bg-emerald-50' },
  CONTACT_CREATED: { icon: UserPlus, iconColor: 'text-indigo-500', bgColor: 'bg-indigo-50' },
}

const DEFAULT_CONFIG = { icon: FileText, iconColor: 'text-gray-400', bgColor: 'bg-gray-100' }

// ─── Component ───────────────────────────────────────────────────────────────

export function ContactDetail({ contactId }: { contactId: string }) {
  const router = useRouter()
  const { toast } = useToast()
  const qc = useQueryClient()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [interactionType, setInteractionType] = useState<'CALL' | 'WHATSAPP' | 'EMAIL' | 'NOTE'>('CALL')
  const [callResult, setCallResult] = useState('answered')
  const [note, setNote] = useState('')

  // ── Queries ──
  const { data: contact, isLoading: loadingContact } = useQuery<ContactDetail>({
    queryKey: ['contacts', contactId],
    queryFn: () => api.get(`/contacts/${contactId}`).then((r) => r.data),
  })

  const { data: timeline, isLoading: loadingTimeline } = useQuery<{ activities: TimelineActivity[] }>({
    queryKey: ['contacts', contactId, 'timeline'],
    queryFn: () => api.get(`/contacts/${contactId}/timeline`).then((r) => r.data),
  })

  function invalidate() {
    qc.invalidateQueries({ queryKey: ['contacts', contactId] })
    qc.invalidateQueries({ queryKey: ['contacts', contactId, 'timeline'] })
  }

  // ── Mutations ──
  const updateLeadStatus = useMutation({
    mutationFn: (leadStatus: string) =>
      api
        .put(`/contacts/${contactId}`, {
          customFields: { ...(contact?.customFields ?? {}), leadStatus },
        })
        .then((r) => r.data),
    onSuccess: invalidate,
  })

  const logInteraction = useMutation({
    mutationFn: (data: { type: string; callResult?: string; description?: string }) =>
      api.post(`/contacts/${contactId}/interaction`, data).then((r) => r.data),
    onSuccess: () => {
      invalidate()
      setDialogOpen(false)
      setNote('')
      setCallResult('answered')
      toast({ title: 'Interacción registrada' })
    },
  })

  function handleSaveInteraction() {
    logInteraction.mutate({
      type: interactionType,
      callResult: interactionType === 'CALL' ? callResult : undefined,
      description: note || undefined,
    })
  }

  // ── Derived ──
  const leadStatus = (contact?.customFields?.leadStatus as string) ?? 'SIN_GESTION'
  const fullName = contact
    ? `${contact.firstName}${contact.lastName ? ` ${contact.lastName}` : ''}`
    : ''
  const activities = timeline?.activities ?? []

  if (loadingContact) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <div className="h-8 w-48 animate-pulse rounded bg-muted" />
        <div className="h-32 animate-pulse rounded-lg bg-muted" />
        <div className="h-64 animate-pulse rounded-lg bg-muted" />
      </div>
    )
  }

  if (!contact) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 p-12 text-muted-foreground">
        <p>Contacto no encontrado.</p>
        <Button variant="ghost" onClick={() => router.push('/contacts')}>
          Volver a contactos
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Back nav */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => router.push('/contacts')}>
          <ArrowLeft className="h-4 w-4" /> Contactos
        </Button>
      </div>

      {/* Header card */}
      <div className="flex flex-col gap-4 rounded-xl border bg-card p-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <Avatar className="h-14 w-14">
            <AvatarFallback className="text-base font-semibold">{getInitials(fullName)}</AvatarFallback>
          </Avatar>
          <div className="space-y-1">
            <h1 className="text-xl font-semibold">{fullName}</h1>
            {(contact.company || contact.position) && (
              <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Building2 className="h-3.5 w-3.5" />
                {[contact.position, contact.company].filter(Boolean).join(' · ')}
              </p>
            )}
            <div className="flex flex-wrap items-center gap-3 pt-0.5 text-sm text-muted-foreground">
              {contact.email && (
                <span className="flex items-center gap-1">
                  <Mail className="h-3.5 w-3.5" /> {contact.email}
                </span>
              )}
              {contact.phone && (
                <span className="flex items-center gap-1">
                  <Phone className="h-3.5 w-3.5" /> {contact.phone}
                </span>
              )}
              {contact.assignedTo && (
                <span className="flex items-center gap-1">
                  <User className="h-3.5 w-3.5" /> {contact.assignedTo.name}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Lead status selector */}
        <div className="flex shrink-0 flex-col gap-1.5 sm:items-end">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Estado del lead
          </p>
          <Select
            value={leadStatus}
            onValueChange={(v) => updateLeadStatus.mutate(v)}
            disabled={updateLeadStatus.isPending}
          >
            <SelectTrigger className="h-9 w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LEAD_STATUS_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Deals summary */}
      {contact.deals && contact.deals.length > 0 && (
        <div className="rounded-xl border bg-card p-5">
          <p className="mb-3 text-sm font-semibold">Deals asociados</p>
          <div className="space-y-2">
            {contact.deals.map((deal) => (
              <div key={deal.id} className="flex items-center justify-between text-sm">
                <span>{deal.title}</span>
                <div className="flex items-center gap-2">
                  {deal.stage && (
                    <Badge variant="outline" className="text-xs">
                      {deal.stage.name}
                    </Badge>
                  )}
                  <Badge
                    variant={deal.status === 'WON' ? 'default' : deal.status === 'LOST' ? 'destructive' : 'secondary'}
                    className="text-xs"
                  >
                    {deal.status === 'WON' ? 'Ganado' : deal.status === 'LOST' ? 'Perdido' : 'Abierto'}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Timeline */}
      <div className="rounded-xl border bg-card p-5">
        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm font-semibold">Historial de interacciones</p>
          <Button size="sm" className="gap-1.5" onClick={() => setDialogOpen(true)}>
            <Plus className="h-3.5 w-3.5" /> Registrar interacción
          </Button>
        </div>

        {loadingTimeline ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex gap-3">
                <div className="h-8 w-8 animate-pulse rounded-full bg-muted" />
                <div className="flex-1 space-y-1.5 pt-1">
                  <div className="h-3.5 w-2/3 animate-pulse rounded bg-muted" />
                  <div className="h-3 w-1/3 animate-pulse rounded bg-muted" />
                </div>
              </div>
            ))}
          </div>
        ) : activities.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Sin interacciones registradas todavía.
          </p>
        ) : (
          <div className="relative space-y-0">
            {activities.map((act, idx) => {
              const cfg = TIMELINE_CONFIG[act.type] ?? DEFAULT_CONFIG
              const Icon = cfg.icon
              const isLast = idx === activities.length - 1

              return (
                <div key={act.id} className="flex gap-3">
                  {/* Icon + vertical line */}
                  <div className="flex flex-col items-center">
                    <div
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${cfg.bgColor}`}
                    >
                      <Icon className={`h-4 w-4 ${cfg.iconColor}`} />
                    </div>
                    {!isLast && <div className="w-px flex-1 bg-border" style={{ minHeight: '1rem' }} />}
                  </div>

                  {/* Content */}
                  <div className="min-w-0 flex-1 pb-4">
                    <p className="text-sm leading-snug">{act.description}</p>
                    <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      {act.user && <span className="font-medium">{act.user.name}</span>}
                      {act.user && <span>·</span>}
                      <span>
                        {format(new Date(act.createdAt), "d MMM yyyy, HH:mm", { locale: es })}
                      </span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Log Interaction Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Registrar interacción</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-1">
            {/* Type selector */}
            <div className="grid grid-cols-2 gap-2">
              {INTERACTION_TYPES.map(({ value, label, icon: Icon, color }) => (
                <button
                  key={value}
                  onClick={() => setInteractionType(value)}
                  className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm transition-colors ${
                    interactionType === value
                      ? 'border-primary bg-primary/5 font-medium'
                      : 'hover:bg-muted/60'
                  }`}
                >
                  <Icon className={`h-4 w-4 ${color}`} />
                  {label}
                </button>
              ))}
            </div>

            <Separator />

            {/* Call result */}
            {interactionType === 'CALL' && (
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground">Resultado</p>
                <div className="flex gap-2">
                  {CALL_RESULTS.map((r) => (
                    <button
                      key={r.value}
                      onClick={() => setCallResult(r.value)}
                      className={`flex-1 rounded-md border px-2 py-1.5 text-xs transition-colors ${
                        callResult === r.value
                          ? 'border-primary bg-primary/5 font-medium'
                          : 'hover:bg-muted/60'
                      }`}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Note */}
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">
                {interactionType === 'NOTE' ? 'Nota *' : 'Notas adicionales (opcional)'}
              </p>
              <Textarea
                placeholder={
                  interactionType === 'NOTE'
                    ? 'Escribe tu nota...'
                    : 'Agrega detalles opcionales...'
                }
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="min-h-[80px] text-sm"
              />
            </div>

            <Button
              className="w-full"
              onClick={handleSaveInteraction}
              disabled={logInteraction.isPending || (interactionType === 'NOTE' && !note.trim())}
            >
              {logInteraction.isPending ? 'Guardando...' : 'Guardar'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
