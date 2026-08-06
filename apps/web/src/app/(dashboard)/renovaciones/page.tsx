import { exigirRol, OPS_Y_ADMIN } from '@/lib/exigir-rol'
import type { Metadata } from 'next'
import { RenovacionesPage } from '@/components/renovaciones/renovaciones-page'

export const metadata: Metadata = { title: 'Renovaciones' }

export default async function Page() {
  await exigirRol(OPS_Y_ADMIN)
  return (
    <div className="flex h-full flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: '#0C2057' }}>
          Renovaciones
        </h1>
        <p className="text-sm text-muted-foreground">
          Una renovación por póliza, un año después de la vigencia. Elige el mes para
          trabajarlo por adelantado.
        </p>
      </div>
      <RenovacionesPage />
    </div>
  )
}
