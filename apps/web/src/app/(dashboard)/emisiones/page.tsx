import type { Metadata } from 'next'
import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { EmisionesPage } from '@/components/emisiones/emisiones-page'

export const metadata: Metadata = { title: 'Emisiones de vehículos' }

// Fidelizacion y gerencia: las emisiones de auto las lleva Gianella, no las
// ejecutivas de salud.
const PUEDE = ['SUPER_ADMIN', 'OWNER', 'JEFE_OPERACIONES', 'OPERACIONES']

export default async function Page() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')
  if (!PUEDE.includes((session.user as any)?.role)) redirect('/clientes')
  return <EmisionesPage />
}
