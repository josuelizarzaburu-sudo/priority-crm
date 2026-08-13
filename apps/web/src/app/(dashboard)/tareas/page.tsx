import { exigirRol } from '@/lib/exigir-rol'
import type { Metadata } from 'next'
import { TareasPage } from '@/components/tareas/tareas-page'

export const metadata: Metadata = { title: 'Tareas' }

export default async function Page() {
  // Abierto a todo el equipo: cada quien ve su propia lista, y quien coordina
  // ve la del equipo. El alcance real lo decide la API, no esta ruta.
  await exigirRol([
    'SUPER_ADMIN',
    'OWNER',
    'MANAGER',
    'JEFE_OPERACIONES',
    'OPERACIONES',
  ])

  return <TareasPage />
}
