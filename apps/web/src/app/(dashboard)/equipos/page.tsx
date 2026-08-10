import { exigirRol } from '@/lib/exigir-rol'
import type { Metadata } from 'next'
import { EquiposPage } from '@/components/equipos/equipos-page'

export const metadata: Metadata = { title: 'Equipos' }

export default async function Page() {
  // Solo super admin y dueño arman los equipos. Un jefe no puede asignarse gente
  // a si mismo; misma lista que exige el backend en EquiposService.
  await exigirRol(['SUPER_ADMIN', 'OWNER'])

  return <EquiposPage />
}
