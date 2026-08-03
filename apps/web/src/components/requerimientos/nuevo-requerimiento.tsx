'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { RequerimientoForm } from './requerimiento-form'

export function NuevoRequerimiento() {
  const [abierto, setAbierto] = useState(false)
  return (
    <>
      <Button
        type="button"
        style={{ backgroundColor: '#0C2057', color: '#fff' }}
        onClick={() => setAbierto(true)}
      >
        <Plus className="mr-2 h-4 w-4" />
        Nuevo requerimiento
      </Button>
      {abierto && <RequerimientoForm onCerrar={() => setAbierto(false)} />}
    </>
  )
}
