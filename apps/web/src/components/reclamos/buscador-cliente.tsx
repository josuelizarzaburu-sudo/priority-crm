'use client'

import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Check, Search, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { api } from '@/lib/api'

const NAVY = '#0C2057'
const GOLD = '#DBAA59'

export interface ClienteSugerido {
  id: string
  nombres: string
  apellidos: string
  identificacion: string
  celular?: string | null
  telefono?: string | null
  email?: string | null
}

const nombreCompleto = (c: ClienteSugerido) => `${c.nombres} ${c.apellidos}`.trim()

/**
 * Buscador de clientes para el formulario de reclamos.
 *
 * A propósito NO obliga a elegir un cliente de la base: los reclamos históricos
 * llegan sin cédula y hay que poder registrarlos igual, solo con el nombre en
 * texto. Si el asesor elige uno de la lista, se guarda además el `clienteId` y
 * el reclamo queda enganchado a la ficha del cliente.
 */
export function BuscadorCliente({
  valor,
  clienteId,
  onSeleccionar,
  onTextoLibre,
}: {
  valor: string
  clienteId: string | null
  onSeleccionar: (c: ClienteSugerido) => void
  onTextoLibre: (texto: string) => void
}) {
  const [abierto, setAbierto] = useState(false)
  const [termino, setTermino] = useState('')
  const contenedor = useRef<HTMLDivElement>(null)

  // Espera a que el asesor deje de escribir para no disparar una búsqueda por tecla
  useEffect(() => {
    const t = setTimeout(() => setTermino(valor.trim()), 300)
    return () => clearTimeout(t)
  }, [valor])

  // Cierra el desplegable al hacer clic fuera
  useEffect(() => {
    const fuera = (e: MouseEvent) => {
      if (contenedor.current && !contenedor.current.contains(e.target as Node)) {
        setAbierto(false)
      }
    }
    document.addEventListener('mousedown', fuera)
    return () => document.removeEventListener('mousedown', fuera)
  }, [])

  const { data, isFetching } = useQuery({
    queryKey: ['clientes-buscador', termino],
    // Con menos de 3 letras la lista es puro ruido, así que ni se consulta
    enabled: abierto && termino.length >= 3 && !clienteId,
    queryFn: async () =>
      (await api.get('/clientes', { params: { search: termino, limit: 8 } })).data,
  })

  const resultados: ClienteSugerido[] = data?.data ?? data?.items ?? []

  return (
    <div ref={contenedor} className="relative">
      <div className="relative">
        <Input
          value={valor}
          placeholder="Escribe nombre o cédula…"
          onChange={(e) => {
            onTextoLibre(e.target.value)
            setAbierto(true)
          }}
          onFocus={() => setAbierto(true)}
          className={clienteId ? 'pr-16' : 'pr-8'}
        />

        {clienteId ? (
          // Enganchado a un cliente real: se marca en dorado y se puede soltar
          <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
            <Check className="h-4 w-4" style={{ color: GOLD }} />
            <button
              type="button"
              title="Desvincular cliente"
              onClick={() => onTextoLibre(valor)}
              className="rounded p-0.5 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <Search className="absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        )}
      </div>

      {clienteId && (
        <p className="mt-1 text-[11px]" style={{ color: GOLD }}>
          Enlazado a la ficha del cliente
        </p>
      )}

      {abierto && !clienteId && termino.length >= 3 && (
        <div className="absolute z-50 mt-1 max-h-64 w-full overflow-y-auto rounded-md border bg-popover shadow-lg">
          {isFetching ? (
            <p className="px-3 py-2 text-xs text-muted-foreground">Buscando…</p>
          ) : resultados.length === 0 ? (
            <p className="px-3 py-2 text-xs text-muted-foreground">
              Sin coincidencias. Se guardará solo el nombre escrito.
            </p>
          ) : (
            resultados.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  onSeleccionar(c)
                  setAbierto(false)
                }}
                className="flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left hover:bg-accent"
              >
                <span className="text-sm font-medium" style={{ color: NAVY }}>
                  {nombreCompleto(c)}
                </span>
                <span className="text-[11px] text-muted-foreground">
                  {c.identificacion}
                  {c.celular ? ` · ${c.celular}` : ''}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
