'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ReclamoForm } from './reclamo-form'

export function NuevoReclamo() {
  const [abierto, setAbierto] = useState(false)
  return (
    <>
      <Button
        type="button"
        style={{ backgroundColor: '#0C2057', color: '#fff' }}
        onClick={() => setAbierto(true)}
      >
        <Plus className="mr-2 h-4 w-4" />
        Nuevo reembolso
      </Button>
      {abierto && <ReclamoForm onCerrar={() => setAbierto(false)} />}
    </>
  )
}
