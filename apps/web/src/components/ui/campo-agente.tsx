'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Check, ChevronDown } from 'lucide-react'

const NAVY = '#0C2057'

interface Usuario {
  id: string
  name: string
  role?: string
}

/**
 * Campo para elegir quién vendió.
 *
 * Combina las dos cosas que hacen falta y que por separado no sirven:
 *   - Elegir de la lista del CRM evita que cada quien escriba el nombre a su
 *     manera y que despues "MOSQUERA" y "MOZQUERA" parezcan dos personas.
 *   - Escribir libre permite registrar a los vendedores externos, que traen
 *     clientes de vez en cuando y nunca han tenido usuario.
 *
 * Cuando el nombre escrito coincide con alguien del CRM se guarda tambien su id,
 * para poder filtrar por agente en los reportes. Si no coincide, se guarda solo
 * el nombre y la venta igual queda registrada a su nombre.
 */
export function CampoAgente({
  nombre,
  onCambio,
  placeholder = 'Escribe o elige de la lista',
  label = 'Agente (quién vendió)',
}: {
  nombre: string
  /** Devuelve el nombre y, si coincide con un usuario, su id. */
  onCambio: (nombre: string, usuarioId: string | null) => void
  placeholder?: string
  label?: string
}) {
  const [abierto, setAbierto] = useState(false)
  const caja = useRef<HTMLDivElement>(null)

  const { data: usuarios = [] } = useQuery<Usuario[]>({
    queryKey: ['users'],
    queryFn: () => api.get('/users').then((r) => r.data),
    // La lista de vendedores no cambia de un minuto a otro.
    staleTime: 5 * 60_000,
  })

  /** Compara sin tildes ni mayúsculas, tratando la Z como S. */
  const clave = (v: string) =>
    v
      .trim()
      .toLocaleUpperCase('es-EC')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/Z/g, 'S')
      .replace(/[^A-Z ]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()

  const sugerencias = useMemo(() => {
    const q = clave(nombre)
    if (!q) return usuarios
    return usuarios.filter((u) => clave(u.name).includes(q))
  }, [usuarios, nombre])

  /** Si lo escrito coincide con alguien del CRM, ese usuario. */
  const coincide = useMemo(
    () => usuarios.find((u) => clave(u.name) === clave(nombre)) ?? null,
    [usuarios, nombre],
  )

  useEffect(() => {
    if (!abierto) return
    const fuera = (e: MouseEvent) => {
      if (caja.current && !caja.current.contains(e.target as Node)) setAbierto(false)
    }
    document.addEventListener('mousedown', fuera)
    return () => document.removeEventListener('mousedown', fuera)
  }, [abierto])

  return (
    <div className="relative" ref={caja}>
      <label className="mb-1 block text-xs text-muted-foreground">{label}</label>
      <div className="relative">
        <input
          value={nombre}
          onChange={(e) => {
            const v = e.target.value.toLocaleUpperCase('es-EC')
            const u = usuarios.find((x) => clave(x.name) === clave(v))
            onCambio(v, u?.id ?? null)
            setAbierto(true)
          }}
          onFocus={() => setAbierto(true)}
          placeholder={placeholder}
          className="h-10 w-full rounded-md border border-input bg-background px-3 pr-8 text-sm"
        />
        <button
          type="button"
          onClick={() => setAbierto((v) => !v)}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"
          tabIndex={-1}
          aria-label="Ver agentes"
        >
          <ChevronDown className="h-4 w-4" />
        </button>
      </div>

      {/* Se dice si quedo enlazado o no, para que no sea una sorpresa despues:
          un agente sin usuario se guarda igual, pero no se puede filtrar por el
          en los reportes. */}
      {nombre.trim() && (
        <p className="mt-1 text-[11px] text-muted-foreground">
          {coincide ? (
            <span className="inline-flex items-center gap-1" style={{ color: '#15803d' }}>
              <Check className="h-3 w-3" /> Enlazado a su usuario del CRM
            </span>
          ) : (
            'Agente externo: se guarda el nombre, sin usuario en el CRM'
          )}
        </p>
      )}

      {abierto && sugerencias.length > 0 && (
        <div className="absolute z-50 mt-1 max-h-52 w-full overflow-y-auto rounded-md border bg-white shadow-lg">
          {sugerencias.map((u) => (
            <button
              key={u.id}
              type="button"
              onClick={() => {
                onCambio(u.name.toLocaleUpperCase('es-EC'), u.id)
                setAbierto(false)
              }}
              className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-muted/50"
            >
              <span style={{ color: NAVY }}>{u.name}</span>
              {coincide?.id === u.id && <Check className="h-3.5 w-3.5" style={{ color: '#15803d' }} />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
