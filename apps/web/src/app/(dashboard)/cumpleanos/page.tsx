import type { Metadata } from 'next'
import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { CumpleanosPage } from '@/components/correos/cumpleanos-page'

export const metadata: Metadata = { title: 'Saludos de cumpleaños' }

export default async function Page() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')
  // Gerencia ve la pantalla; el ENVIO sigue siendo solo de SUPER_ADMIN, porque
  // desde aqui salen correos de verdad a los clientes.
  // Antes era solo SUPER_ADMIN: desde aqui se envian correos a
  // clientes reales.
  if (!['SUPER_ADMIN', 'OWNER', 'MANAGER'].includes((session.user as any)?.role)) {
    redirect('/pipeline')
  }
  return <CumpleanosPage />
}
