import type { Metadata } from 'next'
import { ManagerOverview } from '@/components/overview/manager-overview'

export const metadata: Metadata = { title: 'Overview del equipo' }

export default function OverviewPage() {
  return <ManagerOverview />
}
