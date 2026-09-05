'use client'

import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Cake, Check, Send, TriangleAlert } from 'lucide-react'

const NAVY = '#0C2057'
const GOLD = '#DBAA59'
const VERDE = '#15803d'

/** Hoy en Ecuador, como YYYY-MM-DD. */
function hoyISO(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Guayaquil',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

interface Cumpleanero {
  nombre: string
  email: string
  nacimiento: string
}

interface Resultado {
  fecha: string
  total: number
  simulado?: boolean
  enviados?: string[]
  omitidos?: string[]
  fallidos?: string[]
  clientes?: Cumpleanero[]
}

/**
 * Revisar y probar los saludos de cumpleaños.
 *
 * El envío corre solo cada día a las 9:00 de la mañana. Esta pantalla existe
 * para dos cosas que antes obligaban a esperar al día siguiente: ver a quién le
 * toca hoy, y mandar el saludo en el momento para comprobar cómo se ve.
 */
export function CumpleanosPage() {
  const [fecha, setFecha] = useState(hoyISO())
  const [resultado, setResultado] = useState<Resultado | null>(null)
  const [error, setError] = useState<string | null>(null)

  const { data, isLoading, refetch } = useQuery<Resultado>({
    queryKey: ['cumpleanos', fecha],
    queryFn: () =>
      api.get('/correos-automaticos/cumpleanos/hoy', { params: { fecha } }).then((r) => r.data),
  })

  const ejecutar = useMutation({
    mutationFn: () =>
      api
        .post('/correos-automaticos/cumpleanos/ejecutar', null, { params: { fecha } })
        .then((r) => r.data as Resultado),
    onSuccess: (r) => {
      setResultado(r)
      setError(null)
      refetch()
    },
    onError: (e: any) => {
      const m = e?.response?.data?.message
      setError(Array.isArray(m) ? m.join(', ') : (m ?? 'No se pudo ejecutar'))
    },
  })

  const lista = data?.clientes ?? []

  return (
    <div className="mx-auto max-w-3xl space-y-5 p-1">
      <div>
        <h1 className="text-2xl font-bold md:text-3xl" style={{ color: NAVY }}>
          Saludos de cumpleaños
        </h1>
        <p className="text-sm text-muted-foreground">
          El envío corre solo cada día a las 9:00 de la mañana. Aquí puedes revisar a quién le
          toca y probarlo sin esperar.
        </p>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-800">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Día a revisar</label>
          <Input
            type="date"
            value={fecha}
            onChange={(e) => {
              setFecha(e.target.value)
              setResultado(null)
            }}
            className="h-10 w-[180px] text-sm"
          />
        </div>
        {fecha !== hoyISO() && (
          <button
            type="button"
            onClick={() => {
              setFecha(hoyISO())
              setResultado(null)
            }}
            className="mb-2 text-xs underline underline-offset-2"
          >
            Volver a hoy
          </button>
        )}
      </div>

      <div className="rounded-xl border p-4">
        <div className="mb-3 flex items-center gap-2">
          <Cake className="h-4 w-4" style={{ color: GOLD }} />
          <p className="text-sm font-semibold" style={{ color: NAVY }}>
            {isLoading
              ? 'Buscando…'
              : lista.length === 0
                ? 'Nadie cumple años ese día'
                : `${lista.length} cliente${lista.length === 1 ? '' : 's'} de cumpleaños`}
          </p>
        </div>

        {lista.length > 0 && (
          <>
            <div className="space-y-1.5">
              {lista.map((c, i) => (
                <div
                  key={i}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm"
                >
                  <span className="font-medium" style={{ color: NAVY }}>
                    {c.nombre}
                  </span>
                  <span className="text-xs text-muted-foreground">{c.email}</span>
                </div>
              ))}
            </div>

            <Button
              className="mt-4"
              onClick={() => ejecutar.mutate()}
              disabled={ejecutar.isPending}
              style={{ backgroundColor: NAVY, color: '#fff' }}
            >
              <Send className="mr-1.5 h-4 w-4" />
              {ejecutar.isPending ? 'Enviando…' : 'Enviar ahora'}
            </Button>
          </>
        )}

        {/* Sin nadie de cumpleaños no hay nada que probar. Se explica como
            hacerlo, en vez de dejar la pantalla muda. */}
        {!isLoading && lista.length === 0 && (
          <p className="text-xs text-muted-foreground">
            Para probar el saludo, pon la fecha de nacimiento de un cliente en el día que quieras
            revisar y vuelve aquí. Solo entran los que tengan fecha de nacimiento y correo
            cargados.
          </p>
        )}
      </div>

      {resultado && (
        <div className="rounded-xl border-2 p-4" style={{ borderColor: VERDE }}>
          <div className="flex items-center gap-2">
            <Check className="h-5 w-5" style={{ color: VERDE }} strokeWidth={3} />
            <p className="font-bold" style={{ color: NAVY }}>
              {resultado.simulado ? 'Simulación terminada' : 'Saludos enviados'}
            </p>
          </div>

          {/* Si el modo prueba esta puesto, el sistema calcula pero NO envia.
              Decirlo aqui evita pensar que el correo salio cuando no lo hizo. */}
          {resultado.simulado && (
            <p className="mt-2 rounded-md bg-amber-50 px-2.5 py-2 text-xs text-amber-900">
              No se envió nada: el modo prueba está activo. Para enviar de verdad hay que poner
              CORREOS_AUTOMATICOS_ENVIAR=true en Railway.
            </p>
          )}

          <div className="mt-3 space-y-1 text-sm">
            {!!resultado.enviados?.length && (
              <p>
                <strong style={{ color: VERDE }}>{resultado.enviados.length} enviado(s):</strong>{' '}
                {resultado.enviados.join(', ')}
              </p>
            )}
            {!!resultado.omitidos?.length && (
              <p className="text-muted-foreground">
                {resultado.omitidos.length} omitido(s): {resultado.omitidos.join(', ')}
              </p>
            )}
            {!!resultado.fallidos?.length && (
              <p className="text-red-700">
                {resultado.fallidos.length} fallido(s): {resultado.fallidos.join(', ')}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
