import type { Metadata } from 'next'
import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { ReferidosPage } from '@/components/referidos/referidos-page'

export const metadata: Metadata = { title: 'Referidos' }

const PUEDE = ['SUPER_ADMIN', 'OWNER', 'MANAGER', 'JEFE_OPERACIONES']

export default async function Page() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')
  if (!PUEDE.includes((session.user as any)?.role)) redirect('/clientes')
  return <ReferidosPage />
}
