import { exigirRol, OPS_Y_ADMIN } from '@/lib/exigir-rol'
import type { Metadata } from 'next'
import { ClienteDetalle } from '@/components/clientes/cliente-detalle'

export const metadata: Metadata = { title: 'Ficha del cliente' }

export default async function ClienteDetallePage({ params }: { params: { id: string } }) {
  await exigirRol(OPS_Y_ADMIN)

  return <ClienteDetalle id={params.id} />
}
