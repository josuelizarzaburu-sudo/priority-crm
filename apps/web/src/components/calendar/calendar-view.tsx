'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSession } from 'next-auth/react'
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameDay,
  isSameMonth,
  isToday,
  addMonths,
  subMonths,
} from 'date-fns'
import { es } from 'date-fns/locale'
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  MapPin,
  Video,
  Clock,
  Users,
  X,
  CalendarDays,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'

interface Participant {
  id: string
  eventId: string
  userId: string
  user: { id: string; name: string; email: string; phone?: string }
}

interface CalendarEvent {
  id: string
  title: string
  description?: string
  startAt: string
  endAt?: string
  givenBy?: string
  modality: 'PRESENCIAL' | 'VIRTUAL'
  meetingLink?: string
  createdBy: { id: string; name: string }
  participants: Participant[]
}

interface TeamUser {
  id: string
  name: string
  email: string
  role: string
}

const DAYS_OF_WEEK = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

function EventDot({ modality }: { modality: 'PRESENCIAL' | 'VIRTUAL' }) {
  return (
    <span
      className={cn(
        'inline-block h-1.5 w-1.5 rounded-full',
        modality === 'VIRTUAL' ? 'bg-blue-500' : 'bg-[#d3ac76]',
      )}
    />
  )
}

