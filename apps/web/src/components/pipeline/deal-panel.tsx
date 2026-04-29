'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  X,
  Phone,
  MessageSquare,
  Trophy,
  XCircle,
  User,
  Calendar,
  DollarSign,
  FileText,
  CheckCircle,
  Clock,
  Mail,
  Users,
} from 'lucide-react'
import { formatDistanceToNow, format } from 'date-fns'
import { es } from 'date-fns/locale'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { useToast } from '@/hooks/use-toast'
import { api } from '@/lib/api'
import { formatCurrency } from '@/lib/utils'

interface ActivityEntry {
  id: string
  type: string
  description: string
  createdAt: string
  user?: { id: string; name: string }
}

interface DealDetail {
  id: string
  title: string
  value?: number
  currency: string
  probability?: number
  expectedCloseDate?: string
  status: string
  notes?: string
  stageId: string
  contactId?: string
  assignedToId?: string
  customFields?: Record<string, unknown>
  stage?: { id: string; name: string; color?: string }
  contact?: { id: string; firstName: string; lastName?: string; company?: string; phone?: string; email?: string }
  assignedTo?: { id: string; name: string; email?: string }
  activities: ActivityEntry[]
}

interface TeamMember {
  id: string
  name: string
}

interface DealPanelProps {
  dealId: string | null
  onClose: () => void
  userRole: string
  users: TeamMember[]
}

const LEAD_STATUS_OPTIONS = [
  { value: 'SIN_GESTION', label: 'Sin gestión' },
  { value: 'CONTACTADO', label: 'Contactado' },
  { value: 'EN_PROCESO', label: 'En proceso' },
  { value: 'CALIFICADO', label: 'Calificado' },
  { value: 'PERDIDO', label: 'Perdido' },
]

const ACTIVITY_ICON: Record<string, React.ReactNode> = {
  CALL: <Phone className="h-3.5 w-3.5 text-blue-500" />,
  EMAIL: <Mail className="h-3.5 w-3.5 text-purple-500" />,
  MEETING: <Users className="h-3.5 w-3.5 text-green-500" />,
  TASK: <CheckCircle className="h-3.5 w-3.5 text-orange-500" />,
  STAGE_CHANGE: <Clock className="h-3.5 w-3.5 text-yellow-500" />,
  NOTE: <FileText className="h-3.5 w-3.5 text-gray-500" />,
}

