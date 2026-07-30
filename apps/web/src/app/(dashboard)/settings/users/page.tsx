import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

import { UsersManagement } from '@/components/settings/users-management'

export const metadata: Metadata = { title: 'Gestión de usuarios' }

// Gestion de usuarios y claves: solo administracion.
export default async function UsersPage() {
  const session = await getServerSession(authOptions)
  const rol = (session?.user as { role?: string } | undefined)?.role ?? ''
  if (!['SUPER_ADMIN', 'OWNER'].includes(rol)) redirect('/')

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Gestión de usuarios</h1>
        <p className="text-sm text-muted-foreground">
          Administra los miembros del equipo y sus roles de acceso
        </p>
      </div>
      <UsersManagement />
    </div>
  )
}
