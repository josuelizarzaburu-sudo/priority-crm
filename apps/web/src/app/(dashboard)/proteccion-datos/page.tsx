import type { Metadata } from 'next'
import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { ConsentimientosPage } from '@/components/consentimientos/consentimientos-page'

export const metadata: Metadata = { title: 'Protección de datos' }

// Gerencia y operaciones: son quienes responden ante la autoridad y quienes
// hacen el seguimiento de los que faltan.
const PUEDE = ['SUPER_ADMIN', 'OWNER', 'JEFE_OPERACIONES']

export default async function Page() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')
  if (!PUEDE.includes((session.user as any)?.role)) redirect('/clientes')
  return <ConsentimientosPage />
}
