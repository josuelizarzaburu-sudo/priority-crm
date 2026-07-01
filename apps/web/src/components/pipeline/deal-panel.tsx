'use client'

import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  X,
  ArrowLeft,
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
  Bell,
  BellOff,
  Pencil,
  Check,
  Plus,
  Trash2,
} from 'lucide-react'
import { formatDistanceToNow, format } from 'date-fns'
import { es } from 'date-fns/locale'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { useToast } from '@/hooks/use-toast'
import { api } from '@/lib/api'
import { cn, formatCurrency } from '@/lib/utils'
import { WonDealModal, type WonInsuranceData } from './won-deal-modal'
import { LeadOriginBadge } from './lead-origin-badge'
import { WhatsappChat } from './whatsapp-chat'

const WON_STAGE_ID = 'cmohtra9r000bz5t3q407kx05'

type ProfileType = 'A' | 'B' | 'C' | 'D'

const PROFILES: Record<ProfileType, { label: string; emoji: string; className: string }> = {
  A: { label: 'Deportista con seguro',   emoji: '🏃🛡️', className: 'bg-green-100 text-green-700 border-green-200' },
  B: { label: 'Con seguro, sin deporte', emoji: '🛋️🛡️', className: 'bg-orange-100 text-orange-700 border-orange-200' },
  C: { label: 'Deportista sin seguro',   emoji: '🏃🔍', className: 'bg-blue-100 text-blue-700 border-blue-200' },
  D: { label: 'Sin seguro, sin deporte', emoji: '🛋️🔍', className: 'bg-violet-100 text-violet-700 border-violet-200' },
}

function getProfile(customFields?: Record<string, unknown> | null) {
  const pt = customFields?.profileType as ProfileType | undefined
  return pt ? (PROFILES[pt] ?? null) : null
}

interface ActivityEntry {
  id: string
  type: string
  description: string
  createdAt: string
  user?: { id: string; name: string }
}

interface AdditionalContact {
  id: string
  firstName: string
  lastName: string
  relationship: string
  birthDate?: string
}

interface InsuranceEntry {
  id: string
  holderName?: string
  plan?: string
  paymentFrequency?: string
  aseguradora?: string
  issueDate?: string
  netPremium?: number
}

interface FutureOpportunity {
  id: string
  insuranceType: 'AUTO' | 'VIDA' | 'PATRIMONIO' | 'SALUD'
  contactDate: string
  note: string
  createdAt: string
}

const INSURANCE_TYPE_LABELS: Record<string, string> = {
  AUTO: 'Auto',
  VIDA: 'Vida',
  PATRIMONIO: 'Patrimonio',
  SALUD: 'Salud',
}

function toInsuranceEntries(raw: unknown): InsuranceEntry[] {
  if (Array.isArray(raw)) return raw as InsuranceEntry[]
  if (raw && typeof raw === 'object') {
    return [{ id: 'legacy', ...(raw as Record<string, unknown>) }] as InsuranceEntry[]
  }
  return []
}

