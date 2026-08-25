'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSession } from 'next-auth/react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Trash2, Loader2, ShieldCheck, Users, UserCog, Crown, Pencil } from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
import { Separator } from '@/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { api } from '@/lib/api'
import { getInitials, formatDate } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'

// ─── Types ────────────────────────────────────────────────────────────────────

type SystemRole =
  | 'SUPER_ADMIN'
  | 'OWNER'
  | 'MANAGER'
  | 'JEFE_EQUIPO'
  | 'SALES_REP'
  | 'OPERACIONES'
  | 'JEFE_OPERACIONES'

interface TeamMember {
  id: string
  name: string
  email: string
  phone: string | null
  puedeCotizarPorOtros?: boolean
  puedeVender?: boolean
  puedePriorityHelp?: boolean
  role: SystemRole
  avatar: string | null
  createdAt: string
  /** Cuenta activa. false = no puede entrar, pero su historial se conserva. */
  activo?: boolean
  desactivadoEn?: string | null
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
  JEFE_EQUIPO: {
    label: 'Jefe de equipo',
    description: 'Reparte leads y supervisa a su equipo; también vende',
    icon: UserCog,
    variant: 'secondary',
  },
  SALES_REP: {
    label: 'Vendedor',
    description: 'Solo ve y gestiona sus propios deals',
    icon: Users,
    variant: 'outline',
  },
  // Perfiles del area de Operaciones. No se ofrecen al CREAR un usuario (el
  // formulario de alta usa su propia lista), pero si al editar, para poder mover
  // a alguien entre areas sin borrarlo y volverlo a crear.
  JEFE_OPERACIONES: {
    label: 'Jefe de operaciones',
    description: 'Ve todos los clientes y asigna ejecutivas',
    icon: UserCog,
    variant: 'secondary',
  },
  OPERACIONES: {
    label: 'Ejecutiva de cuenta',
    description: 'Ve solo los clientes que tiene asignados',
    icon: Users,
    variant: 'outline',
  },
}

/**
 * Roles que se ofrecen al CREAR un usuario.
 *
 * Los perfiles de Operaciones no estan aqui a proposito: se dan de alta desde su
 * propio flujo. Al EDITAR si aparecen todos, para poder mover a alguien de area
 * sin borrarlo y volverlo a crear.
 */
const ROLES_AL_CREAR = [
  'SUPER_ADMIN',
  'OWNER',
  'MANAGER',
  'JEFE_EQUIPO',
  'SALES_REP',
] as const satisfies readonly SystemRole[]

// ─── Form schemas ─────────────────────────────────────────────────────────────

const phoneRegex = /^\+\d{7,15}$/

const createSchema = z.object({
  name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
  email: z.string().email('Ingresa un email válido'),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
  role: z.enum(['SUPER_ADMIN', 'OWNER', 'MANAGER', 'JEFE_EQUIPO', 'SALES_REP'], { required_error: 'Selecciona un rol' }),
  phone: z.string().regex(phoneRegex, 'Formato inválido. Usa +593XXXXXXXXX').or(z.literal('')).optional(),
})

const editSchema = z.object({
  name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
  phone: z.string().regex(phoneRegex, 'Formato inválido. Usa +593XXXXXXXXX').or(z.literal('')).optional(),
})

type CreateFormValues = z.infer<typeof createSchema>
type EditFormValues = z.infer<typeof editSchema>

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
      {callerRole === 'SUPER_ADMIN' && <CreateMemberForm />}

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

