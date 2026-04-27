import type { Metadata } from 'next'
import { UnassignedLeads } from '@/components/leads/unassigned-leads'

export const metadata: Metadata = { title: 'Leads sin asignar' }

export default function LeadsPage() {
  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Leads sin asignar</h1>
          <p className="text-sm text-muted-foreground">
            Leads nuevos pendientes de asignación a un agente
          </p>
        </div>
      </div>
      <UnassignedLeads />
    </div>
  )
}