function formatPaymentFrequency(val?: string): string | undefined {
  if (!val) return undefined
  const map: Record<string, string> = {
    'pago-contado': 'Pago contado',
    'debito-mensual': 'Débito mensual',
    'diferido-especial': 'Diferido especial',
    'mensual': 'Mensual',
    'trimestral': 'Trimestral',
    'semestral': 'Semestral',
    'anual': 'Anual',
  }
  return map[val] ?? val.charAt(0).toUpperCase() + val.slice(1)
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

function toDatetimeLocal(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
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
  EMAIL: <Mail className="h-3.5 w-3.5 text-[#d3ac76]" />,
  MEETING: <Users className="h-3.5 w-3.5 text-green-500" />,
  TASK: <CheckCircle className="h-3.5 w-3.5 text-orange-500" />,
  STAGE_CHANGE: <Clock className="h-3.5 w-3.5 text-yellow-500" />,
  NOTE: <FileText className="h-3.5 w-3.5 text-gray-500" />,
}

function isoToDisplayDate(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

function displayDateToISO(text: string): string | null {
  const match = text.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (!match) return null
  const [, dd, mm, yyyy] = match
  const d = new Date(parseInt(yyyy), parseInt(mm) - 1, parseInt(dd))
  if (
    d.getFullYear() !== parseInt(yyyy) ||
    d.getMonth() + 1 !== parseInt(mm) ||
    d.getDate() !== parseInt(dd) ||
    parseInt(yyyy) < 1900
  ) return null
  return `${yyyy}-${mm}-${dd}`
}

function calculateAge(isoDate: string): number | null {
  const birth = new Date(isoDate + 'T00:00:00')
  if (isNaN(birth.getTime())) return null
  const today = new Date()
  let age = today.getFullYear() - birth.getFullYear()
  const m = today.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--
  return age >= 0 && age <= 120 ? age : null
}

export function DealPanel({ dealId, onClose, userRole, users }: DealPanelProps) {
  const isOpen = !!dealId
  const isAdminOrManager = ['SUPER_ADMIN', 'OWNER', 'MANAGER'].includes(userRole)

  // ── Existing state ────────────────────────────────────────────────────────
  const [showLostInput, setShowLostInput] = useState(false)
  const [closingReason, setClosingReason] = useState('')
  const [noteText, setNoteText] = useState('')
  const [followUpDate, setFollowUpDate] = useState('')
  const [editingContact, setEditingContact] = useState(false)
  const [editPhone, setEditPhone] = useState('')
  const [editEmail, setEditEmail] = useState('')

  // ── Contact extra fields state ────────────────────────────────────────────
  const [addingContact, setAddingContact] = useState(false)
  const [newContactFirstName, setNewContactFirstName] = useState('')
  const [newContactLastName, setNewContactLastName] = useState('')
  const [newContactRelationship, setNewContactRelationship] = useState('esposa')
  const [newContactBirthDate, setNewContactBirthDate] = useState('')

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showWonModal, setShowWonModal] = useState(false)

  // ── Fecha de nacimiento state ─────────────────────────────────────────────
  const [birthDateText, setBirthDateText] = useState('')
  const birthPickerRef = useRef<HTMLInputElement>(null)

  // ── Oportunidades futuras state ───────────────────────────────────────────
  const [addingOpportunity, setAddingOpportunity] = useState(false)
  const [newOppInsuranceType, setNewOppInsuranceType] = useState<'AUTO' | 'VIDA' | 'PATRIMONIO' | 'SALUD'>('SALUD')
  const [newOppContactDate, setNewOppContactDate] = useState('')
  const [newOppNote, setNewOppNote] = useState('')

  // ── Datos complementarios state ───────────────────────────────────────────
  const [complementaryContent, setComplementaryContent] = useState('')
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const savedComplementaryRef = useRef<string>('')

  // ── Datos del vehículo (AUTO) state ───────────────────────────────────────
  const [editingAutoData, setEditingAutoData] = useState(false)
  const [autoDataEdit, setAutoDataEdit] = useState<Record<string, string>>({})

  // ── Panel tab ─────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<'info' | 'whatsapp'>('info')

  const { toast } = useToast()
  const qc = useQueryClient()

  const { data: deal, isLoading } = useQuery<DealDetail>({
    queryKey: ['pipeline', 'deal', dealId],
    queryFn: () => api.get(`/pipeline/deals/${dealId}`).then((r) => r.data),
    enabled: !!dealId,
  })

  const { data: stages = [] } = useQuery<{ id: string; name: string }[]>({
    queryKey: ['pipeline', 'stages'],
    queryFn: () => api.get('/pipeline/stages').then((r) => r.data),
  })

  const { data: waMessages = [] } = useQuery<{ direction: string; read: boolean }[]>({
    queryKey: ['wa-messages', dealId],
    queryFn: () => api.get(`/whatsapp-chat/deals/${dealId}/messages`).then((r) => r.data),
    enabled: !!dealId,
    refetchInterval: 10000,
  })
  const unreadWaCount = waMessages.filter((m) => m.direction === 'INBOUND' && !m.read).length

  // Sync follow-up input when deal loads or changes
  useEffect(() => {
    const fua = deal?.customFields?.followUpAt as string | undefined
    setFollowUpDate(fua ? toDatetimeLocal(fua) : '')
  }, [deal?.id, deal?.customFields?.followUpAt])

  // Sync birth date text when deal loads
  useEffect(() => {
    const bd = deal?.customFields?.birthDate as string | undefined
    setBirthDateText(bd ? isoToDisplayDate(bd) : '')
  }, [deal?.id, deal?.customFields?.birthDate])

  // Sync complementary notes content when deal loads
  useEffect(() => {
    const saved = (deal?.customFields?.complementaryNotes as string) ?? ''
    setComplementaryContent(saved)
    savedComplementaryRef.current = saved
  }, [deal?.id, deal?.customFields?.complementaryNotes])

  // Sync auto data when deal loads
  useEffect(() => {
    const ad = (deal?.customFields?.autoData as Record<string, string | null | undefined>) ?? {}
    setAutoDataEdit({
      marca: ad.marca ?? '',
      modelo: ad.modelo ?? '',
      anio: ad.anio ?? '',
      placa: ad.placa ?? '',
      ciudad: ad.ciudad ?? '',
      cedulaRuc: ad.cedulaRuc ?? '',
      edad: ad.edad ?? '',
      estadoCivil: ad.estadoCivil ?? '',
      sexo: ad.sexo ?? '',
    })
  }, [deal?.id, deal?.customFields?.autoData])

  // Autosave debounce — fires 2 s after the user stops typing
  useEffect(() => {
    if (complementaryContent === savedComplementaryRef.current) return
    const timer = setTimeout(() => {
      setAutoSaveStatus('saving')
      saveComplementaryMutation.mutate(complementaryContent)
    }, 2000)
    return () => clearTimeout(timer)
  }, [complementaryContent]) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-clear "✓ Guardado" after 3 s
  useEffect(() => {
    if (autoSaveStatus !== 'saved') return
    const timer = setTimeout(() => setAutoSaveStatus('idle'), 3000)
    return () => clearTimeout(timer)
  }, [autoSaveStatus])

  function invalidate() {
    qc.invalidateQueries({ queryKey: ['pipeline', 'deal', dealId] })
    qc.invalidateQueries({ queryKey: ['pipeline', 'deals'] })
    qc.invalidateQueries({ queryKey: ['pipeline', 'my-deals'] })
  }

  // Generic customFields patch — merges with existing fields
  const patchCustomFields = useMutation({
    mutationFn: (fields: Record<string, unknown>) =>
      api.put(`/pipeline/deals/${dealId}`, {
        customFields: { ...deal?.customFields, ...fields },
      }).then((r) => r.data),
    onSuccess: invalidate,
  })

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

  const moveStage = useMutation({
    mutationFn: ({ stageId, insuranceData }: { stageId: string; insuranceData?: WonInsuranceData[] }) =>
      api.put(`/pipeline/deals/${dealId}/move`, { stageId, position: 1000, insuranceData }).then((r) => r.data),
    onSuccess: (_, vars) => {
      invalidate()
      toast({ title: vars.insuranceData ? '🏆 ¡Deal ganado!' : 'Etapa actualizada' })
      setShowWonModal(false)
    },
  })

  const updateContact = useMutation({
    mutationFn: (data: { phone?: string; email?: string }) =>
      api.put(`/contacts/${deal?.contactId}`, data).then((r) => r.data),
    onSuccess: () => {
      invalidate()
      setEditingContact(false)
      toast({ title: 'Contacto actualizado' })
    },
  })

  const saveFollowUp = useMutation({
    mutationFn: (isoDate: string | null) =>
      api.put(`/pipeline/deals/${dealId}`, {
        customFields: { ...deal?.customFields, followUpAt: isoDate },
      }).then((r) => r.data),
    onSuccess: (_, isoDate) => {
      invalidate()
      toast({ title: isoDate ? 'Seguimiento programado' : 'Seguimiento cancelado' })
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

  const deleteDealMutation = useMutation({
    mutationFn: () => api.delete(`/pipeline/deals/${dealId}`).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pipeline'] })
      qc.invalidateQueries({ queryKey: ['my-deals'] })
      toast({ title: 'Deal eliminado' })
      onClose()
    },
    onError: () => {
      toast({ title: 'Error al eliminar el deal', variant: 'destructive' })
      setShowDeleteConfirm(false)
    },
  })

  const addOpportunityMutation = useMutation({
    mutationFn: (data: { insuranceType: string; contactDate: string; note: string }) =>
      api.post(`/pipeline/deals/${dealId}/future-opportunities`, data).then((r) => r.data),
    onSuccess: () => {
      invalidate()
      setAddingOpportunity(false)
      setNewOppInsuranceType('SALUD')
      setNewOppContactDate('')
      setNewOppNote('')
      toast({ title: 'Oportunidad agregada' })
    },
    onError: () => toast({ title: 'Error al agregar oportunidad', variant: 'destructive' }),
  })

  const removeOpportunityMutation = useMutation({
    mutationFn: (oppId: string) =>
      api.delete(`/pipeline/deals/${dealId}/future-opportunities/${oppId}`).then((r) => r.data),
    onSuccess: () => {
      invalidate()
      toast({ title: 'Oportunidad eliminada' })
    },
  })

  // ── Helper handlers ───────────────────────────────────────────────────────

  function handleBirthDateTextChange(raw: string) {
    const digits = raw.replace(/\D/g, '').slice(0, 8)
    let formatted = ''
    for (let i = 0; i < digits.length; i++) {
      if (i === 2 || i === 4) formatted += '/'
      formatted += digits[i]
    }
    setBirthDateText(formatted)
    if (formatted.length === 10) {
      const iso = displayDateToISO(formatted)
      if (iso) patchCustomFields.mutate({ birthDate: iso })
    } else if (formatted === '') {
      patchCustomFields.mutate({ birthDate: null })
    }
  }

  function handleLeadStatusChange(value: string) {
    updateDeal.mutate({ customFields: { ...deal?.customFields, leadStatus: value } })
  }

  function handleLost() {
    if (!showLostInput) { setShowLostInput(true); return }
    closeDealMutation.mutate({ status: 'LOST', closingReason: closingReason || undefined })
  }

  function addAdditionalContact() {
    if (!newContactFirstName.trim()) return
    const existing = (deal?.customFields?.additionalContacts as AdditionalContact[]) ?? []
    const entry: AdditionalContact = {
      id: Date.now().toString(),
      firstName: newContactFirstName.trim(),
      lastName: newContactLastName.trim(),
      relationship: newContactRelationship,
      ...(newContactBirthDate ? { birthDate: newContactBirthDate } : {}),
    }
    patchCustomFields.mutate({ additionalContacts: [...existing, entry] })
    setNewContactFirstName('')
    setNewContactLastName('')
    setNewContactRelationship('esposa')
    setNewContactBirthDate('')
    setAddingContact(false)
  }

  function removeAdditionalContact(id: string) {
    const existing = (deal?.customFields?.additionalContacts as AdditionalContact[]) ?? []
    patchCustomFields.mutate({ additionalContacts: existing.filter((c) => c.id !== id) })
  }

  const saveComplementaryMutation = useMutation({
    mutationFn: (content: string) =>
      api.put(`/pipeline/deals/${dealId}`, {
        customFields: {
          ...deal?.customFields,
          complementaryNotes: content,
          complementaryNotesUpdatedAt: new Date().toISOString(),
        },
      }).then((r) => r.data),
    onSuccess: () => {
      setAutoSaveStatus('saved')
      invalidate()
    },
    onError: () => setAutoSaveStatus('error'),
  })

  const saveAutoDataMutation = useMutation({
    mutationFn: (data: Record<string, string>) =>
      api.put(`/pipeline/deals/${dealId}`, {
        customFields: { ...deal?.customFields, autoData: { ...(deal?.customFields?.autoData as object ?? {}), ...data } },
      }).then((r) => r.data),
    onSuccess: () => {
      setEditingAutoData(false)
      invalidate()
      toast({ title: 'Datos del vehículo guardados' })
    },
    onError: () => toast({ title: 'Error al guardar', variant: 'destructive' }),
  })

  const leadStatus = (deal?.customFields?.leadStatus as string) ?? 'SIN_GESTION'
  const isClosed = deal?.status !== 'OPEN'
  const isLocked = !!(deal?.customFields?.locked)
  const isGanadoLocked = (deal?.stageId === WON_STAGE_ID || isLocked) && userRole !== 'SUPER_ADMIN'
  const additionalContacts = (deal?.customFields?.additionalContacts as AdditionalContact[]) ?? []
  const complementaryNotesUpdatedAt = deal?.customFields?.complementaryNotesUpdatedAt as string | undefined
  const insuranceEntries = toInsuranceEntries(deal?.customFields?.insuranceData)

  return (
    <>
      {isOpen && <div className="fixed inset-0 z-40 bg-black/20" onClick={onClose} />}

      <div
        className={`fixed right-0 top-0 z-50 flex h-full w-full flex-col bg-background shadow-2xl transition-transform duration-300 md:max-w-md ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Mobile: back button */}
        <div className="flex items-center border-b px-4 py-2 md:hidden">
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver al pipeline
          </button>
        </div>

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
          <button
            onClick={onClose}
            className="ml-2 flex h-9 w-9 items-center justify-center rounded-md hover:bg-muted"
            aria-label="Cerrar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <WonDealModal
          open={showWonModal}
          onConfirm={(entries) => moveStage.mutate({ stageId: WON_STAGE_ID, insuranceData: entries })}
          onCancel={() => setShowWonModal(false)}
          loading={moveStage.isPending}
        />

        {/* ── Tab bar ──────────────────────────────────────────────────── */}
        <div className="flex border-b">
          <button
            onClick={() => setActiveTab('info')}
            className={cn(
              'flex-1 py-2 text-sm font-medium transition-colors',
              activeTab === 'info'
                ? 'border-b-2 border-[#25324b] text-[#25324b]'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            Info
          </button>
          <button
            onClick={() => setActiveTab('whatsapp')}
            className={cn(
              'relative flex-1 py-2 text-sm font-medium transition-colors',
              activeTab === 'whatsapp'
                ? 'border-b-2 border-[#25324b] text-[#25324b]'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            WhatsApp
            {unreadWaCount > 0 && (
              <span className="ml-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                {unreadWaCount}
              </span>
            )}
          </button>
        </div>

        {/* ── WhatsApp tab ─────────────────────────────────────────────── */}
        {activeTab === 'whatsapp' && dealId && (
          <div className="flex flex-1 flex-col overflow-hidden p-3">
            <WhatsappChat dealId={dealId} contactPhone={deal?.contact?.phone} />
          </div>
        )}

        {/* ── Info tab ─────────────────────────────────────────────────── */}
        {activeTab === 'info' && (
        <ScrollArea className="flex-1">
          {isLoading ? (
            <div className="space-y-3 p-5">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-8 animate-pulse rounded bg-muted" />
              ))}
            </div>
          ) : deal ? (
            <div className="space-y-5 p-5">

              {/* ── Lock banner ──────────────────────────────────────────── */}
              {isGanadoLocked && (
                <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800 dark:border-amber-800/40 dark:bg-amber-950/30 dark:text-amber-300">
                  <span className="text-base">🔒</span>
                  <span className="font-medium">Este deal está cerrado — solo lectura</span>
                </div>
              )}

              {/* ── Lead Status ─────────────────────────────────────────── */}
              <div className="space-y-1.5">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Estado del lead
                </p>
                <Select value={leadStatus} onValueChange={handleLeadStatusChange} disabled={isClosed || isGanadoLocked}>
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

              {/* Lead Profile + Origin Badges */}
              {(() => {
                const profile = getProfile(deal.customFields)
                const leadOrigin = deal.customFields?.leadOrigin as string | undefined
                if (!profile && !leadOrigin) return null
                return (
                  <div className="flex flex-wrap items-center gap-2">
                    {profile && (
                      <div className={cn('flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium w-fit', profile.className)}>
                        <span>{profile.emoji}</span>
                        <span>{profile.label}</span>
                      </div>
                    )}
                    <LeadOriginBadge leadOrigin={leadOrigin} className="px-3 py-1.5 text-sm" />
                  </div>
                )
              })()}

              <Separator />

              {/* ── Etapa del pipeline ───────────────────────────────────── */}
              <div className="space-y-1.5">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Etapa del pipeline
                </p>
                <Select
                  value={deal.stageId}
                  onValueChange={(v) => {
                    if (!v) return
                    if (v === WON_STAGE_ID) {
                      setShowWonModal(true)
                      return
                    }
                    moveStage.mutate({ stageId: v })
                  }}
                  disabled={moveStage.isPending || isClosed || isLocked}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {stages.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Separator />

              {/* ── 1. INFORMACIÓN DEL CONTACTO ─────────────────────────── */}
              <div className="space-y-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Información del contacto
                </p>

                {/* Base contact fields */}
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

                  {/* Phone / email — inline edit */}
                  {deal.contact && editingContact && !isGanadoLocked ? (
                    <div className="space-y-2 px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <Phone className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        <Input
                          value={editPhone}
                          onChange={(e) => setEditPhone(e.target.value)}
                          placeholder="Teléfono"
                          className="h-7 text-sm"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <Mail className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        <Input
                          value={editEmail}
                          onChange={(e) => setEditEmail(e.target.value)}
                          placeholder="Email"
                          className="h-7 text-sm"
                        />
                      </div>
                      <div className="flex gap-1.5">
                        <Button
                          size="sm"
                          className="h-7 gap-1 px-2 text-xs"
                          onClick={() => updateContact.mutate({ phone: editPhone || undefined, email: editEmail || undefined })}
                          disabled={updateContact.isPending}
                        >
                          <Check className="h-3 w-3" /> Guardar
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setEditingContact(false)}>
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center justify-between px-3 py-2 group">
                        <span className="flex items-center gap-1.5 text-muted-foreground">
                          <Phone className="h-3.5 w-3.5" /> Teléfono
                        </span>
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium">{deal.contact?.phone ?? '—'}</span>
                          {!isGanadoLocked && (
                            <button
                              className="hidden group-hover:flex h-5 w-5 items-center justify-center rounded hover:bg-muted"
                              onClick={() => { setEditPhone(deal.contact?.phone ?? ''); setEditEmail(deal.contact?.email ?? ''); setEditingContact(true) }}
                            >
                              <Pencil className="h-3 w-3 text-muted-foreground" />
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center justify-between px-3 py-2 group">
                        <span className="flex items-center gap-1.5 text-muted-foreground">
                          <Mail className="h-3.5 w-3.5" /> Email
                        </span>
                        <div className="flex items-center gap-1.5">
                          <span className="truncate font-medium max-w-[160px]">{deal.contact?.email ?? '—'}</span>
                          {!isGanadoLocked && (
                            <button
                              className="hidden group-hover:flex h-5 w-5 items-center justify-center rounded hover:bg-muted"
                              onClick={() => { setEditPhone(deal.contact?.phone ?? ''); setEditEmail(deal.contact?.email ?? ''); setEditingContact(true) }}
                            >
                              <Pencil className="h-3 w-3 text-muted-foreground" />
                            </button>
                          )}
                        </div>
                      </div>
                    </>
                  )}

                  {/* Fecha de nacimiento */}
                  {(() => {
                    const isoFromText = birthDateText.length === 10 ? displayDateToISO(birthDateText) : null
                    const isoForAge = isoFromText ?? (deal.customFields?.birthDate as string | undefined) ?? null
                    const age = isoForAge ? calculateAge(isoForAge) : null
                    return (
                      <div className="px-3 py-2 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-1.5 text-muted-foreground">
                            <Calendar className="h-3.5 w-3.5" /> Fecha de nacimiento
                          </span>
                          <div className="flex items-center gap-1.5">
                            <input
                              type="text"
                              inputMode="numeric"
                              placeholder="DD/MM/AAAA"
                              value={birthDateText}
                              onChange={(e) => handleBirthDateTextChange(e.target.value)}
                              disabled={isGanadoLocked}
                              maxLength={10}
                              className="w-[108px] rounded border bg-background px-2 py-0.5 text-sm outline-none focus:ring-1 focus:ring-ring disabled:opacity-50 disabled:cursor-not-allowed"
                            />
                            <input
                              ref={birthPickerRef}
                              type="date"
                              value={(deal.customFields?.birthDate as string) ?? ''}
                              onChange={(e) => {
                                const iso = e.target.value
                                patchCustomFields.mutate({ birthDate: iso || null })
                                setBirthDateText(iso ? isoToDisplayDate(iso) : '')
                              }}
                              disabled={isGanadoLocked}
                              tabIndex={-1}
                              className="sr-only"
                            />
                            <button
                              type="button"
                              disabled={isGanadoLocked}
                              onClick={() => { const el = birthPickerRef.current as (HTMLInputElement & { showPicker?: () => void }) | null; el?.showPicker?.() }}
                              title="Abrir selector de fecha"
                              className="flex h-6 w-6 items-center justify-center rounded hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                            </button>
                          </div>
                        </div>
                        {age !== null && (
                          <p className="text-right text-xs text-muted-foreground">Edad: {age} años</p>
                        )}
                      </div>
                    )
                  })()}

                  {/* Personas en el seguro */}
                  <div className="flex items-center justify-between px-3 py-2">
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      <Users className="h-3.5 w-3.5" /> Personas en el seguro
                    </span>
                    <input
                      type="number"
                      min="1"
                      value={(deal.customFields?.insuredPersonsCount as number) ?? ''}
                      onChange={(e) => patchCustomFields.mutate({ insuredPersonsCount: e.target.value ? parseInt(e.target.value) : null })}
                      disabled={isGanadoLocked}
                      className="w-16 rounded border bg-background px-2 py-0.5 text-right text-sm outline-none focus:ring-1 focus:ring-ring disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                  </div>

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

                {/* Contactos adicionales */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">Contactos adicionales</span>
                    {!addingContact && !isGanadoLocked && (
                      <button
                        onClick={() => setAddingContact(true)}
                        className="flex items-center gap-1 text-xs text-primary hover:underline"
                      >
                        <Plus className="h-3 w-3" /> Agregar contacto
                      </button>
                    )}
                  </div>

                  {additionalContacts.map((c) => (
                    <div key={c.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                      <div className="min-w-0">
                        <span className="font-medium">{c.firstName} {c.lastName}</span>
                        <span className="ml-1.5 text-xs text-muted-foreground">· {c.relationship}</span>
                        {c.birthDate && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Nac. {format(new Date(c.birthDate), "d MMM yyyy", { locale: es })}
                          </p>
                        )}
                      </div>
                      {!isGanadoLocked && (
                        <button
                          onClick={() => removeAdditionalContact(c.id)}
                          className="ml-2 flex h-5 w-5 shrink-0 items-center justify-center rounded hover:bg-muted"
                        >
                          <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-red-500" />
                        </button>
                      )}
                    </div>
                  ))}

                  {addingContact && (
                    <div className="space-y-2 rounded-md border p-3">
                      <div className="grid grid-cols-2 gap-2">
                        <Input
                          placeholder="Nombre"
                          value={newContactFirstName}
                          onChange={(e) => setNewContactFirstName(e.target.value)}
                          className="h-8 text-sm"
                        />
                        <Input
                          placeholder="Apellido"
                          value={newContactLastName}
                          onChange={(e) => setNewContactLastName(e.target.value)}
                          className="h-8 text-sm"
                        />
                      </div>
                      <Select value={newContactRelationship} onValueChange={setNewContactRelationship}>
                        <SelectTrigger className="h-8 text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="esposa">Esposa / Esposo</SelectItem>
                          <SelectItem value="hijo">Hijo / Hija</SelectItem>
                          <SelectItem value="madre">Madre</SelectItem>
                          <SelectItem value="padre">Padre</SelectItem>
                          <SelectItem value="otro">Otro</SelectItem>
                        </SelectContent>
                      </Select>
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">Fecha de nacimiento (opcional)</label>
                        <input
                          type="date"
                          value={newContactBirthDate}
                          onChange={(e) => setNewContactBirthDate(e.target.value)}
                          className="w-full rounded-md border bg-background px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring"
                        />
                      </div>
                      <div className="flex gap-1.5">
                        <Button
                          size="sm"
                          className="h-7 gap-1 px-2 text-xs"
                          onClick={addAdditionalContact}
                          disabled={patchCustomFields.isPending}
                        >
                          <Check className="h-3 w-3" /> Guardar
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-xs"
                          onClick={() => { setAddingContact(false); setNewContactFirstName(''); setNewContactLastName(''); setNewContactRelationship('esposa'); setNewContactBirthDate('') }}
                        >
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <Separator />

              {/* ── DATOS DEL VEHÍCULO (solo para deals AUTO) ───────────── */}
              {deal.customFields?.insuranceType === 'AUTO' && (() => {
                const ad = (deal.customFields?.autoData as Record<string, string | null | undefined>) ?? {}
                const canEdit = isAdminOrManager
                const AUTO_FIELDS: { key: string; label: string; type?: 'select'; options?: string[] }[] = [
                  { key: 'marca', label: 'Marca' },
                  { key: 'modelo', label: 'Modelo' },
                  { key: 'anio', label: 'Año' },
                  { key: 'placa', label: 'Placa' },
                  { key: 'ciudad', label: 'Ciudad' },
                  { key: 'cedulaRuc', label: 'Cédula / RUC' },
                  { key: 'edad', label: 'Edad' },
                  { key: 'estadoCivil', label: 'Estado civil', type: 'select', options: ['soltero', 'casado', 'divorciado', 'viudo', 'unión libre'] },
                  { key: 'sexo', label: 'Sexo', type: 'select', options: ['masculino', 'femenino'] },
                ]
                return (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Datos del vehículo
                      </p>
                      {canEdit && !editingAutoData && !isGanadoLocked && (
                        <button
                          onClick={() => setEditingAutoData(true)}
                          className="flex items-center gap-1 text-xs text-primary hover:underline"
                        >
                          <Pencil className="h-3 w-3" /> Editar
                        </button>
                      )}
                    </div>

                    {editingAutoData ? (
                      <div className="space-y-2 rounded-md border p-3">
                        {AUTO_FIELDS.map(({ key, label, type, options }) => (
                          <div key={key} className="flex items-center gap-2">
                            <span className="w-28 shrink-0 text-xs text-muted-foreground">{label}</span>
                            {type === 'select' ? (
                              <Select
                                value={autoDataEdit[key] ?? ''}
                                onValueChange={(v) => setAutoDataEdit(prev => ({ ...prev, [key]: v }))}
                              >
                                <SelectTrigger className="h-7 flex-1 text-xs">
                                  <SelectValue placeholder="—" />
                                </SelectTrigger>
                                <SelectContent>
                                  {options!.map(opt => (
                                    <SelectItem key={opt} value={opt}>{opt.charAt(0).toUpperCase() + opt.slice(1)}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : (
                              <Input
                                value={autoDataEdit[key] ?? ''}
                                onChange={(e) => setAutoDataEdit(prev => ({ ...prev, [key]: e.target.value }))}
                                className="h-7 flex-1 text-xs"
                                placeholder="—"
                              />
                            )}
                          </div>
                        ))}
                        <div className="flex gap-1.5 pt-1">
                          <Button
                            size="sm"
                            className="h-7 gap-1 px-2 text-xs"
                            onClick={() => saveAutoDataMutation.mutate(autoDataEdit)}
                            disabled={saveAutoDataMutation.isPending}
                          >
                            <Check className="h-3 w-3" /> Guardar
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setEditingAutoData(false)}>
                            Cancelar
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="divide-y rounded-md border text-sm">
                        {AUTO_FIELDS.map(({ key, label }) => (
                          <div key={key} className="flex items-center justify-between px-3 py-2">
                            <span className="text-muted-foreground">{label}</span>
                            <span className="font-medium capitalize">{ad[key] ?? '—'}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })()}

              {deal.customFields?.insuranceType === 'AUTO' && <Separator />}

              {/* ── 2. DATOS COMPLEMENTARIOS ────────────────────────────── */}
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Datos complementarios
                </p>
                <Textarea
                  placeholder="Bloc de notas libre — escribe, edita y borra lo que necesites..."
                  value={complementaryContent}
                  onChange={(e) => setComplementaryContent(e.target.value)}
                  disabled={isGanadoLocked}
                  className="min-h-[140px] text-sm"
                />
                <div className="flex items-center justify-between gap-3">
                  <div className="text-[11px]">
                    {autoSaveStatus === 'saving' && (
                      <span className="text-muted-foreground">Guardando...</span>
                    )}
                    {autoSaveStatus === 'saved' && (
                      <span className="text-green-600">✓ Guardado</span>
                    )}
                    {autoSaveStatus === 'error' && (
                      <span className="text-red-500">Error al guardar</span>
                    )}
                    {autoSaveStatus === 'idle' && complementaryNotesUpdatedAt && (
                      <span className="text-muted-foreground">
                        Última edición: {format(new Date(complementaryNotesUpdatedAt), "d MMM yyyy, HH:mm", { locale: es })}
                      </span>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setAutoSaveStatus('saving')
                      saveComplementaryMutation.mutate(complementaryContent)
                    }}
                    disabled={saveComplementaryMutation.isPending || isGanadoLocked}
                  >
                    Guardar
                  </Button>
                </div>
              </div>

              <Separator />

              {/* ── 3. SEGUIMIENTO PROGRAMADO ───────────────────────────── */}
              {(() => {
                const fua = deal.customFields?.followUpAt as string | undefined
                const isOverdue = fua ? new Date(fua) < new Date() : false
                return (
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Seguimiento programado
                    </p>
                    {fua ? (
                      <div
                        className={`flex items-center justify-between rounded-md border p-2.5 ${
                          isOverdue ? 'border-red-200 bg-red-50 dark:bg-red-950/20' : 'border-blue-200 bg-blue-50/50 dark:bg-blue-950/20'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <Bell className={`h-4 w-4 ${isOverdue ? 'text-red-500' : 'text-blue-500'}`} />
                          <div>
                            <p className="text-xs font-medium">
                              {format(new Date(fua), "d MMM yyyy, HH:mm", { locale: es })}
                            </p>
                            {isOverdue && <p className="text-[11px] font-bold text-red-600">VENCIDO</p>}
                          </div>
                        </div>
                        <button
                          onClick={() => saveFollowUp.mutate(null)}
                          disabled={saveFollowUp.isPending}
                          className="rounded p-1 hover:bg-muted"
                          title="Cancelar seguimiento"
                        >
                          <BellOff className="h-3.5 w-3.5 text-muted-foreground" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <input
                          type="datetime-local"
                          value={followUpDate}
                          min={toDatetimeLocal(new Date().toISOString())}
                          onChange={(e) => setFollowUpDate(e.target.value)}
                          disabled={isGanadoLocked}
                          className="flex-1 rounded-md border bg-background px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring disabled:opacity-50 disabled:cursor-not-allowed"
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={!followUpDate || saveFollowUp.isPending || isGanadoLocked}
                          onClick={() => saveFollowUp.mutate(new Date(followUpDate).toISOString())}
                        >
                          <Bell className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )}
                  </div>
                )
              })()}

              <Separator />

              {/* ── 4. ACCIONES RÁPIDAS ─────────────────────────────────── */}
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
                    disabled={logActivity.isPending || isGanadoLocked}
                  >
                    <Phone className="h-3.5 w-3.5 text-blue-500" /> Llamé
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="justify-start gap-2"
                    onClick={() => logActivity.mutate({ type: 'NOTE', description: 'WhatsApp enviado' })}
                    disabled={logActivity.isPending || isGanadoLocked}
                  >
                    <MessageSquare className="h-3.5 w-3.5 text-green-500" /> WhatsApp
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="justify-start gap-2 border-green-200 text-green-700 hover:bg-green-50 disabled:opacity-50"
                    onClick={() => closeDealMutation.mutate({ status: 'WON' })}
                    disabled={closeDealMutation.isPending || isClosed || isGanadoLocked}
                  >
                    <Trophy className="h-3.5 w-3.5" /> Ganado
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="justify-start gap-2 border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50"
                    onClick={handleLost}
                    disabled={closeDealMutation.isPending || isClosed || isGanadoLocked}
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
                        onClick={() => { setShowLostInput(false); setClosingReason('') }}
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

              {/* Vendedor asignado — admin/manager only */}
              {isAdminOrManager && (
                <>
                  <Separator />
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Vendedor asignado
                    </p>
                    <Select
                      value={deal.assignedToId ?? ''}
                      onValueChange={(v) => v && assignDeal.mutate(v)}
                      disabled={assignDeal.isPending || isGanadoLocked}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Sin asignar" />
                      </SelectTrigger>
                      <SelectContent>
                        {users.map((u) => (
                          <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}

              <Separator />

              {/* ── 5. DATOS DEL SEGURO (solo lectura) ──────────────────── */}
              <div className="space-y-1.5">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Datos del seguro
                </p>
                {insuranceEntries.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    {isGanadoLocked ? 'Sin datos registrados.' : 'Se completarán al mover el deal a Ganado.'}
                  </p>
                ) : (
                  <div className="space-y-2">
                    {insuranceEntries.map((entry, idx) => (
                      <div key={entry.id} className="rounded-md border text-sm">
                        {insuranceEntries.length > 1 && (
                          <div className="border-b px-3 py-1.5 text-xs font-semibold text-muted-foreground">
                            Cliente {idx + 1}
                          </div>
                        )}
                        <div className="divide-y">
                          {([
                            ['Titular', entry.holderName],
                            ['Plan', entry.plan],
                            ['Aseguradora', entry.aseguradora],
                            ['Forma de pago', formatPaymentFrequency(entry.paymentFrequency)],
                            ['Fecha de emisión', entry.issueDate
                              ? format(new Date(entry.issueDate), "d MMM yyyy", { locale: es })
                              : undefined],
                            ['Prima neta', entry.netPremium != null
                              ? formatCurrency(entry.netPremium)
                              : undefined],
                          ] as [string, string | undefined][]).map(([label, value]) => (
                            <div key={label} className="flex items-center justify-between px-3 py-2">
                              <span className="text-muted-foreground">{label}</span>
                              <span className="font-medium">{value ?? '—'}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <Separator />

              {/* ── 6. OPORTUNIDADES FUTURAS (solo en etapa Ganado) ──────── */}
              {deal.stageId === WON_STAGE_ID && (() => {
                const futureOpps = (deal.customFields?.futureOpportunities as FutureOpportunity[]) ?? []
                return (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Oportunidades futuras
                      </p>
                      {!addingOpportunity && (
                        <button
                          onClick={() => setAddingOpportunity(true)}
                          className="flex items-center gap-1 text-xs text-primary hover:underline"
                        >
                          <Plus className="h-3 w-3" /> Agregar oportunidad
                        </button>
                      )}
                    </div>

                    {futureOpps.map((opp) => (
                      <div key={opp.id} className="rounded-md border px-3 py-2.5 text-sm">
                        <div className="flex items-start justify-between">
                          <div className="min-w-0">
                            <span className="font-medium">
                              Seguro de {INSURANCE_TYPE_LABELS[opp.insuranceType] ?? opp.insuranceType}
                            </span>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              📅 {format(new Date(opp.contactDate), "d MMM yyyy, HH:mm", { locale: es })}
                            </p>
                            {opp.note && (
                              <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{opp.note}</p>
                            )}
                          </div>
                          <button
                            onClick={() => removeOpportunityMutation.mutate(opp.id)}
                            disabled={removeOpportunityMutation.isPending}
                            className="ml-2 flex h-5 w-5 shrink-0 items-center justify-center rounded hover:bg-muted"
                          >
                            <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-red-500" />
                          </button>
                        </div>
                      </div>
                    ))}

                    {futureOpps.length === 0 && !addingOpportunity && (
                      <p className="text-xs text-muted-foreground">
                        Sin oportunidades registradas.
                      </p>
                    )}

                    {addingOpportunity && (
                      <div className="space-y-2 rounded-md border p-3">
                        <div className="space-y-1">
                          <label className="text-xs text-muted-foreground">Tipo de seguro</label>
                          <Select
                            value={newOppInsuranceType}
                            onValueChange={(v) => setNewOppInsuranceType(v as typeof newOppInsuranceType)}
                          >
                            <SelectTrigger className="h-8 text-sm">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="AUTO">Auto</SelectItem>
                              <SelectItem value="VIDA">Vida</SelectItem>
                              <SelectItem value="PATRIMONIO">Patrimonio</SelectItem>
                              <SelectItem value="SALUD">Salud</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs text-muted-foreground">Fecha y hora de contacto</label>
                          <input
                            type="datetime-local"
                            value={newOppContactDate}
                            onChange={(e) => setNewOppContactDate(e.target.value)}
                            min={toDatetimeLocal(new Date().toISOString())}
                            className="w-full rounded-md border bg-background px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs text-muted-foreground">Nota (opcional)</label>
                          <Textarea
                            value={newOppNote}
                            onChange={(e) => setNewOppNote(e.target.value)}
                            placeholder="Motivo o detalle de la oportunidad..."
                            className="min-h-[60px] text-sm"
                          />
                        </div>
                        <div className="flex gap-1.5">
                          <Button
                            size="sm"
                            className="h-7 gap-1 px-2 text-xs"
                            onClick={() =>
                              addOpportunityMutation.mutate({
                                insuranceType: newOppInsuranceType,
                                contactDate: newOppContactDate,
                                note: newOppNote,
                              })
                            }
                            disabled={addOpportunityMutation.isPending || !newOppContactDate}
                          >
                            <Check className="h-3 w-3" /> Guardar
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-xs"
                            onClick={() => {
                              setAddingOpportunity(false)
                              setNewOppInsuranceType('SALUD')
                              setNewOppContactDate('')
                              setNewOppNote('')
                            }}
                          >
                            Cancelar
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })()}

              <Separator />

              {/* ── Notas de actividad ───────────────────────────────────── */}
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Notas
                </p>
                <Textarea
                  placeholder="Escribe una nota..."
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  disabled={isGanadoLocked}
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
                  disabled={saveNote.isPending || !noteText.trim() || isGanadoLocked}
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
                            <span>{format(new Date(note.createdAt), "d MMM yyyy, HH:mm", { locale: es })}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                })()}
              </div>

              <Separator />

              {/* ── Zona de peligro — SUPER_ADMIN only ──────────────────── */}
              {userRole === 'SUPER_ADMIN' && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Zona de peligro
                    </p>
                    {!showDeleteConfirm ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full justify-start gap-2 border-red-200 text-red-600 hover:bg-red-50"
                        onClick={() => setShowDeleteConfirm(true)}
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Eliminar deal
                      </Button>
                    ) : (
                      <div className="rounded-lg border border-red-200 bg-red-50 p-3 space-y-2">
                        <p className="text-sm font-medium text-red-800">¿Estás seguro?</p>
                        <p className="text-xs text-red-600">Esta acción eliminará el deal y su contacto asociado. No se puede deshacer.</p>
                        <div className="flex gap-2 pt-1">
                          <Button
                            size="sm"
                            variant="destructive"
                            className="flex-1"
                            onClick={() => deleteDealMutation.mutate()}
                            disabled={deleteDealMutation.isPending}
                          >
                            {deleteDealMutation.isPending ? 'Eliminando...' : 'Sí, eliminar'}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setShowDeleteConfirm(false)}
                            disabled={deleteDealMutation.isPending}
                          >
                            Cancelar
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* ── Historial de actividades ─────────────────────────────── */}
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
                            {ACTIVITY_ICON[act.type] ?? <FileText className="h-3.5 w-3.5 text-gray-400" />}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs leading-snug">{act.description}</p>
                            <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                              {act.user && <span>{act.user.name}</span>}
                              {act.user && <span>·</span>}
                              <span>
                                {formatDistanceToNow(new Date(act.createdAt), { addSuffix: true, locale: es })}
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
        )}
      </div>
    </>
  )
}
