'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'

export function SettingsTabs() {
  return (
    <Tabs defaultValue="profile">
      <TabsList className="mb-6">
        <TabsTrigger value="profile">Profile</TabsTrigger>
        <TabsTrigger value="notifications">Notifications</TabsTrigger>
        <TabsTrigger value="integrations">Integrations</TabsTrigger>
        <TabsTrigger value="security">Security</TabsTrigger>
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

function ProfileTab() {
  const { data: session } = useSession()
  const [name, setName] = useState(session?.user?.name ?? '')
  const [email, setEmail] = useState(session?.user?.email ?? '')

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile</CardTitle>
        <CardDescription>Update your personal information</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Full name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
        </div>
        <Button>Save changes</Button>
      </CardContent>
    </Card>
  )
}

function NotificationsTab() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Notifications</CardTitle>
        <CardDescription>Configure how you receive notifications</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {[
          { label: 'New message received', description: 'Get notified when a contact sends a message' },
          { label: 'Deal stage changed', description: 'Notify when a deal moves to a new stage' },
          { label: 'Automation triggered', description: 'Get notified when an automation runs' },
          { label: 'New contact created', description: 'Notify when a new contact is added' },
        ].map(({ label, description }) => (
          <div key={label} className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">{label}</p>
              <p className="text-xs text-muted-foreground">{description}</p>
            </div>
            <Switch defaultChecked />
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

function IntegrationsTab() {
  const integrations = [
    {
      name: 'WhatsApp Business',
      description: 'Send and receive WhatsApp messages',
      status: 'connected',
      env: 'WHATSAPP_ACCESS_TOKEN',
    },
    {
      name: 'Email (SMTP)',
      description: 'Send emails via SMTP server',
      status: 'connected',
      env: 'SMTP_HOST',
    },
    {
      name: 'Claude AI',
      description: 'AI-powered features and suggestions',
      status: 'connected',
      env: 'ANTHROPIC_API_KEY',
    },
    {
      name: 'Twilio Voice',
      description: 'VoIP calls and SMS',
      status: 'disconnected',
      env: 'TWILIO_ACCOUNT_SID',
    },
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle>Integrations</CardTitle>
        <CardDescription>Connect your external services</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {integrations.map((integration, i) => (
          <div key={integration.name}>
            {i > 0 && <Separator className="mb-4" />}
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium">{integration.name}</p>
                  <Badge
                    variant={integration.status === 'connected' ? 'default' : 'secondary'}
                    className="text-xs"
                  >
                    {integration.status}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">{integration.description}</p>
              </div>
              <Button variant="outline" size="sm">
                {integration.status === 'connected' ? 'Configure' : 'Connect'}
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

function SecurityTab() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Security</CardTitle>
        <CardDescription>Manage your password and session</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label>Current password</Label>
          <Input type="password" placeholder="••••••••" />
        </div>
        <div className="space-y-1.5">
          <Label>New password</Label>
          <Input type="password" placeholder="••••••••" />
        </div>
        <div className="space-y-1.5">
          <Label>Confirm new password</Label>
          <Input type="password" placeholder="••••••••" />
        </div>
        <Button>Update password</Button>
      </CardContent>
    </Card>
  )
}