export function DealPanel({ dealId, onClose, userRole, users }: DealPanelProps) {
  const isOpen = !!dealId
  const isAdminOrManager = userRole === 'ADMIN' || userRole === 'MANAGER'
  const [showLostInput, setShowLostInput] = useState(false)
  const [closingReason, setClosingReason] = useState('')
  const [noteText, setNoteText] = useState('')
  const { toast } = useToast()
  const qc = useQueryClient()

  const { data: deal, isLoading } = useQuery<DealDetail>({
    queryKey: ['pipeline', 'deal', dealId],
    queryFn: () => api.get(`/pipeline/deals/${dealId}`).then((r) => r.data),
    enabled: !!dealId,
  })

  function invalidate() {
    qc.invalidateQueries({ queryKey: ['pipeline', 'deal', dealId] })
    qc.invalidateQueries({ queryKey: ['pipeline', 'deals'] })
  }

  const updateDeal = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      api.put(`/pipeline/deals/${dealId}`, data).then((r) => r.data),
    onSuccess: invalidate,
  })

  const assignDeal = useMutation({
    mutationFn: (agentId: string) =>
      api.put(`/pipeline/deals/${dealId}/assign`, { agentId }).then((r) => r.data),
    onSuccess: invalidate,
  })

  const logActivity = useMutation({
    mutationFn: (data: { type: string; description: string }) =>
      api.post(`/pipeline/deals/${dealId}/activity`, data).then((r) => r.data),
    onSuccess: () => {
      invalidate()
      toast({ title: 'Actividad registrada' })
    },
  })

  const saveNote = useMutation({
    mutationFn: (text: string) =>
      api.post(`/pipeline/deals/${dealId}/activity`, { type: 'NOTE', description: text }).then((r) => r.data),
    onSuccess: () => {
      setNoteText('')
      invalidate()
    },
  })

  const closeDealMutation = useMutation({
    mutationFn: (data: { status: string; closingReason?: string }) =>
      api.put(`/pipeline/deals/${dealId}/close`, data).then((r) => r.data),
    onSuccess: (_, vars) => {
      invalidate()
      toast({ title: vars.status === 'WON' ? '¡Deal ganado!' : 'Deal marcado como perdido' })
      setShowLostInput(false)
      setClosingReason('')
      onClose()
    },
  })

  function handleLeadStatusChange(value: string) {
    updateDeal.mutate({ customFields: { ...deal?.customFields, leadStatus: value } })
  }

  function handleLost() {
    if (!showLostInput) {
      setShowLostInput(true)
      return
    }
    closeDealMutation.mutate({ status: 'LOST', closingReason: closingReason || undefined })
  }

  const leadStatus = (deal?.customFields?.leadStatus as string) ?? 'SIN_GESTION'
  const isClosed = deal?.status !== 'OPEN'

  return (
    <>
      {isOpen && <div className="fixed inset-0 z-40 bg-black/20" onClick={onClose} />}

      <div
        className={`fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col bg-background shadow-2xl transition-transform duration-300 ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b px-5 py-4">
          <div className="min-w-0 flex-1">
            {isLoading ? (
              <div className="h-5 w-40 animate-pulse rounded bg-muted" />
            ) : (
              <h2 className="truncate text-base font-semibold">{deal?.title}</h2>
            )}
            {deal?.stage && (
              <span className="text-xs text-muted-foreground">{deal.stage.name}</span>
            )}
          </div>
          <button onClick={onClose} className="ml-2 rounded-sm p-1 hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>

        <ScrollArea className="flex-1">
          {isLoading ? (
            <div className="space-y-3 p-5">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-8 animate-pulse rounded bg-muted" />
              ))}
            </div>
          ) : deal ? (
            <div className="space-y-5 p-5">
              {/* Lead Status */}
              <div className="space-y-1.5">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Estado del lead
                </p>
                <Select value={leadStatus} onValueChange={handleLeadStatusChange} disabled={isClosed}>
                  <SelectTrigger className="h-9">
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

              <Separator />

              {/* Deal Info */}
              <div className="space-y-1.5">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Información
                </p>
                <div className="divide-y rounded-md border text-sm">
                  {deal.value != null && (
                    <div className="flex items-center justify-between px-3 py-2">
                      <span className="flex items-center gap-1.5 text-muted-foreground">
                        <DollarSign className="h-3.5 w-3.5" /> Valor
                      </span>
                      <span className="font-medium">{formatCurrency(deal.value)}</span>
                    </div>
                  )}
                  {deal.contact && (
                    <div className="flex items-center justify-between px-3 py-2">
                      <span className="flex items-center gap-1.5 text-muted-foreground">
                        <User className="h-3.5 w-3.5" /> Contacto
                      </span>
                      <span className="font-medium">
                        {deal.contact.firstName} {deal.contact.lastName ?? ''}
                      </span>
                    </div>
                  )}
                  {deal.contact?.phone && (
                    <div className="flex items-center justify-between px-3 py-2">
                      <span className="flex items-center gap-1.5 text-muted-foreground">
                        <Phone className="h-3.5 w-3.5" /> Teléfono
                      </span>
                      <span className="font-medium">{deal.contact.phone}</span>
                    </div>
                  )}
                  {deal.contact?.email && (
                    <div className="flex items-center justify-between px-3 py-2">
                      <span className="flex items-center gap-1.5 text-muted-foreground">
                        <Mail className="h-3.5 w-3.5" /> Email
                      </span>
                      <span className="truncate font-medium">{deal.contact.email}</span>
                    </div>
                  )}
                  {deal.expectedCloseDate && (
                    <div className="flex items-center justify-between px-3 py-2">
                      <span className="flex items-center gap-1.5 text-muted-foreground">
                        <Calendar className="h-3.5 w-3.5" /> Cierre estimado
                      </span>
                      <span className="font-medium">
                        {new Date(deal.expectedCloseDate).toLocaleDateString('es-MX')}
                      </span>
                    </div>
                  )}
                  {deal.probability != null && (
                    <div className="flex items-center justify-between px-3 py-2">
                      <span className="text-muted-foreground">Probabilidad</span>
                      <span className="font-medium">{deal.probability}%</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Owner */}
              {isAdminOrManager && (
                <div className="space-y-1.5">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Vendedor asignado
                  </p>
                  <Select
                    value={deal.assignedToId ?? ''}
                    onValueChange={(v) => v && assignDeal.mutate(v)}
                    disabled={assignDeal.isPending}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Sin asignar" />
                    </SelectTrigger>
                    <SelectContent>
                      {users.map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <Separator />

              {/* Quick Actions */}
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Acciones rápidas
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="justify-start gap-2"
                    onClick={() => logActivity.mutate({ type: 'CALL', description: 'Llamada registrada' })}
                    disabled={logActivity.isPending}
                  >
                    <Phone className="h-3.5 w-3.5 text-blue-500" /> Llamé
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="justify-start gap-2"
                    onClick={() => logActivity.mutate({ type: 'NOTE', description: 'WhatsApp enviado' })}
                    disabled={logActivity.isPending}
                  >
                    <MessageSquare className="h-3.5 w-3.5 text-green-500" /> WhatsApp
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="justify-start gap-2 border-green-200 text-green-700 hover:bg-green-50 disabled:opacity-50"
                    onClick={() => closeDealMutation.mutate({ status: 'WON' })}
                    disabled={closeDealMutation.isPending || isClosed}
                  >
                    <Trophy className="h-3.5 w-3.5" /> Ganado
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="justify-start gap-2 border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50"
                    onClick={handleLost}
                    disabled={closeDealMutation.isPending || isClosed}
                  >
                    <XCircle className="h-3.5 w-3.5" /> Perdido
                  </Button>
                </div>

                {showLostInput && (
                  <div className="space-y-2">
                    <Textarea
                      placeholder="Razón de cierre (opcional)"
                      value={closingReason}
                      onChange={(e) => setClosingReason(e.target.value)}
                      className="min-h-[72px] text-sm"
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="destructive"
                        className="flex-1"
                        onClick={handleLost}
                        disabled={closeDealMutation.isPending}
                      >
                        Confirmar pérdida
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setShowLostInput(false)
                          setClosingReason('')
                        }}
                      >
                        Cancelar
                      </Button>
                    </div>
                  </div>
                )}

                {isClosed && (
                  <p className="text-xs text-muted-foreground">
                    Deal cerrado como{' '}
                    <span className={deal.status === 'WON' ? 'font-medium text-green-600' : 'font-medium text-red-600'}>
                      {deal.status === 'WON' ? 'Ganado' : 'Perdido'}
                    </span>
                    .
                  </p>
                )}
              </div>

              <Separator />

              {/* Notes */}
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Notas
                </p>
                <Textarea
                  placeholder="Escribe una nota..."
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  className="min-h-[80px] text-sm"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && noteText.trim()) {
                      saveNote.mutate(noteText.trim())
                    }
                  }}
                />
                <Button
                  size="sm"
                  className="w-full"
                  onClick={() => noteText.trim() && saveNote.mutate(noteText.trim())}
                  disabled={saveNote.isPending || !noteText.trim()}
                >
                  {saveNote.isPending ? 'Guardando...' : 'Guardar nota'}
                </Button>

                {(() => {
                  const notes = deal.activities.filter((a) => a.type === 'NOTE')
                  if (notes.length === 0) return null
                  return (
                    <div className="mt-3 space-y-3">
                      {notes.map((note) => (
                        <div key={note.id} className="rounded-md border bg-muted/30 px-3 py-2.5 text-sm">
                          <p className="leading-snug whitespace-pre-wrap">{note.description}</p>
                          <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                            {note.user && <span className="font-medium">{note.user.name}</span>}
                            {note.user && <span>·</span>}
                            <span>
                              {format(new Date(note.createdAt), "d MMM yyyy, HH:mm", { locale: es })}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                })()}
              </div>

              <Separator />

              {/* Activity History — calls, stage changes, etc. */}
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Historial
                </p>
                {(() => {
                  const nonNotes = deal.activities.filter((a) => a.type !== 'NOTE')
                  if (nonNotes.length === 0) {
                    return <p className="text-xs text-muted-foreground">Sin actividades registradas.</p>
                  }
                  return (
                    <div className="space-y-3">
                      {nonNotes.map((act) => (
                        <div key={act.id} className="flex gap-3">
                          <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted">
                            {ACTIVITY_ICON[act.type] ?? (
                              <FileText className="h-3.5 w-3.5 text-gray-400" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs leading-snug">{act.description}</p>
                            <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                              {act.user && <span>{act.user.name}</span>}
                              {act.user && <span>·</span>}
                              <span>
                                {formatDistanceToNow(new Date(act.createdAt), {
                                  addSuffix: true,
                                  locale: es,
                                })}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                })()}
              </div>
            </div>
          ) : null}
        </ScrollArea>
      </div>
    </>
  )
}
