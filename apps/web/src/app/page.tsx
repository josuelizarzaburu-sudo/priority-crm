import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { inicioSegunRol } from '@/lib/exigir-rol'

export default async function HomePage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')
  // Cada rol arranca en una pantalla que si puede abrir. Mandar a todos a
  // /pipeline provocaba un bucle con los perfiles de operaciones.
  const rol = (session.user as { role?: string } | undefined)?.role ?? ''
  redirect(inicioSegunRol(rol))
}
