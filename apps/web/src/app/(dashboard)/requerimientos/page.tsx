import { exigirRol, OPS_Y_ADMIN } from '@/lib/exigir-rol'
import type { Metadata } from 'next'
import { RequerimientosTable } from '@/components/requerimientos/requerimientos-table'
import { NuevoRequerimiento } from '@/components/requerimientos/nuevo-requerimiento'

export const metadata: Metadata = { title: 'Requerimientos' }

export default async function RequerimientosPage() {
  await exigirRol(OPS_Y_ADMIN)

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#0C2057' }}>
            Requerimientos
          </h1>
          <p className="text-sm text-muted-foreground">
            Gestiones administrativas del cliente. Haz clic en las tarjetas para filtrar
            por estado.
          </p>
        </div>
        <NuevoRequerimiento />
      </div>
      <RequerimientosTable />
    </div>
  )
}
