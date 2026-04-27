import type { Metadata } from 'next'
import { UsersManagement } from '@/components/settings/users-management'

export const metadata: Metadata = { title: 'Gestión de usuarios' }

export default function UsersPage() {
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
