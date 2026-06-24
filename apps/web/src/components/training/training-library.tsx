'use client'

import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSession } from 'next-auth/react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  PlayCircle,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  CheckCircle2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'

// ─── Types ────────────────────────────────────────────────────────────────────

type TrainingCategory = 'CRM_USAGE' | 'QUOTING_TOOLS' | 'VITALITY' | 'SALES_TECHNIQUES' | 'OTHER'

interface TrainingVideo {
  id: string
  title: string
  description?: string | null
  youtubeUrl: string
  category: TrainingCategory
  durationMinutes?: number | null
  createdAt: string
  createdBy?: { id: string; name: string }
  viewed: boolean
}

const CATEGORY_META: Record<TrainingCategory, string> = {
  CRM_USAGE: 'Uso del CRM',
  QUOTING_TOOLS: 'Cotizadores',
  VITALITY: 'Producto Vitality',
  SALES_TECHNIQUES: 'Técnicas de venta',
  OTHER: 'Otros',
}

const CATEGORY_ORDER = Object.keys(CATEGORY_META) as TrainingCategory[]

const MANAGE_ROLES = ['SUPER_ADMIN', 'OWNER', 'MANAGER']

// ─── YouTube helpers ────────────────────────────────────────────────────────────

function extractYoutubeId(url: string): string | null {
  try {
    const u = new URL(url.trim())
    if (u.hostname === 'youtu.be') {
      return u.pathname.slice(1).split('/')[0] || null
    }
    if (u.hostname.includes('youtube.com')) {
      if (u.pathname === '/watch') return u.searchParams.get('v')
      if (u.pathname.startsWith('/embed/')) return u.pathname.split('/embed/')[1]?.split('/')[0] || null
      if (u.pathname.startsWith('/shorts/')) return u.pathname.split('/shorts/')[1]?.split('/')[0] || null
    }
    return null
  } catch {
    return null
  }
}

function youtubeThumbnail(url: string): string | null {
  const id = extractYoutubeId(url)
  return id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : null
}

function youtubeEmbedSrc(url: string): string | null {
  const id = extractYoutubeId(url)
  return id ? `https://www.youtube.com/embed/${id}` : null
}

function formatDuration(min?: number | null): string | null {
  if (!min) return null
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m > 0 ? `${h}h ${m}min` : `${h}h`
}

// ─── Form schema ──────────────────────────────────────────────────────────────

const videoSchema = z.object({
  title: z.string().min(2, 'Mínimo 2 caracteres'),
  description: z.string().optional(),
  youtubeUrl: z.string()
    .min(1, 'Ingresa un link de YouTube')
    .refine((v) => !!extractYoutubeId(v), 'Link de YouTube no válido'),
  category: z.enum(['CRM_USAGE', 'QUOTING_TOOLS', 'VITALITY', 'SALES_TECHNIQUES', 'OTHER'], {
    required_error: 'Selecciona una categoría',
  }),
  durationMinutes: z.string().regex(/^\d*$/, 'Solo números').optional(),
})

type VideoFormValues = z.infer<typeof videoSchema>

// ─── Main component ───────────────────────────────────────────────────────────

