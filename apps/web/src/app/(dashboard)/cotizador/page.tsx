import { exigirRol, COMUNES } from '@/lib/exigir-rol'
import type { Metadata } from 'next'
import { CotizadorPage } from '@/components/cotizador/cotizador-page'

export const metadata: Metadata = { title: 'Cotizador' }

// Abierto a todos los usuarios con sesion (vendedores, operaciones, admin).
// La autenticacion la exige el layout de (dashboard).
export default async function Page() {
  await exigirRol([...COMUNES, 'SUPER_ADMIN'])

  return <CotizadorPage />
}
