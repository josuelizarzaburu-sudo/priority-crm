import type { Metadata } from 'next'
import { ClientesTable } from '@/components/clientes/clientes-table'

export const metadata: Metadata = { title: 'Clientes' }

export default function ClientesPage() {
  return (
    <div className="flex h-full flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: '#0C2057' }}>
          Clientes
        </h1>
        <p className="text-sm text-muted-foreground">
          Base de clientes de Operaciones. Haz clic en un cliente para ver toda su información.
        </p>
      </div>
      <ClientesTable />
    </div>
  )
}