export function TrainingLibrary() {
  const { data: session } = useSession()
  const role = (session?.user as any)?.role ?? 'SALES_REP'
  const canManage = MANAGE_ROLES.includes(role)

  const [formOpen, setFormOpen] = useState(false)
  const [editingVideo, setEditingVideo] = useState<TrainingVideo | null>(null)
  const [activeVideo, setActiveVideo] = useState<TrainingVideo | null>(null)

  const { data: videos = [], isLoading } = useQuery<TrainingVideo[]>({
    queryKey: ['training', 'videos'],
    queryFn: () => api.get('/training/videos').then((r) => r.data),
  })

  const grouped = useMemo(() => {
    const map = new Map<TrainingCategory, TrainingVideo[]>()
    for (const cat of CATEGORY_ORDER) map.set(cat, [])
    videos.forEach((v) => map.get(v.category)?.push(v))
    return map
  }, [videos])

  const totalViewed = videos.filter((v) => v.viewed).length

  function openCreate() {
    setEditingVideo(null)
    setFormOpen(true)
  }

  function openEdit(video: TrainingVideo) {
    setEditingVideo(video)
    setFormOpen(true)
  }

  return (
    <div className="flex h-full flex-col gap-0">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e8eaf0] bg-white px-6 py-4">
        <div className="flex items-center gap-3">
          <PlayCircle className="h-5 w-5 text-[#d3ac76]" />
          <div>
            <h1 className="text-lg font-semibold text-[#25324b]">Capacitaciones</h1>
            <p className="text-xs text-muted-foreground">
              {videos.length > 0 ? `${totalViewed} de ${videos.length} vistos` : 'Biblioteca de videos para el equipo'}
            </p>
          </div>
        </div>
        {canManage && (
          <Button onClick={openCreate} size="sm" className="bg-[#d3ac76] text-white hover:bg-[#c49a60]">
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Agregar video
          </Button>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Cargando...
          </div>
        ) : videos.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-center text-muted-foreground">
            <PlayCircle className="h-8 w-8 opacity-40" />
            <p className="text-sm">Todavía no hay videos de capacitación.</p>
            {canManage && (
              <Button onClick={openCreate} variant="outline" size="sm" className="mt-2">
                <Plus className="mr-1.5 h-3.5 w-3.5" /> Agregar el primero
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-8">
            {CATEGORY_ORDER.map((cat) => {
              const items = grouped.get(cat) ?? []
              if (items.length === 0) return null
              const viewedInCat = items.filter((v) => v.viewed).length
              return (
                <section key={cat}>
                  <div className="mb-3 flex items-center justify-between">
                    <h2 className="text-sm font-bold uppercase tracking-wide text-[#25324b]">
                      {CATEGORY_META[cat]}
                    </h2>
                    <Badge variant="outline" className="text-[11px] text-muted-foreground">
                      {viewedInCat} de {items.length} vistos
                    </Badge>
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {items.map((video) => (
                      <VideoCard
                        key={video.id}
                        video={video}
                        canManage={canManage}
                        onPlay={() => setActiveVideo(video)}
                        onEdit={() => openEdit(video)}
                      />
                    ))}
                  </div>
                </section>
              )
            })}
          </div>
        )}
      </div>

      {formOpen && (
        <VideoFormDialog
          open={formOpen}
          video={editingVideo}
          onClose={() => setFormOpen(false)}
        />
      )}

      {activeVideo && (
        <VideoPlayerModal video={activeVideo} onClose={() => setActiveVideo(null)} />
      )}
    </div>
  )
}

// ─── Video card ───────────────────────────────────────────────────────────────

