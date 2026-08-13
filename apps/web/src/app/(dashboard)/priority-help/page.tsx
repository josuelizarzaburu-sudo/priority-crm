import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { PriorityHelpChat } from '@/components/priority-help/priority-help-chat'

export const metadata: Metadata = { title: 'Priority Help' }

export default async function PriorityHelpPage() {
  // Acceso por permiso individual, no por rol: cada consulta al bot tiene
  // costo, asi que se activa asesor por asesor desde la pantalla de Usuarios.
  // SUPER_ADMIN siempre entra.
  //
  // Esto es solo para no mostrar la pantalla; quien mande la peticion a mano
  // igual choca con PriorityHelpAccessGuard en el backend, que es el control
  // que de verdad manda.
  const session = await getServerSession(authOptions)
  const user = session?.user as any

  if (!user) redirect('/login')
  if (user.role !== 'SUPER_ADMIN' && user.puedePriorityHelp !== true) {
    redirect('/overview')
  }

  return <PriorityHelpChat />
}
