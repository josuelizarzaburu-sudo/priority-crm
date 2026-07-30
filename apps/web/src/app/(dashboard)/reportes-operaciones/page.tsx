import { exigirRol, OPS_Y_ADMIN } from '@/lib/exigir-rol'
import type { Metadata } from 'next'
import { ReportesOperacionesPage } from '@/components/reportes-operaciones/reportes-operaciones-page'

export const metadata: Metadata = { title: 'Reportes de Operaciones' }

export default async function Page() {
  await exigirRol(OPS_Y_ADMIN)

  return (
    <div className="flex h-full flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: '#0C2057' }}>
          Reportes de Operaciones
        </h1>
        <p className="text-sm text-muted-foreground">
          Descarga la información de clientes, pólizas y reclamos en Excel.
        </p>
      </div>
      <ReportesOperacionesPage />
    </div>
  )
}
