'use client'

import { useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { MessageSquare, Send, Phone, Mail, Clock, ArrowLeft } from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import { api } from '@/lib/api'
import { cn, getInitials } from '@/lib/utils'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

interface ActivityEntry {
  id: string
  type: string
  description: string
  createdAt: string
  user?: { id: string; name: string }
}

interface DealSummary {
  id: string
  title: string
  value?: number
  status: string
  stage?: { name: string; color?: string }
  contact?: { id: string; firstName: string; lastName?: string; phone?: string; email?: string }
  activities: ActivityEntry[]
}

interface DealDetail extends DealSummary {
  activities: ActivityEntry[]
}

const ACTIVITY_COLOR: Record<string, string> = {
  CALL:         'text-blue-500',
  EMAIL:        'text-amber-500',
  MEETING:      'text-green-500',
  NOTE:         'text-gray-500',
  STAGE_CHANGE: 'text-yellow-600',
}

export function CommunicationsInbox() {
  const [selectedDealId, setSelectedDealId] = useState<string | null>(null)
  const [noteText, setNoteText] = useState('')
  const [mobileView, setMobileView] = useState<'list' | 'conversation'>('list')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const qc = useQueryClient()

  function selectDeal(id: string) {
    setSelectedDealId(id)
    setMobileView('conversation')
  }

  function goBackToList() {
    setMobileView('list')
  }

  const { data: deals = [], isLoading: loadingDeals } = useQuery<DealSummary[]>({
    queryKey: ['comms', 'deals'],
    queryFn: () => api.get('/pipeline/deals').then((r) => r.data),
  })

  const { data: deal, isLoading: loadingDeal } = useQuery<DealDetail>({
    queryKey: ['comms', 'deal', selectedDealId],
    queryFn: () => api.get(`/pipeline/deals/${selectedDealId}`).then((r) => r.data),
    enabled: !!selectedDealId,
  })

  const addNote = useMutation({
    mutationFn: (text: string) =>
      api.post(`/pipeline/deals/${selectedDealId}/activity`, { type: 'NOTE', description: text }),
    onSuccess: () => {
      setNoteText('')
      qc.invalidateQueries({ queryKey: ['comms', 'deal', selectedDealId] })
      qc.invalidateQueries({ queryKey: ['comms', 'deals'] })
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
    },
  })

  const openDeals = deals.filter((d) => d.status === 'OPEN')
  const selectedContact = deal?.contact

  const dealListPanel = (
    <div className="flex flex-col overflow-hidden h-full">
      <div className="border-b px-4 py-3 shrink-0">
        <h2 className="font-semibold">Conversaciones</h2>
        <p className="text-xs text-muted-foreground mt-0.5">Notas y seguimiento con clientes</p>
      </div>
      <ScrollArea className="flex-1">
        {loadingDeals ? (
          <div className="space-y-2 p-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 animate-pulse rounded-xl bg-muted" />
            ))}
          </div>
        ) : openDeals.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-center text-muted-foreground">
            <MessageSquare className="h-8 w-8" />
            <p className="text-sm">No hay deals activos</p>
          </div>
        ) : (
          <div className="flex flex-col gap-1 p-2">
            {openDeals.map((d) => {
              const contactName = d.contact
                ? `${d.contact.firstName}${d.contact.lastName ? ` ${d.contact.lastName}` : ''}`
                : 'Sin contacto'
              const lastNote = d.activities?.filter((a) => a.type === 'NOTE')[0]
              const isActive = d.id === selectedDealId

              return (
                <button
                  key={d.id}
                  onClick={() => selectDeal(d.id)}
                  style={{ touchAction: 'manipulation' }}
                  className={cn(
                    'flex w-full items-start gap-3 rounded-xl px-4 py-3.5 text-left transition-colors active:bg-muted/60 hover:bg-muted/50',
                    isActive && 'bg-muted',
                  )}
                >
                  <Avatar className="h-10 w-10 shrink-0 mt-0.5">
                    <AvatarFallback className="text-sm font-semibold">{getInitials(contactName)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-semibold">{contactName}</span>
                      {d.stage?.color && (
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: d.stage.color }}
                        />
                      )}
                    </div>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">{d.title}</p>
                    {lastNote && (
                      <p className="mt-1 truncate text-xs text-muted-foreground/60">{lastNote.description}</p>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </ScrollArea>
    </div>
  )

  const conversationPanel = (
    <div className="flex flex-col overflow-hidden h-full">
      {/* Header */}
      <div className="flex items-center gap-3 border-b px-4 py-3 shrink-0">
        <button
          onClick={goBackToList}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md hover:bg-muted md:hidden"
          aria-label="Volver"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        {selectedContact && (
          <Avatar className="h-9 w-9 shrink-0">
            <AvatarFallback className="text-sm">
              {getInitials(`${selectedContact.firstName} ${selectedContact.lastName ?? ''}`)}
            </AvatarFallback>
          </Avatar>
        )}
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm truncate">
            {selectedContact
              ? `${selectedContact.firstName}${selectedContact.lastName ? ` ${selectedContact.lastName}` : ''}`
              : 'Sin contacto'}
          </p>
          {deal?.title && (
            <p className="text-xs text-muted-foreground truncate">{deal.title}</p>
          )}
        </div>
        <div className="hidden md:flex items-center gap-3 text-xs text-muted-foreground shrink-0">
          {selectedContact?.phone && (
            <span className="flex items-center gap-1">
              <Phone className="h-3.5 w-3.5" />
              {selectedContact.phone}
            </span>
          )}
          {selectedContact?.email && (
            <span className="hidden items-center gap-1 lg:flex">
              <Mail className="h-3.5 w-3.5" />
              {selectedContact.email}
            </span>
          )}
        </div>
      </div>

      {/* Contact info row — mobile only */}
      {selectedContact && (selectedContact.phone || selectedContact.email) && (
        <div className="flex gap-4 border-b px-4 py-2 text-xs text-muted-foreground md:hidden">
          {selectedContact.phone && (
            <span className="flex items-center gap-1">
              <Phone className="h-3 w-3" />
              {selectedContact.phone}
            </span>
          )}
          {selectedContact.email && (
            <span className="flex items-center gap-1 min-w-0 truncate">
              <Mail className="h-3 w-3 shrink-0" />
              <span className="truncate">{selectedContact.email}</span>
            </span>
          )}
        </div>
      )}

      {/* Activity feed */}
      <ScrollArea className="flex-1 px-4 py-3">
        {loadingDeal ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-14 animate-pulse rounded-lg bg-muted" />
            ))}
          </div>
        ) : (deal?.activities ?? []).length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-muted-foreground">
            <MessageSquare className="h-8 w-8" />
            <p className="text-sm">Sin actividades. Agrega la primera nota.</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {[...(deal?.activities ?? [])].reverse().map((act) => {
              const isNote = act.type === 'NOTE'
              return (
                <div
                  key={act.id}
                  className={cn(
                    'rounded-xl border px-4 py-3 text-sm',
                    isNote ? 'bg-card' : 'bg-muted/40',
                  )}
                >
                  <p className="leading-snug whitespace-pre-wrap">{act.description}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {act.user && <span className="font-medium">{act.user.name}</span>}
                    {act.user && <span>·</span>}
                    <span>{format(new Date(act.createdAt), "d MMM yyyy, HH:mm", { locale: es })}</span>
                    <span>·</span>
                    <span className={cn('font-medium', ACTIVITY_COLOR[act.type] ?? 'text-gray-500')}>
                      {act.type === 'NOTE' ? 'Nota' : act.type === 'CALL' ? 'Llamada' : act.type === 'STAGE_CHANGE' ? 'Cambio etapa' : act.type}
                    </span>
                  </div>
                </div>
              )
            })}
            <div ref={messagesEndRef} />
          </div>
        )}
      </ScrollArea>

      {/* Input */}
      <div className="border-t p-3 space-y-2 shrink-0">
        <Textarea
          placeholder="Escribe una nota... (Ctrl+Enter para guardar)"
          value={noteText}
          onChange={(e) => setNoteText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && noteText.trim()) {
              addNote.mutate(noteText.trim())
            }
          }}
          className="min-h-[72px] resize-none text-sm"
        />
        <div className="flex items-center justify-between">
          <p className="hidden text-xs text-muted-foreground md:block">Ctrl+Enter para guardar</p>
          <Button
            size="sm"
            className="ml-auto gap-1.5"
            onClick={() => noteText.trim() && addNote.mutate(noteText.trim())}
            disabled={addNote.isPending || !noteText.trim()}
          >
            <Send className="h-3.5 w-3.5" />
            {addNote.isPending ? 'Guardando...' : 'Registrar nota'}
          </Button>
        </div>
      </div>
    </div>
  )

  return (
    <div className="flex h-full overflow-hidden rounded-lg border bg-card">
      {/* ── Desktop: two-column layout ────────────────────────────────── */}
      <div className="hidden w-80 shrink-0 flex-col border-r md:flex">
        {dealListPanel}
      </div>

      <div className="hidden flex-1 flex-col overflow-hidden md:flex">
        {!selectedDealId ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 text-muted-foreground">
            <MessageSquare className="h-10 w-10" />
            <p className="text-sm">Selecciona un deal para ver el historial</p>
          </div>
        ) : conversationPanel}
      </div>

      {/* ── Mobile: full-screen list or conversation ──────────────────── */}
      <div className="flex flex-1 flex-col overflow-hidden md:hidden">
        {mobileView === 'list' ? dealListPanel : conversationPanel}
      </div>
    </div>
  )
}
