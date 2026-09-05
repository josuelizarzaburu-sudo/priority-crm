import type { Metadata } from 'next'
import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { CumpleanosPage } from '@/components/correos/cumpleanos-page'

export const metadata: Metadata = { title: 'Saludos de cumpleaños' }

export default async function Page() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')
  // Solo SUPER_ADMIN, igual que los endpoints: desde aqui se envian correos a
  // clientes reales.
  if ((session.user as any)?.role !== 'SUPER_ADMIN') redirect('/pipeline')
  return <CumpleanosPage />
}
