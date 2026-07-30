import { exigirRol, ELEVATED } from '@/lib/exigir-rol'
import type { Metadata } from 'next'
import { ManagerOverview } from '@/components/overview/manager-overview'

export const metadata: Metadata = { title: 'Overview del equipo' }

export default async function OverviewPage() {
  await exigirRol(ELEVATED)

  return <ManagerOverview />
}