export function CalendarView() {
  const { data: session } = useSession()
  const role = (session?.user as any)?.role ?? 'SALES_REP'
  const canManage = ['SUPER_ADMIN', 'OWNER', 'MANAGER'].includes(role)

  const qc = useQueryClient()
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedDay, setSelectedDay] = useState<Date | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)

  // Form state
  const [formTitle, setFormTitle] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formStartAt, setFormStartAt] = useState('')
  const [formEndAt, setFormEndAt] = useState('')
  const [formGivenBy, setFormGivenBy] = useState('')
  const [formModality, setFormModality] = useState<'PRESENCIAL' | 'VIRTUAL'>('PRESENCIAL')
  const [formMeetingLink, setFormMeetingLink] = useState('')
  const [formParticipantIds, setFormParticipantIds] = useState<string[]>([])

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth() + 1

  const { data: events = [], isLoading } = useQuery<CalendarEvent[]>({
    queryKey: ['calendar-events', year, month],
    queryFn: () =>
      api.get(`/calendar/events?year=${year}&month=${month}`).then((r) => r.data),
  })

  const { data: teamUsers = [] } = useQuery<TeamUser[]>({
    queryKey: ['users'],
    queryFn: () => api.get('/users').then((r) => r.data),
    enabled: canManage,
  })

  const createMutation = useMutation({
    mutationFn: (dto: object) => api.post('/calendar/events', dto).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['calendar-events'] })
      closeModal()
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/calendar/events/${id}`).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['calendar-events'] })
    },
  })

  function openModal() {
    setFormTitle('')
    setFormDescription('')
    setFormStartAt(selectedDay ? format(selectedDay, "yyyy-MM-dd'T'HH:mm") : '')
    setFormEndAt('')
    setFormGivenBy('')
    setFormModality('PRESENCIAL')
    setFormMeetingLink('')
    setFormParticipantIds([])
    setShowCreateModal(true)
  }

  function closeModal() {
    setShowCreateModal(false)
  }

  function toggleParticipant(userId: string) {
    setFormParticipantIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId],
    )
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!formTitle.trim() || !formStartAt) return
    createMutation.mutate({
      title: formTitle.trim(),
      description: formDescription.trim() || undefined,
      startAt: new Date(formStartAt).toISOString(),
      endAt: formEndAt ? new Date(formEndAt).toISOString() : undefined,
      givenBy: formGivenBy.trim() || undefined,
      modality: formModality,
      meetingLink: formMeetingLink.trim() || undefined,
      participantIds: formParticipantIds,
    })
  }

  // Build calendar grid
  const monthStart = startOfMonth(currentDate)
  const monthEnd = endOfMonth(currentDate)
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 0 })
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 0 })
  const gridDays = eachDayOfInterval({ start: gridStart, end: gridEnd })

  const eventsForDay = (day: Date) => events.filter((e) => isSameDay(new Date(e.startAt), day))
  const selectedDayEvents = selectedDay ? eventsForDay(selectedDay) : []

  return (
    <div className="flex h-full flex-col gap-0">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#e8eaf0] bg-white px-6 py-4">
        <div className="flex items-center gap-3">
          <CalendarDays className="h-5 w-5 text-[#d3ac76]" />
          <div>
            <h1 className="text-lg font-semibold text-[#25324b]">Calendario de Equipo</h1>
            <p className="text-xs text-muted-foreground capitalize">
              {format(currentDate, 'MMMM yyyy', { locale: es })}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentDate(new Date())}
            className="text-xs"
          >
            Hoy
          </Button>
          <button
            onClick={() => setCurrentDate((d) => subMonths(d, 1))}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#e8eaf0] bg-white hover:bg-[#f0f2f7]"
          >
            <ChevronLeft className="h-4 w-4 text-[#25324b]" />
          </button>
          <button
            onClick={() => setCurrentDate((d) => addMonths(d, 1))}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#e8eaf0] bg-white hover:bg-[#f0f2f7]"
          >
            <ChevronRight className="h-4 w-4 text-[#25324b]" />
          </button>
          {canManage && (
            <Button
              size="sm"
              onClick={openModal}
              className="ml-2 bg-[#d3ac76] text-white hover:bg-[#c49a60]"
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Nuevo evento
            </Button>
          )}
        </div>
      </div>

      {/* Grid + sidebar */}
      <div className="flex flex-1 overflow-hidden">
        {/* Calendar grid */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Day-of-week headers */}
          <div className="grid grid-cols-7 border-b border-[#e8eaf0] bg-[#f8f9fc]">
            {DAYS_OF_WEEK.map((d) => (
              <div
                key={d}
                className="py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
              >
                {d}
              </div>
            ))}
          </div>

          {/* Day cells */}
          <div className="flex-1 overflow-auto">
            {isLoading ? (
              <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
                Cargando eventos...
              </div>
            ) : (
              <div className="grid grid-cols-7">
                {gridDays.map((day) => {
                  const dayEvents = eventsForDay(day)
                  const isCurrentMonth = isSameMonth(day, currentDate)
                  const isSelected = selectedDay ? isSameDay(day, selectedDay) : false
                  const todayDay = isToday(day)
                  const shown = dayEvents.slice(0, 2)
                  const overflow = dayEvents.length - 2

                  return (
                    <button
                      key={day.toISOString()}
                      onClick={() => setSelectedDay(isSelected ? null : day)}
                      className={cn(
                        'relative min-h-[90px] border-b border-r border-[#e8eaf0] p-2 text-left transition-colors',
                        !isCurrentMonth && 'bg-[#f8f9fc]',
                        isSelected && 'bg-[#fdf8f0]',
                        !isSelected && isCurrentMonth && 'hover:bg-[#f8f9fc]',
                      )}
                    >
                      <span
                        className={cn(
                          'inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium',
                          todayDay
                            ? 'bg-[#d3ac76] text-white'
                            : isCurrentMonth
                              ? 'text-[#25324b]'
                              : 'text-muted-foreground/50',
                        )}
                      >
                        {format(day, 'd')}
                      </span>

                      {/* Event dots / labels */}
                      <div className="mt-1 space-y-0.5">
                        {shown.map((ev) => (
                          <div
                            key={ev.id}
                            className="flex items-center gap-1 truncate rounded px-1 py-0.5 text-[10px] font-medium text-[#25324b] hover:bg-black/5"
                            style={{ background: ev.modality === 'VIRTUAL' ? '#eff6ff' : '#fdf8f0' }}
                          >
                            <EventDot modality={ev.modality} />
                            <span className="truncate">{ev.title}</span>
                          </div>
                        ))}
                        {overflow > 0 && (
                          <p className="pl-1 text-[10px] text-muted-foreground">+{overflow} más</p>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Day detail sidebar */}
        {selectedDay && (
          <div className="flex w-72 flex-col border-l border-[#e8eaf0] bg-white">
            <div className="flex items-center justify-between border-b border-[#e8eaf0] px-4 py-3">
              <div>
                <p className="text-sm font-semibold capitalize text-[#25324b]">
                  {format(selectedDay, "EEEE d 'de' MMMM", { locale: es })}
                </p>
                <p className="text-xs text-muted-foreground">
                  {selectedDayEvents.length === 0
                    ? 'Sin eventos'
                    : `${selectedDayEvents.length} evento${selectedDayEvents.length !== 1 ? 's' : ''}`}
                </p>
              </div>
              <button
                onClick={() => setSelectedDay(null)}
                className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-[#f0f2f7]"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            <ScrollArea className="flex-1">
              <div className="space-y-3 p-4">
                {selectedDayEvents.length === 0 ? (
                  <p className="text-center text-xs text-muted-foreground">
                    No hay eventos este día
                  </p>
                ) : (
                  selectedDayEvents.map((ev) => (
                    <EventCard
                      key={ev.id}
                      event={ev}
                      canManage={canManage}
                      onDelete={() => deleteMutation.mutate(ev.id)}
                      isDeleting={deleteMutation.isPending}
                    />
                  ))
                )}
                {canManage && (
                  <button
                    onClick={openModal}
                    className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-[#d3ac76]/60 py-2.5 text-xs text-[#d3ac76] transition-colors hover:bg-[#fdf8f0]"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Agregar evento
                  </button>
                )}
              </div>
            </ScrollArea>
          </div>
        )}
      </div>

      {/* Create event modal */}
      <Dialog open={showCreateModal} onOpenChange={(o) => !o && closeModal()}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nuevo Evento</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Title */}
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                Título *
              </label>
              <Input
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder="Ej: Capacitación de ventas"
                required
              />
            </div>

            {/* Start / End */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  Inicio *
                </label>
                <input
                  type="datetime-local"
                  value={formStartAt}
                  onChange={(e) => setFormStartAt(e.target.value)}
                  required
                  className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  Fin (opcional)
                </label>
                <input
                  type="datetime-local"
                  value={formEndAt}
                  min={formStartAt}
                  onChange={(e) => setFormEndAt(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>

            {/* Given by */}
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                Impartido por
              </label>
              <Input
                value={formGivenBy}
                onChange={(e) => setFormGivenBy(e.target.value)}
                placeholder="Nombre del ponente o instructor"
              />
            </div>

            {/* Modality */}
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                Modalidad
              </label>
              <div className="flex gap-3">
                {(['PRESENCIAL', 'VIRTUAL'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setFormModality(m)}
                    className={cn(
                      'flex flex-1 items-center justify-center gap-1.5 rounded-lg border py-2 text-xs font-medium transition-colors',
                      formModality === m
                        ? m === 'VIRTUAL'
                          ? 'border-blue-400 bg-blue-50 text-blue-700'
                          : 'border-[#d3ac76] bg-[#fdf8f0] text-[#c49a60]'
                        : 'border-input text-muted-foreground hover:bg-muted/30',
                    )}
                  >
                    {m === 'VIRTUAL' ? (
                      <Video className="h-3.5 w-3.5" />
                    ) : (
                      <MapPin className="h-3.5 w-3.5" />
                    )}
                    {m === 'VIRTUAL' ? 'Virtual' : 'Presencial'}
                  </button>
                ))}
              </div>
            </div>

            {/* Meeting link — only if virtual */}
            {formModality === 'VIRTUAL' && (
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  Link de reunión
                </label>
                <Input
                  value={formMeetingLink}
                  onChange={(e) => setFormMeetingLink(e.target.value)}
                  placeholder="https://meet.google.com/..."
                  type="url"
                />
              </div>
            )}

            {/* Description */}
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                Descripción (opcional)
              </label>
              <Textarea
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="Detalles del evento..."
                rows={3}
                className="resize-none"
              />
            </div>

            {/* Participants */}
            <div>
              <label className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Users className="h-3.5 w-3.5" />
                Participantes
              </label>
              <ScrollArea className="h-40 rounded-md border border-input p-2">
                <div className="space-y-1">
                  {teamUsers.map((u) => (
                    <label
                      key={u.id}
                      className="flex cursor-pointer items-center gap-2.5 rounded px-2 py-1.5 hover:bg-muted/40"
                    >
                      <input
                        type="checkbox"
                        checked={formParticipantIds.includes(u.id)}
                        onChange={() => toggleParticipant(u.id)}
                        className="h-3.5 w-3.5 rounded accent-[#d3ac76]"
                      />
                      <div className="min-w-0">
                        <p className="truncate text-xs font-medium text-[#25324b]">{u.name}</p>
                        <p className="truncate text-[10px] text-muted-foreground">{u.email}</p>
                      </div>
                    </label>
                  ))}
                  {teamUsers.length === 0 && (
                    <p className="py-2 text-center text-xs text-muted-foreground">
                      No hay usuarios disponibles
                    </p>
                  )}
                </div>
              </ScrollArea>
              {formParticipantIds.length > 0 && (
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {formParticipantIds.length} participante
                  {formParticipantIds.length !== 1 ? 's' : ''} seleccionado
                  {formParticipantIds.length !== 1 ? 's' : ''}
                </p>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="outline" size="sm" onClick={closeModal}>
                Cancelar
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={createMutation.isPending || !formTitle.trim() || !formStartAt}
                className="bg-[#d3ac76] text-white hover:bg-[#c49a60]"
              >
                {createMutation.isPending ? 'Creando...' : 'Crear evento'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function EventCard({
  event,
  canManage,
  onDelete,
  isDeleting,
}: {
  event: CalendarEvent
  canManage: boolean
  onDelete: () => void
  isDeleting: boolean
}) {
  const start = new Date(event.startAt)
  const end = event.endAt ? new Date(event.endAt) : null

  return (
    <div className="rounded-lg border border-[#e8eaf0] bg-white p-3 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <EventDot modality={event.modality} />
            <p className="truncate text-xs font-semibold text-[#25324b]">{event.title}</p>
          </div>

          <div className="mt-1.5 space-y-1">
            <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <Clock className="h-3 w-3 shrink-0" />
              <span>
                {format(start, 'HH:mm', { locale: es })}
                {end && ` – ${format(end, 'HH:mm', { locale: es })}`}
              </span>
            </div>

            {event.modality === 'PRESENCIAL' && (
              <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <MapPin className="h-3 w-3 shrink-0" />
                <span>Presencial</span>
              </div>
            )}

            {event.modality === 'VIRTUAL' && (
              <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <Video className="h-3 w-3 shrink-0" />
                {event.meetingLink ? (
                  <a
                    href={event.meetingLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="truncate text-blue-500 hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    Ver link
                  </a>
                ) : (
                  <span>Virtual</span>
                )}
              </div>
            )}

            {event.givenBy && (
              <p className="text-[11px] text-muted-foreground">
                <span className="font-medium">Impartido por:</span> {event.givenBy}
              </p>
            )}

            {event.participants.length > 0 && (
              <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <Users className="h-3 w-3 shrink-0" />
                <span className="truncate">
                  {event.participants
                    .slice(0, 2)
                    .map((p) => p.user.name)
                    .join(', ')}
                  {event.participants.length > 2 && ` +${event.participants.length - 2}`}
                </span>
              </div>
            )}

            {event.description && (
              <p className="line-clamp-2 text-[11px] text-muted-foreground">{event.description}</p>
            )}
          </div>
        </div>

        {canManage && (
          <button
            onClick={onDelete}
            disabled={isDeleting}
            className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-red-50 hover:text-red-500 disabled:opacity-50"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  )
}
