import { exigirRol, ELEVATED } from '@/lib/exigir-rol'
import type { Metadata } from 'next'
import { AutomationsHeader } from '@/components/automations/automations-header'
import { AutomationsList } from '@/components/automations/automations-list'

export const metadata: Metadata = { title: 'Automations' }

export default async function AutomationsPage() {
  await exigirRol(ELEVATED)

  return (
    <div className="flex h-full flex-col gap-4">
      <AutomationsHeader />
      <AutomationsList />
    </div>
  )
}
