import type { Metadata } from 'next'
import { ClienteDetalle } from '@/components/clientes/cliente-detalle'

export const metadata: Metadata = { title: 'Ficha del cliente' }

export default function ClienteDetallePage({ params }: { params: { id: string } }) {
  return <ClienteDetalle id={params.id} />
}
