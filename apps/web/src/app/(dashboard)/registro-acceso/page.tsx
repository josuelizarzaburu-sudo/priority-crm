import { exigirRol } from '@/lib/exigir-rol'
import type { Metadata } from 'next'
import { RegistroAccesoPage } from '@/components/registro-acceso/registro-acceso-page'

export const metadata: Metadata = { title: 'Registro de acceso' }

export default async function Page() {
  // Informacion sensible en si misma: revela que clientes se consultan. Solo admin.
  await exigirRol(['SUPER_ADMIN', 'OWNER'])
  return (
    <div className="flex h-full flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: '#0C2057' }}>
          Registro de acceso
        </h1>
        <p className="text-sm text-muted-foreground">
          Quién abrió qué ficha y quién exportó reportes con datos de clientes.
        </p>
      </div>
      <RegistroAccesoPage />
    </div>
  )
}
