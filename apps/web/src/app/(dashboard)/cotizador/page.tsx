import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { CotizadorPage } from '@/components/cotizador/cotizador-page'

export const metadata: Metadata = { title: 'Cotizador' }

// Acceso al Cotizador: SOLO SUPER_ADMIN. Es una herramienta interna de validación,
// aislada del comparativo. No visible para el resto de vendedores por ahora.
export default async function Page() {
  const session = await getServerSession(authOptions)
  const user = session?.user as { role?: string } | undefined
  if (user?.role !== 'SUPER_ADMIN') redirect('/pipeline')

  return <CotizadorPage />
}
