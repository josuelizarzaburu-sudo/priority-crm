import { exigirRol } from '@/lib/exigir-rol'
import type { Metadata } from 'next'
import { PriorityHelpChat } from '@/components/priority-help/priority-help-chat'

export const metadata: Metadata = { title: 'Priority Help' }

export default async function PriorityHelpPage() {
  // FASE DE PRUEBAS: solo SUPER_ADMIN, hasta validar con preguntas reales.
  // Al abrirlo, cambiar tambien el sidebar y el controller del backend.
  await exigirRol(['SUPER_ADMIN'])

  return <PriorityHelpChat />
}
