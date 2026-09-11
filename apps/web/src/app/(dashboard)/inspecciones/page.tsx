import type { Metadata } from 'next'
import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { InspeccionesPage } from '@/components/inspecciones/inspecciones-page'

export const metadata: Metadata = { title: 'Inspecciones de vehículos' }

// Fidelizacion y gerencia: las inspecciones las gestiona Gianella.
const PUEDE = ['SUPER_ADMIN', 'OWNER', 'JEFE_OPERACIONES', 'OPERACIONES']

export default async function Page() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')
  if (!PUEDE.includes((session.user as any)?.role)) redirect('/clientes')
  return <InspeccionesPage />
}
