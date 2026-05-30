'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSession } from 'next-auth/react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Trash2, Loader2, ShieldCheck, Users, UserCog, Crown, Phone, Check, X } from 'lucide-react'
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

type SystemRole = 'SUPER_ADMIN' | 'OWNER' | 'MANAGER' | 'SALES_REP'

interface TeamMember {
  id: string
  name: string
  email: string
  phone: string | null
  role: SystemRole
  avatar: string | null
  createdAt: string
}

// ─── Role metadata ────────────────────────────────────────────────────────────

const ROLE_CONFIG: Record<SystemRole, { label: string; description: string; icon: React.ElementType; variant: 'default' | 'secondary' | 'outline' }> = {
  SUPER_ADMIN: {
    label: 'Super Admin',
    description: 'Acceso total al sistema y configuración técnica',
    icon: ShieldCheck,
    variant: 'default',
  },
  OWNER: {
    label: 'Owner',
    description: 'Dueño del negocio — acceso completo excepto config técnica',
    icon: Crown,
    variant: 'default',
  },
  MANAGER: {
    label: 'Jefa de operaciones',
    description: 'Gestión de equipo, asignación de leads y reportes',
    icon: UserCog,
    variant: 'secondary',
  },
  SALES_REP: {
    label: 'Vendedor',
    description: 'Solo ve y gestiona sus propios deals',
    icon: Users,
    variant: 'outline',
  },
}

// Solo SUPER_ADMIN puede crear usuarios
const CREATABLE_BY: Record<SystemRole, SystemRole[]> = {
  SUPER_ADMIN: ['SUPER_ADMIN', 'OWNER', 'MANAGER', 'SALES_REP'],
  OWNER:       [],
  MANAGER:     [],
  SALES_REP:   [],
}

// ─── Form schema ──────────────────────────────────────────────────────────────

const schema = z.object({
  name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
  email: z.string().email('Ingresa un email válido'),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
  role: z.enum(['SUPER_ADMIN', 'OWNER', 'MANAGER', 'SALES_REP'], { required_error: 'Selecciona un rol' }),
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
      {/* Create form — visible to roles that can create at least one other role */}
      {callerRole && (CREATABLE_BY[callerRole]?.length ?? 0) > 0 && (
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

  const availableRoles = CREATABLE_BY[callerRole] ?? []

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

  const [editingPhone, setEditingPhone] = useState(false)
  const [phoneValue, setPhoneValue] = useState(member.phone ?? '')

  const canEditPhone = callerRole === 'SUPER_ADMIN'

  const phoneMutation = useMutation({
    mutationFn: (phone: string | null) => api.patch(`/users/${member.id}/phone`, { phone }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      toast({ title: 'Teléfono actualizado' })
      setEditingPhone(false)
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message ?? 'No se pudo actualizar el teléfono.'
      toast({ title: 'Error', description: Array.isArray(msg) ? msg.join(', ') : msg, variant: 'destructive' })
    },
  })

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
          {isSelf && <Badge variant="outline" className="text-xs">Tú</Badge>}
        </div>
        <p className="text-xs text-muted-foreground truncate">{member.email}</p>

        {/* Phone — inline edit */}
        {editingPhone ? (
          <div className="mt-1.5 flex items-center gap-1.5">
            <Input
              value={phoneValue}
              onChange={(e) => setPhoneValue(e.target.value)}
              placeholder="+593XXXXXXXXX"
              className="h-7 w-40 text-xs"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') phoneMutation.mutate(phoneValue || null)
                if (e.key === 'Escape') { setEditingPhone(false); setPhoneValue(member.phone ?? '') }
              }}
            />
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 text-green-600"
              disabled={phoneMutation.isPending}
              onClick={() => phoneMutation.mutate(phoneValue || null)}
            >
              {phoneMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 text-muted-foreground"
              onClick={() => { setEditingPhone(false); setPhoneValue(member.phone ?? '') }}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        ) : (
          canEditPhone && (
            <button
              className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => setEditingPhone(true)}
            >
              <Phone className="h-3 w-3" />
              {member.phone ?? <span className="italic">Agregar teléfono</span>}
            </button>
          )
        )}
      </div>

      <div className="hidden sm:block text-xs text-muted-foreground shrink-0">
        Desde {formatDate(member.createdAt)}
      </div>

      <Badge variant={variant} className="shrink-0 text-xs">
        {label}
      </Badge>

      {/* Delete — only SUPER_ADMIN, cannot delete self */}
      {callerRole === 'SUPER_ADMIN' && !isSelf && (
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
