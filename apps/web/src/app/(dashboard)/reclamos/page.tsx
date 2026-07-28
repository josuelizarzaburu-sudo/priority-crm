import type { Metadata } from 'next'
import { ReclamosTable } from '@/components/reclamos/reclamos-table'
import { NuevoReclamo } from '@/components/reclamos/nuevo-reclamo'

export const metadata: Metadata = { title: 'Reclamos' }

export default function ReclamosPage() {
  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#0C2057' }}>
            Reclamos
          </h1>
          <p className="text-sm text-muted-foreground">
            Reembolsos y siniestros. Haz clic en las tarjetas para filtrar por estado.
          </p>
        </div>
        <NuevoReclamo />
      </div>
      <ReclamosTable />
    </div>
  )
}
