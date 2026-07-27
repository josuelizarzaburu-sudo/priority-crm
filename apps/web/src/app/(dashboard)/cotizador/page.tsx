import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { CotizadorPage } from '@/components/cotizador/cotizador-page'

export const metadata: Metadata = { title: 'Cotizador' }

// Cotizador abierto a todo el equipo con sesion iniciada (vendedores,
// operaciones, jefes, admin). Ya no hay restriccion por rol.
export default async function Page() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')

  return <CotizadorPage />
}
