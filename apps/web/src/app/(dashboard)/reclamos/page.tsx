import { exigirRol, OPS_Y_ADMIN } from '@/lib/exigir-rol'
import type { Metadata } from 'next'
import { ReclamosTable } from '@/components/reclamos/reclamos-table'
import { NuevoReclamo } from '@/components/reclamos/nuevo-reclamo'

export const metadata: Metadata = { title: 'Reembolsos' }

export default async function ReclamosPage() {
  await exigirRol(OPS_Y_ADMIN)

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#0C2057' }}>
            Reembolsos
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
