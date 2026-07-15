import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { ComparativosPage } from '@/components/comparativos/comparativos-page'

export const metadata: Metadata = { title: 'Comparativos' }

export default async function Page() {
  const session = await getServerSession(authOptions)
  const role = (session?.user as { role?: string } | undefined)?.role
  // Por ahora, mientras se termina de probar, solo el super admin tiene acceso.
  if (role !== 'SUPER_ADMIN') redirect('/pipeline')

  return <ComparativosPage />
}
