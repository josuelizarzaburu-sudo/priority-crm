import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { ComparativosPage } from '@/components/comparativos/comparativos-page'

export const metadata: Metadata = { title: 'Comparativos' }

// Acceso a Comparativos: SUPER_ADMIN siempre entra, más esta lista de personas
// autorizadas mientras se hace el lanzamiento controlado. Para agregar o quitar
// a alguien, edita este arreglo.
const ALLOWED_EMAILS = [
  'raviles@priority.ec', // Roxana Avilés
  'comer@priority.ec', // Gianella Pozo
  'pcarrillo@priority.ec', // Pablo Carrillo
  'jsegovia@priority.ec', // Juan Fernando Segovia
]

export default async function Page() {
  const session = await getServerSession(authOptions)
  const user = session?.user as { role?: string; email?: string } | undefined
  const role = user?.role
  const email = user?.email?.toLowerCase()
  const hasAccess = role === 'SUPER_ADMIN' || (email && ALLOWED_EMAILS.includes(email))
  if (!hasAccess) redirect('/pipeline')

  return <ComparativosPage />
}
