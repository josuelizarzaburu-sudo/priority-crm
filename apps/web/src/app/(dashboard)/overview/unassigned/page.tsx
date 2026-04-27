import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { UnassignedLeads } from '@/components/leads/unassigned-leads'

export const metadata: Metadata = { title: 'Leads sin asignar' }

export default function UnassignedPage() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Link
          href="/overview"
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Overview
        </Link>
      </div>

      <div>
        <h1 className="text-2xl font-bold">Leads sin asignar</h1>
        <p className="text-sm text-muted-foreground">
          Leads pendientes de asignación a un agente
        </p>
      </div>

      <UnassignedLeads />
    </div>
  )
}
