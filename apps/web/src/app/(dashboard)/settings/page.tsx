import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

import { SettingsTabs } from '@/components/settings/settings-tabs'

export const metadata: Metadata = { title: 'Settings' }

// Solo administracion. Ocultar el enlace del menu no basta: sin esta comprobacion
// cualquiera que escriba /settings a mano llega igual a la pantalla.
export default async function SettingsPage() {
  const session = await getServerSession(authOptions)
  const rol = (session?.user as { role?: string } | undefined)?.role ?? ''
  if (!['SUPER_ADMIN', 'OWNER'].includes(rol)) redirect('/')

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Manage your workspace preferences and integrations</p>
      </div>
      <SettingsTabs />
    </div>
  )
}
