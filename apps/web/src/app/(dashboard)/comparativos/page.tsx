import type { Metadata } from 'next'
import { Suspense } from 'react'
import { ComparativosPage } from '@/components/comparativos/comparativos-page'

export const metadata: Metadata = { title: 'Comparativos' }

// Abierto a todos los usuarios con sesion (vendedores, operaciones, admin).
// La autenticacion la exige el layout de (dashboard).
export default function Page() {
  return (
    <Suspense fallback={null}>
      <ComparativosPage />
    </Suspense>
  )
}
