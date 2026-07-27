import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { CotizadorPage } from '@/components/cotizador/cotizador-page'

export const metadata: Metadata = { title: 'Cotizador' }

// Acceso al Cotizador: SUPER_ADMIN y el area de Operaciones (a veces cotizan).
// El resto de vendedores todavia no.
const ROLES_PERMITIDOS = ['SUPER_ADMIN', 'OPERACIONES', 'JEFE_OPERACIONES']

export default async function Page() {
  const session = await getServerSession(authOptions)
  const user = session?.user as { role?: string } | undefined
  if (!ROLES_PERMITIDOS.includes(user?.role ?? '')) redirect('/clientes')

  return <CotizadorPage />
}