function CreateMemberForm() {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateFormValues>({ resolver: zodResolver(createSchema) })

  const selectedRole = watch('role')

  const createMutation = useMutation({
    mutationFn: (data: CreateFormValues) =>
      api.post('/users', { ...data, phone: data.phone || undefined }),
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
          {/* Role picker */}
          <div className="space-y-2">
            <Label>Rol *</Label>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {ROLES_AL_CREAR.map((role) => {
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

            <div className="space-y-1.5">
              <Label htmlFor="phone">Teléfono WhatsApp</Label>
              <Input id="phone" placeholder="+593999999999" {...register('phone')} />
              {errors.phone
                ? <p className="text-xs text-destructive">{errors.phone.message}</p>
                : <p className="text-[11px] text-muted-foreground">Opcional · formato +593XXXXXXXXX</p>
              }
            </div>

            <div className="space-y-1.5">
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

// ─── Edit member dialog ───────────────────────────────────────────────────────

function EditMemberDialog({
  member,
  open,
  onClose,
}: {
  member: TeamMember
  open: boolean
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<EditFormValues>({
    resolver: zodResolver(editSchema),
    defaultValues: { name: member.name, phone: member.phone ?? '' },
  })

  // Permiso para emitir cotizaciones a nombre de otro asesor. Va aparte del
  // formulario porque es una casilla, no un campo de texto.
  const [puedeCotizarPorOtros, setPuedeCotizarPorOtros] = useState(
    member.puedeCotizarPorOtros === true,
  )

  // Permiso para gestionar negocios propios en Mi Pipeline. Solo tiene efecto en
  // los perfiles de Operaciones: los vendedores ya lo traen con el cargo.
  const [puedeVender, setPuedeVender] = useState(member.puedeVender === true)

  // Acceso a Priority Help. Se activa persona por persona porque cada consulta
  // al bot tiene costo: conviene abrirlo a quien de verdad lo va a usar en la
  // venta, no a todo un rol de golpe.
  const [puedePriorityHelp, setPuedePriorityHelp] = useState(
    member.puedePriorityHelp === true,
  )

  // El rol tambien se edita aqui. Antes solo se podia elegir al crear el usuario,
  // asi que para convertir a alguien en Jefe de equipo habia que borrarlo y
  // volverlo a crear.
  const [rol, setRol] = useState<string>(member.role)

  // Restablecer contraseña. Va aparte del formulario y con su propio boton: si
  // viajara junto al resto de campos seria facil cambiarla sin querer al guardar
  // cualquier otra cosa.
  const [nuevaPassword, setNuevaPassword] = useState('')
  const esPerfilOperativo = ['OPERACIONES', 'JEFE_OPERACIONES'].includes(rol)

  /**
   * Activar o desactivar la cuenta.
   *
   * El corte es inmediato: la sesion abierta en su telefono deja de funcionar al
   * instante, sin esperar a que caduque el token. Cambiar la contrasena no hacia
   * eso, que era el hueco real cuando alguien dejaba la empresa.
   */
  const estadoCuentaMutation = useMutation({
    mutationFn: (activo: boolean) => api.patch(`/users/${member.id}/estado`, { activo }),
    onSuccess: (_d, activo) => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      toast({
        title: activo ? 'Cuenta activada' : 'Cuenta desactivada',
        description: activo
          ? `${member.name} ya puede entrar de nuevo.`
          : `${member.name} quedó fuera del CRM al instante. Su historial se conserva.`,
      })
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message ?? 'No se pudo cambiar el estado.'
      toast({
        title: 'Error',
        description: Array.isArray(msg) ? msg.join(', ') : msg,
        variant: 'destructive',
      })
    },
  })

  /**
   * Borrar el PIN de alguien. Para cuando pierde el telefono o lo olvida sin
   * acordarse tampoco de la contrasena: la proxima vez que entre configura uno
   * nuevo, sin quedarse fuera esperando.
   */
  const borrarPinMutation = useMutation({
    mutationFn: () => api.delete(`/auth/pin/${member.id}`),
    onSuccess: () => {
      toast({
        title: 'PIN borrado',
        description: `${member.name} configurará uno nuevo la próxima vez que entre desde el celular.`,
      })
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message ?? 'No se pudo borrar el PIN.'
      toast({
        title: 'Error',
        description: Array.isArray(msg) ? msg.join(', ') : msg,
        variant: 'destructive',
      })
    },
  })

  const resetPasswordMutation = useMutation({
    mutationFn: () => api.patch(`/users/${member.id}/password`, { password: nuevaPassword }),
    onSuccess: () => {
      setNuevaPassword('')
      toast({
        title: 'Contraseña restablecida',
        description: `${member.name} debe entrar con la contraseña nueva.`,
      })
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message ?? 'No se pudo cambiar la contraseña.'
      toast({
        title: 'Error',
        description: Array.isArray(msg) ? msg.join(', ') : msg,
        variant: 'destructive',
      })
    },
  })

  const editMutation = useMutation({
    mutationFn: (data: EditFormValues) =>
      api.patch(`/users/${member.id}`, {
        name: data.name,
        phone: data.phone || null,
        puedeCotizarPorOtros,
        puedeVender,
        puedePriorityHelp,
        role: rol,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      toast({ title: 'Usuario actualizado' })
      onClose()
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message ?? 'No se pudo actualizar el usuario.'
      toast({ title: 'Error', description: Array.isArray(msg) ? msg.join(', ') : msg, variant: 'destructive' })
    },
  })

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      {/* Altura maxima y scroll: al agregar los bloques de estado de cuenta y
          PIN, el formulario crecio y ya no cabe en pantalla. Sin esto el
          contenido se desborda y no hay forma de llegar a los botones de abajo,
          sobre todo en portatiles. */}
      <DialogContent className="flex max-h-[90vh] flex-col sm:max-w-md">
        <DialogHeader className="shrink-0">
          <DialogTitle>Editar usuario</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={handleSubmit((d) => editMutation.mutate(d))}
          className="-mr-2 flex-1 space-y-4 overflow-y-auto pr-2 pt-2"
        >
          <div className="space-y-1.5">
            <Label htmlFor="edit-name">Nombre completo *</Label>
            <Input id="edit-name" {...register('name')} />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input value={member.email} disabled className="opacity-60" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-phone">Teléfono WhatsApp</Label>
            <Input id="edit-phone" placeholder="+593999999999" {...register('phone')} />
            {errors.phone
              ? <p className="text-xs text-destructive">{errors.phone.message}</p>
              : <p className="text-[11px] text-muted-foreground">Opcional · formato +593XXXXXXXXX</p>
            }
          </div>

          {/* Permiso sensible: con esto se puede emitir una cotizacion a nombre
              de otro asesor, asi que se explica que hace y queda apagado por
              defecto para todos. */}
          <div className="rounded-md border p-3">
            <label className="flex cursor-pointer items-start gap-2">
              <input
                type="checkbox"
                checked={puedeCotizarPorOtros}
                onChange={(e) => setPuedeCotizarPorOtros(e.target.checked)}
                className="mt-0.5"
              />
              <span>
                <span className="block text-sm font-medium">
                  Puede cotizar a nombre de otros
                </span>
                <span className="block text-[11px] text-muted-foreground">
                  Permite elegir el asesor que firma el comparativo. Actívalo solo
                  para quienes cotizan para el equipo.
                </span>
              </span>
            </label>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Rol</label>
            <Select value={rol} onValueChange={setRol}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(ROLE_CONFIG).map(([valor, cfg]) => (
                  <SelectItem key={valor} value={valor}>
                    {cfg.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {rol !== member.role && (
              <p className="text-[11px] text-amber-600">
                Debe cerrar sesión y volver a entrar para que el cambio surta efecto.
              </p>
            )}
          </div>

          {/* Solo se ofrece a los perfiles de Operaciones. Un vendedor ya gestiona
              sus negocios por su cargo, y mostrar la casilla ahi haria pensar que
              se le puede quitar el pipeline desmarcandola, que no es el caso. */}
          {esPerfilOperativo && (
            <div className="rounded-md border p-3">
              <label className="flex cursor-pointer items-start gap-2">
                <input
                  type="checkbox"
                  checked={puedeVender}
                  onChange={(e) => setPuedeVender(e.target.checked)}
                  className="mt-0.5"
                />
                <span>
                  <span className="block text-sm font-medium">
                    Puede vender (Mi Pipeline)
                  </span>
                  <span className="block text-[11px] text-muted-foreground">
                    Habilita Mi Pipeline para gestionar sus propios negocios. Solo
                    ve los que tiene asignados; no accede al pipeline general, ni a
                    comisiones, ni entra al ranking de vendedores.
                  </span>
                </span>
              </label>
            </div>
          )}

          <div className="rounded-md border p-3">
            <label className="flex cursor-pointer items-start gap-2">
              <input
                type="checkbox"
                checked={puedePriorityHelp}
                onChange={(e) => setPuedePriorityHelp(e.target.checked)}
                className="mt-0.5"
              />
              <span>
                <span className="block text-sm font-medium">
                  Acceso a Priority Help
                </span>
                <span className="block text-[11px] text-muted-foreground">
                  Consulta de coberturas, carencias y exclusiones durante la
                  venta. Cada consulta tiene costo, así que conviene activarlo a
                  quien lo vaya a usar de verdad. No cotiza: los precios siguen
                  saliendo del cotizador.
                </span>
              </span>
            </label>
          </div>

          {/* Estado de la cuenta. Va con borde rojo cuando esta desactivada para
              que se note de un vistazo al abrir la ficha. */}
          <div
            className="space-y-1.5 rounded-md border p-3"
            style={
              member.activo === false
                ? { borderColor: '#fca5a5', backgroundColor: '#fef2f2' }
                : undefined
            }
          >
            <label className="text-sm font-medium">Estado de la cuenta</label>
            {member.activo === false ? (
              <>
                <p className="text-[11px] text-red-800">
                  Desactivada
                  {member.desactivadoEn
                    ? ` el ${new Date(member.desactivadoEn).toLocaleDateString('es-EC')}`
                    : ''}
                  . No puede entrar al CRM, pero su historial se conserva.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  className="mt-1"
                  disabled={estadoCuentaMutation.isPending}
                  onClick={() => estadoCuentaMutation.mutate(true)}
                >
                  Reactivar cuenta
                </Button>
              </>
            ) : (
              <>
                <p className="text-[11px] text-muted-foreground">
                  Al desactivarla queda fuera del CRM <strong>al instante</strong>, incluso si
                  tiene la sesión abierta en su teléfono. No se borra nada: sus ventas, notas y
                  asignaciones se conservan.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  className="mt-1 border-red-200 text-red-700 hover:bg-red-50"
                  disabled={estadoCuentaMutation.isPending}
                  onClick={() => {
                    if (
                      confirm(
                        `¿Desactivar la cuenta de ${member.name}? Quedará fuera del CRM de inmediato. Podrás reactivarla cuando quieras.`,
                      )
                    ) {
                      estadoCuentaMutation.mutate(false)
                    }
                  }}
                >
                  Desactivar cuenta
                </Button>
              </>
            )}
          </div>

          <div className="space-y-1.5 rounded-md border p-3">
            <label className="text-sm font-medium">PIN del celular</label>
            <p className="text-[11px] text-muted-foreground">
              Bórralo si pierde el teléfono o si lo olvidó y tampoco recuerda su contraseña.
              Configurará uno nuevo la próxima vez que entre.
            </p>
            <Button
              type="button"
              variant="outline"
              className="mt-1"
              disabled={borrarPinMutation.isPending}
              onClick={() => {
                if (confirm(`¿Borrar el PIN de ${member.name}?`)) borrarPinMutation.mutate()
              }}
            >
              Borrar PIN
            </Button>
          </div>

          <div className="space-y-1.5 rounded-md border p-3">
            <label className="text-sm font-medium">Restablecer contraseña</label>
            <p className="text-[11px] text-muted-foreground">
              Se cambia de inmediato y por separado; no hace falta guardar el
              formulario. Avísale la contraseña nueva por un medio seguro.
            </p>
            <div className="flex items-center gap-2 pt-1">
              <Input
                type="text"
                autoComplete="off"
                placeholder="Mínimo 8 caracteres"
                value={nuevaPassword}
                onChange={(e) => setNuevaPassword(e.target.value)}
              />
              <Button
                type="button"
                variant="outline"
                className="shrink-0"
                disabled={nuevaPassword.length < 8 || resetPasswordMutation.isPending}
                onClick={() => resetPasswordMutation.mutate()}
              >
                Cambiar
              </Button>
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Guardar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
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
  const [editOpen, setEditOpen] = useState(false)

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
    <>
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
          {callerRole === 'SUPER_ADMIN' && member.phone && (
            <p className="text-xs text-muted-foreground">{member.phone}</p>
          )}
        </div>

        <div className="hidden sm:block text-xs text-muted-foreground shrink-0">
          Desde {formatDate(member.createdAt)}
        </div>

        {/* Marca de cuenta desactivada. En la lista, para poder ver de un
            vistazo quien ya no tiene acceso sin abrir ficha por ficha. */}
        {member.activo === false && (
          <Badge
            variant="outline"
            className="shrink-0 border-red-200 bg-red-50 text-xs text-red-700"
          >
            Desactivada
          </Badge>
        )}

        <Badge variant={variant} className="shrink-0 text-xs">
          {label}
        </Badge>

        {/* Edit — SUPER_ADMIN only */}
        {callerRole === 'SUPER_ADMIN' && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
            onClick={() => setEditOpen(true)}
          >
            <Pencil className="h-4 w-4" />
          </Button>
        )}

        {/* Delete — SUPER_ADMIN only, cannot delete self */}
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

      {callerRole === 'SUPER_ADMIN' && (
        <EditMemberDialog
          member={member}
          open={editOpen}
          onClose={() => setEditOpen(false)}
        />
      )}
    </>
  )
}
