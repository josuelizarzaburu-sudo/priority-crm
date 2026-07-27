import type { Metadata } from 'next'
import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { ComparativosPage } from '@/components/comparativos/comparativos-page'

export const metadata: Metadata = { title: 'Comparativos' }

// Comparativos abierto a todo el equipo con sesion iniciada. Termino el
// lanzamiento controlado por lista de correos; ya no hay restriccion por rol.
export default async function Page() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')

  return (
    <Suspense fallback={null}>
      <ComparativosPage />
    </Suspense>
  )
}
