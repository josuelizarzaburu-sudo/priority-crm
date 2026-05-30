'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { Loader2, Bell, BellOff, BellRing } from 'lucide-react'
import { api } from '@/lib/api'
import { useToast } from '@/hooks/use-toast'
import { usePushSubscription } from '@/hooks/use-push-subscription'

export function SettingsTabs() {
  return (
    <Tabs defaultValue="profile">
      <TabsList className="mb-6">
        <TabsTrigger value="profile">Perfil</TabsTrigger>
        <TabsTrigger value="notifications">Notificaciones</TabsTrigger>
        <TabsTrigger value="integrations">Integraciones</TabsTrigger>
        <TabsTrigger value="security">Seguridad</TabsTrigger>
      </TabsList>

      <TabsContent value="profile">
        <ProfileTab />
      </TabsContent>

      <TabsContent value="notifications">
        <NotificationsTab />
      </TabsContent>

      <TabsContent value="integrations">
        <IntegrationsTab />
      </TabsContent>

      <TabsContent value="security">
        <SecurityTab />
      </TabsContent>
    </Tabs>
  )
}

// ─── Profile Tab ──────────────────────────────────────────────────────────────

function ProfileTab() {
  const { data: session } = useSession()
  const { toast } = useToast()

  const { data: me } = useQuery({
    queryKey: ['users', 'me'],
    queryFn: () => api.get('/users/me').then((r) => r.data),
    enabled: !!session?.user?.id,
  })

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')

  useEffect(() => {
    if (me) {
      setName(me.name ?? '')
      setPhone(me.phone ?? '')
    }
  }, [me])

  const mutation = useMutation({
    mutationFn: () => api.patch('/users/me', { name, phone: phone || null }),
    onSuccess: () => toast({ title: 'Perfil actualizado', description: 'Los cambios fueron guardados.' }),
    onError: (err: any) => {
      const msg = err?.response?.data?.message ?? 'No se pudo guardar.'
      toast({ title: 'Error', description: Array.isArray(msg) ? msg.join(', ') : msg, variant: 'destructive' })
    },
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>Perfil</CardTitle>
        <CardDescription>Actualiza tu información personal</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Nombre completo</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Tu nombre" />
          </div>
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input type="email" value={session?.user?.email ?? ''} disabled className="opacity-60" />
          </div>
          <div className="space-y-1.5">
            <Label>Teléfono WhatsApp</Label>
            <Input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+593XXXXXXXXX"
            />
            <p className="text-[11px] text-muted-foreground">
              Usado para notificaciones de leads y recordatorios de seguimiento
            </p>
          </div>
        </div>
        <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
          {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Guardar cambios
        </Button>
      </CardContent>
    </Card>
  )
}

// ─── Notifications Tab ────────────────────────────────────────────────────────

function NotificationsTab() {
  const { status, subscribe, unsubscribe } = usePushSubscription()
  const { toast } = useToast()

  async function handleToggle() {
    try {
      if (status === 'subscribed') {
        await unsubscribe()
        toast({ title: 'Notificaciones desactivadas' })
      } else {
        await subscribe()
        if (status !== 'denied') {
          toast({ title: 'Notificaciones activadas', description: 'Recibirás alertas de nuevos leads y recordatorios.' })
        }
      }
    } catch {
      toast({ title: 'Error', description: 'No se pudo cambiar el estado de notificaciones.', variant: 'destructive' })
    }
  }

  const statusConfig = {
    loading:     { label: 'Verificando…', icon: Loader2, disabled: true, spin: true },
    unsupported: { label: 'No soportado en este navegador', icon: BellOff, disabled: true, spin: false },
    denied:      { label: 'Permiso denegado en el navegador', icon: BellOff, disabled: true, spin: false },
    subscribed:  { label: 'Notificaciones activas', icon: BellRing, disabled: false, spin: false },
    unsubscribed:{ label: 'Notificaciones desactivadas', icon: Bell, disabled: false, spin: false },
  }[status]

  const Icon = statusConfig.icon

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Notificaciones push</CardTitle>
          <CardDescription>
            Recibe alertas en tu dispositivo cuando lleguen nuevos leads o recordatorios de seguimiento
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
            <div className="flex items-center gap-3">
              <div className={[
                'flex h-10 w-10 items-center justify-center rounded-full',
                status === 'subscribed' ? 'bg-green-100' : 'bg-muted',
              ].join(' ')}>
                <Icon className={[
                  'h-5 w-5',
                  statusConfig.spin ? 'animate-spin' : '',
                  status === 'subscribed' ? 'text-green-600' : 'text-muted-foreground',
                ].join(' ')} />
              </div>
              <div>
                <p className="text-sm font-medium">{statusConfig.label}</p>
                {status === 'denied' && (
                  <p className="text-xs text-muted-foreground">
                    Actívalas en Configuración del navegador → Permisos del sitio
                  </p>
                )}
                {status === 'subscribed' && (
                  <p className="text-xs text-muted-foreground">
                    Este dispositivo recibirá alertas de nuevos leads y recordatorios
                  </p>
                )}
              </div>
            </div>
            <Button
              variant={status === 'subscribed' ? 'outline' : 'default'}
              size="sm"
              onClick={handleToggle}
              disabled={statusConfig.disabled}
            >
              {status === 'subscribed' ? 'Desactivar' : 'Activar'}
            </Button>
          </div>
          {status === 'unsubscribed' && (
            <p className="mt-3 text-xs text-muted-foreground">
              Al activar, el navegador pedirá permiso para enviar notificaciones.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Qué notificaciones recibirás</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[
            { label: 'Nuevo lead entrante', description: 'Cuando llega un lead por WhatsApp o web' },
            { label: 'Lead asignado a ti', description: 'Cuando un manager te asigna un deal' },
            { label: 'Lead sin asignar (2 min)', description: 'Recordatorio si nadie tomó el lead' },
            { label: 'Recordatorio de seguimiento', description: '24h y 2h antes de una llamada programada' },
          ].map(({ label, description }) => (
            <div key={label} className="flex items-start gap-3">
              <div className="mt-0.5 h-2 w-2 rounded-full bg-primary shrink-0" />
              <div>
                <p className="text-sm font-medium">{label}</p>
                <p className="text-xs text-muted-foreground">{description}</p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}

// ─── Integrations Tab ─────────────────────────────────────────────────────────

function IntegrationsTab() {
  const integrations = [
    { name: 'WhatsApp Business', description: 'Envío y recepción de mensajes WhatsApp', status: 'connected', env: 'META_WHATSAPP_TOKEN' },
    { name: 'Resend (Email)', description: 'Notificaciones de email via Resend', status: 'connected', env: 'RESEND_API_KEY' },
    { name: 'Claude AI', description: 'Funcionalidades con inteligencia artificial', status: 'connected', env: 'ANTHROPIC_API_KEY' },
    { name: 'Twilio Voice', description: 'Llamadas VoIP y SMS', status: 'disconnected', env: 'TWILIO_ACCOUNT_SID' },
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle>Integraciones</CardTitle>
        <CardDescription>Servicios externos conectados</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {integrations.map((integration, i) => (
          <div key={integration.name}>
            {i > 0 && <Separator className="mb-4" />}
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium">{integration.name}</p>
                  <Badge variant={integration.status === 'connected' ? 'default' : 'secondary'} className="text-xs">
                    {integration.status === 'connected' ? 'Conectado' : 'Desconectado'}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">{integration.description}</p>
              </div>
              <Button variant="outline" size="sm">
                {integration.status === 'connected' ? 'Configurar' : 'Conectar'}
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

// ─── Security Tab ─────────────────────────────────────────────────────────────

function SecurityTab() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Seguridad</CardTitle>
        <CardDescription>Cambia tu contraseña</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label>Contraseña actual</Label>
          <Input type="password" placeholder="••••••••" />
        </div>
        <div className="space-y-1.5">
          <Label>Nueva contraseña</Label>
          <Input type="password" placeholder="••••••••" />
        </div>
        <div className="space-y-1.5">
          <Label>Confirmar nueva contraseña</Label>
          <Input type="password" placeholder="••••••••" />
        </div>
        <Button>Actualizar contraseña</Button>
      </CardContent>
    </Card>
  )
}
