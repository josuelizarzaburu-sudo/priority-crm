import type { Metadata } from 'next'
import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { ImportarClientes } from '@/components/importacion/importar-clientes'

export const metadata: Metadata = { title: 'Importar clientes' }

export default async function Page() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')
  // Solo SUPER_ADMIN: esta pantalla puede vaciar la base entera.
  if ((session.user as any)?.role !== 'SUPER_ADMIN') redirect('/pipeline')
  return <ImportarClientes />
}
