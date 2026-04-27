'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSession } from 'next-auth/react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Trash2, Loader2, ShieldCheck, Users, UserCog } from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
import { Separator } from '@/components/ui/separator'
import { api } from '@/lib/api'
import { getInitials, formatDate } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'

// ─── Types ────────────────────────────────────────────────────────────────────

type SystemRole = 'ADMIN' | 'MANAGER' | 'MEMBER'

interface TeamMember {
  id: string
  name: string
  email: string
  role: SystemRole
  avatar: string | null
  createdAt: string
}

// ─── Role metadata ────────────────────────────────────────────────────────────

const ROLE_CONFIG: Record<SystemRole, { label: string; description: string; icon: React.ElementType; variant: 'default' | 'secondary' | 'outline' }> = {
  ADMIN: {
    label: 'Administrador',
    description: 'Acceso total al sistema',
    icon: ShieldCheck,
    variant: 'default',
  },
  MANAGER: {
    label: 'Jefe de operaciones',
    description: 'Gestión de equipo y asignación de leads',
    icon: UserCog,
    variant: 'secondary',
  },
  MEMBER: {
    label: 'Agente / Vendedor',
    description: 'Solo ve sus propios deals',
    icon: Users,
    variant: 'outline',
  },
}

// ─── Form schema ──────────────────────────────────────────────────────────────

const schema = z.object({
  name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
  email: z.string().email('Ingresa un email válido'),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
  role: z.enum(['ADMIN', 'MANAGER', 'MEMBER'], { required_error: 'Selecciona un rol' }),
})

type FormValues = z.infer<typeof schema>

// ─── Main component ───────────────────────────────────────────────────────────

export function UsersManagement() {
  const { data: session } = useSession()
  const callerRole = (session?.user as any)?.role as SystemRole | undefined
  const callerId = session?.user?.id

  const { data: members = [], isLoading } = useQuery<TeamMember[]>({
    queryKey: ['users'],
    queryFn: () => api.get('/users').then((r) => r.data),
  })

  return (
    <div className="space-y-6">
      {/* Create form — visible to ADMIN and MANAGER */}
      {(callerRole === 'ADMIN' || callerRole === 'MANAGER') && (
        <CreateMemberForm callerRole={callerRole} />
      )}

      {/* Team list */}
      <Card>
        <CardHeader>
          <CardTitle>Miembros del equipo</CardTitle>
          <CardDescription>{members.length} usuario{members.length !== 1 ? 's' : ''} en la organización</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Cargando...
            </div>
          ) : members.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">No hay usuarios todavía.</p>
          ) : (
            <ul>
              {members.map((member, i) => (
                <li key={member.id}>
                  {i > 0 && <Separator />}
                  <MemberRow
                    member={member}
                    isSelf={member.id === callerId}
                    callerRole={callerRole}
                  />
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ─── Create member form ───────────────────────────────────────────────────────

function CreateMemberForm({ callerRole }: { callerRole: SystemRole }) {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  const selectedRole = watch('role')

  const createMutation = useMutation({
    mutationFn: (data: FormValues) => api.post('/users', data),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      toast({ title: 'Usuario creado', description: `${res.data.name} fue agregado al equipo.` })
      reset()
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message ?? 'No se pudo crear el usuario.'
      toast({ title: 'Error', description: Array.isArray(msg) ? msg.join(', ') : msg, variant: 'destructive' })
    },
  })

  // Managers cannot create admins
  const availableRoles = (Object.keys(ROLE_CONFIG) as SystemRole[]).filter(
    (r) => !(r === 'ADMIN' && callerRole !== 'ADMIN'),
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Plus className="h-5 w-5" />
          Agregar usuario
        </CardTitle>
        <CardDescription>Crea un nuevo miembro del equipo y asígnale un rol</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit((d) => createMutation.mutate(d))} className="space-y-4">
          {/* Role picker — first so user sets context before filling details */}
          <div className="space-y-2">
            <Label>Rol *</Label>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {availableRoles.map((role) => {
                const { label, description, icon: Icon } = ROLE_CONFIG[role]
                const active = selectedRole === role
                return (
                  <button
                    key={role}
                    type="button"
                    onClick={() => setValue('role', role, { shouldValidate: true })}
                    className={[
                      'flex items-start gap-3 rounded-lg border-2 p-3 text-left transition-all hover:border-primary/60',
                      active ? 'border-primary bg-primary/5' : 'border-border',
                    ].join(' ')}
                  >
                    <Icon className={['mt-0.5 h-4 w-4 shrink-0', active ? 'text-primary' : 'text-muted-foreground'].join(' ')} />
                    <div>
                      <p className={['text-sm font-medium', active ? 'text-primary' : ''].join(' ')}>{label}</p>
                      <p className="text-xs text-muted-foreground">{description}</p>
                    </div>
                  </button>
                )
              })}
            </div>
            {errors.role && <p className="text-xs text-destructive">{errors.role.message}</p>}
          </div>

          <Separator />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="name">Nombre completo *</Label>
              <Input id="name" placeholder="Ana Martínez" {...register('name')} />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="email">Email *</Label>
              <Input id="email" type="email" placeholder="ana@empresa.com" {...register('email')} />
              {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="password">Contraseña temporal *</Label>
              <Input id="password" type="password" placeholder="Mínimo 8 caracteres" {...register('password')} />
              {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
              Crear usuario
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

// ─── Member row ───────────────────────────────────────────────────────────────

function MemberRow({
  member,
  isSelf,
  callerRole,
}: {
  member: TeamMember
  isSelf: boolean
  callerRole: SystemRole | undefined
}) {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const { label, variant } = ROLE_CONFIG[member.role] ?? { label: member.role, variant: 'outline' as const }

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/users/${member.id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      toast({ title: 'Usuario eliminado', description: `${member.name} fue removido del equipo.` })
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message ?? 'No se pudo eliminar el usuario.'
      toast({ title: 'Error', description: msg, variant: 'destructive' })
    },
  })

  return (
    <div className="flex items-center gap-4 px-6 py-4">
      <Avatar className="h-9 w-9 shrink-0">
        <AvatarFallback className="text-sm">{getInitials(member.name)}</AvatarFallback>
      </Avatar>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-sm">{member.name}</span>
          {isSelf && (
            <Badge variant="outline" className="text-xs">Tú</Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground truncate">{member.email}</p>
      </div>

      <div className="hidden sm:block text-xs text-muted-foreground shrink-0">
        Desde {formatDate(member.createdAt)}
      </div>

      <Badge variant={variant} className="shrink-0 text-xs">
        {label}
      </Badge>

      {/* Delete — only ADMIN, cannot delete self */}
      {callerRole === 'ADMIN' && !isSelf && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <Trash2 className="h-4 w-4" />}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Eliminar a {member.name}?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta acción no se puede deshacer. El usuario perderá acceso inmediatamente.
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
      )}
    </div>
  )
}