function VideoCard({
  video,
  canManage,
  onPlay,
  onEdit,
}: {
  video: TrainingVideo
  canManage: boolean
  onPlay: () => void
  onEdit: () => void
}) {
  const qc = useQueryClient()
  const { toast } = useToast()
  const thumbnail = youtubeThumbnail(video.youtubeUrl)
  const duration = formatDuration(video.durationMinutes)

  const toggleViewed = useMutation({
    mutationFn: () =>
      video.viewed
        ? api.delete(`/training/videos/${video.id}/view`)
        : api.post(`/training/videos/${video.id}/view`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['training', 'videos'] }),
  })

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/training/videos/${video.id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['training', 'videos'] })
      toast({ title: 'Video eliminado' })
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message ?? 'No se pudo eliminar el video.'
      toast({ title: 'Error', description: msg, variant: 'destructive' })
    },
  })

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onPlay}
      onKeyDown={(e) => { if (e.key === 'Enter') onPlay() }}
      className="group relative cursor-pointer overflow-hidden rounded-xl border border-[#e8eaf0] bg-white transition-shadow hover:shadow-md"
    >
      <div className="relative aspect-video w-full overflow-hidden bg-[#f0f2f7]">
        {thumbnail ? (
          <img src={thumbnail} alt={video.title} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            <PlayCircle className="h-8 w-8 opacity-40" />
          </div>
        )}
        <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/20">
          <PlayCircle className="h-10 w-10 text-white opacity-0 drop-shadow transition-opacity group-hover:opacity-100" />
        </div>
        {duration && (
          <span className="absolute bottom-1.5 right-1.5 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-medium text-white">
            {duration}
          </span>
        )}
        {video.viewed && (
          <span className="absolute left-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-white shadow">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          </span>
        )}
      </div>

      <div className="p-3">
        <p className="line-clamp-2 text-sm font-semibold text-[#25324b]">{video.title}</p>
        {video.description && (
          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{video.description}</p>
        )}

        <div className="mt-2.5 flex items-center justify-between gap-2">
          <button
            onClick={(e) => { e.stopPropagation(); toggleViewed.mutate() }}
            disabled={toggleViewed.isPending}
            className={cn(
              'flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-medium transition-colors',
              video.viewed
                ? 'bg-green-50 text-green-700 hover:bg-green-100'
                : 'bg-[#f0f2f7] text-muted-foreground hover:bg-[#e8eaf0]',
            )}
          >
            <CheckCircle2 className="h-3 w-3" />
            {video.viewed ? 'Visto' : 'Marcar visto'}
          </button>

          {canManage && (
            <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-foreground"
                onClick={onEdit}
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    disabled={deleteMutation.isPending}
                  >
                    {deleteMutation.isPending
                      ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      : <Trash2 className="h-3.5 w-3.5" />}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>¿Eliminar "{video.title}"?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Esta acción no se puede deshacer.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      onClick={() => deleteMutation.mutate()}
                    >
                      Eliminar
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Player modal ─────────────────────────────────────────────────────────────

function VideoPlayerModal({ video, onClose }: { video: TrainingVideo; onClose: () => void }) {
  const qc = useQueryClient()
  const embedSrc = youtubeEmbedSrc(video.youtubeUrl)

  const toggleViewed = useMutation({
    mutationFn: () =>
      video.viewed
        ? api.delete(`/training/videos/${video.id}/view`)
        : api.post(`/training/videos/${video.id}/view`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['training', 'videos'] }),
  })

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="pr-6">{video.title}</DialogTitle>
        </DialogHeader>

        <div className="aspect-video w-full overflow-hidden rounded-lg bg-black">
          {embedSrc ? (
            <iframe
              key={video.id}
              src={embedSrc}
              title={video.title}
              className="h-full w-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-white/60">
              Link de YouTube no válido
            </div>
          )}
        </div>

        {video.description && (
          <p className="text-sm text-muted-foreground">{video.description}</p>
        )}

        <DialogFooter className="items-center sm:justify-between">
          <Badge variant="outline" className="text-[11px]">
            {CATEGORY_META[video.category]}
          </Badge>
          <Button
            variant={video.viewed ? 'outline' : 'default'}
            onClick={() => toggleViewed.mutate()}
            disabled={toggleViewed.isPending}
            className={!video.viewed ? 'bg-[#d3ac76] text-white hover:bg-[#c49a60]' : ''}
          >
            {toggleViewed.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <CheckCircle2 className="mr-1.5 h-4 w-4" />
            {video.viewed ? 'Visto' : 'Marcar como visto'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Create/Edit form dialog ──────────────────────────────────────────────────

function VideoFormDialog({
  open,
  video,
  onClose,
}: {
  open: boolean
  video: TrainingVideo | null
  onClose: () => void
}) {
  const qc = useQueryClient()
  const { toast } = useToast()
  const isEdit = !!video

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<VideoFormValues>({
    resolver: zodResolver(videoSchema),
    defaultValues: video
      ? {
          title: video.title,
          description: video.description ?? '',
          youtubeUrl: video.youtubeUrl,
          category: video.category,
          durationMinutes: video.durationMinutes ? String(video.durationMinutes) : '',
        }
      : { title: '', description: '', youtubeUrl: '', category: 'CRM_USAGE', durationMinutes: '' },
  })

  const selectedCategory = watch('category')

  const mutation = useMutation({
    mutationFn: (data: VideoFormValues) => {
      const payload = {
        title: data.title,
        description: data.description || undefined,
        youtubeUrl: data.youtubeUrl,
        category: data.category,
        durationMinutes: data.durationMinutes ? parseInt(data.durationMinutes, 10) : undefined,
      }
      return isEdit
        ? api.put(`/training/videos/${video!.id}`, payload)
        : api.post('/training/videos', payload)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['training', 'videos'] })
      toast({ title: isEdit ? 'Video actualizado' : 'Video agregado' })
      onClose()
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message ?? 'No se pudo guardar el video.'
      toast({ title: 'Error', description: Array.isArray(msg) ? msg.join(', ') : msg, variant: 'destructive' })
    },
  })

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar video' : 'Agregar video'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4 pt-1">
          <div className="space-y-1.5">
            <Label htmlFor="title">Título *</Label>
            <Input id="title" placeholder="Cómo mover un deal en el pipeline" {...register('title')} />
            {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="description">Descripción</Label>
            <Textarea id="description" rows={2} placeholder="Breve resumen del video" {...register('description')} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="youtubeUrl">Link de YouTube *</Label>
            <Input
              id="youtubeUrl"
              placeholder="https://www.youtube.com/watch?v=... o https://youtu.be/..."
              {...register('youtubeUrl')}
            />
            {errors.youtubeUrl
              ? <p className="text-xs text-destructive">{errors.youtubeUrl.message}</p>
              : <p className="text-[11px] text-muted-foreground">Funciona con links públicos o no listados</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Categoría *</Label>
              <Select value={selectedCategory} onValueChange={(v) => setValue('category', v as TrainingCategory, { shouldValidate: true })}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar..." />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORY_ORDER.map((cat) => (
                    <SelectItem key={cat} value={cat}>{CATEGORY_META[cat]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.category && <p className="text-xs text-destructive">{errors.category.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="durationMinutes">Duración (min)</Label>
              <Input id="durationMinutes" inputMode="numeric" placeholder="12" {...register('durationMinutes')} />
              {errors.durationMinutes && <p className="text-xs text-destructive">{errors.durationMinutes.message}</p>}
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={isSubmitting} className="bg-[#d3ac76] text-white hover:bg-[#c49a60]">
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEdit ? 'Guardar cambios' : 'Agregar video'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
