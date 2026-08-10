import { exigirRol, COMUNES } from '@/lib/exigir-rol'
import type { Metadata } from 'next'
import { PriorityHelpChat } from '@/components/priority-help/priority-help-chat'

export const metadata: Metadata = { title: 'Priority Help' }

export default async function PriorityHelpPage() {
  // Mismo alcance que el Cotizador. Si esto cambia, cambiarlo tambien en el
  // sidebar y en el controller del backend: son tres listas separadas.
  await exigirRol([...COMUNES, 'SUPER_ADMIN'])

  return <PriorityHelpChat />
}
