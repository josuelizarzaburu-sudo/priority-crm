import type { Metadata } from 'next'
import { SettingsTabs } from '@/components/settings/settings-tabs'

export const metadata: Metadata = { title: 'Settings' }

export default function SettingsPage() {
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
