import type { Metadata } from 'next'
import { exigirRol } from '@/lib/exigir-rol'
import { CursosPage } from '@/components/cursos/cursos-page'

export const metadata: Metadata = { title: 'Capacitaciones' }

export default async function Page() {
  // Abierto a todo el equipo: la capacitacion es para todos. Quien administra ve
  // ademas los cursos en borrador; eso lo decide la API, no esta ruta.
  await exigirRol([
    'SUPER_ADMIN',
    'OWNER',
    'MANAGER',
    'JEFE_EQUIPO',
    'JEFE_OPERACIONES',
    'OPERACIONES',
    'SALES_REP',
  ])
  return <CursosPage />
}
