'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Check, ShieldCheck } from 'lucide-react'

const NAVY = '#0C2057'
const GOLD = '#DBAA59'

interface Datos {
  nombre: string
  estado: 'PENDIENTE' | 'OTORGADO' | 'REVOCADO'
  otorgadoEn: string | null
  texto: string
  version: string
}

/**
 * Lo que ve el cliente al abrir el enlace de su correo.
 *
 * Fuera del CRM: quien entra no es del equipo y su token es la credencial.
 * No se le muestran sus pólizas ni sus datos, solo lo que tiene que decidir.
 */
export function PantallaConsentimiento({ token }: { token: string }) {
  const qc = useQueryClient()
  const [leido, setLeido] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { data, isLoading, isError } = useQuery<Datos>({
    queryKey: ['consentimiento', token],
    queryFn: () => api.get(`/consentimientos/publico/${token}`).then((r) => r.data),
    retry: false,
  })

  const aceptar = useMutation({
    mutationFn: () => api.post(`/consentimientos/publico/${token}/aceptar`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['consentimiento', token] }),
    onError: () => setError('No pudimos registrar tu respuesta. Inténtalo de nuevo.'),
  })

  const revocar = useMutation({
    mutationFn: () => api.post(`/consentimientos/publico/${token}/revocar`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['consentimiento', token] }),
    onError: () => setError('No pudimos registrar tu respuesta. Inténtalo de nuevo.'),
  })

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div
          className="h-8 w-8 animate-spin rounded-full border-2 border-t-transparent"
          style={{ borderColor: `${GOLD} transparent ${GOLD} ${GOLD}` }}
        />
      </div>
    )
  }

  if (isError || !data) {
    return (
      <div className="flex min-h-screen items-center justify-center px-5">
        <p className="max-w-sm text-center text-sm text-muted-foreground">
          Este enlace no es válido o ya expiró. Escríbenos a datos@priority.ec y te enviamos
          uno nuevo.
        </p>
      </div>
    )
  }

  const ya = data.estado === 'OTORGADO'
  const revocado = data.estado === 'REVOCADO'

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#f4f5f7' }}>
      <div style={{ backgroundColor: NAVY }} className="px-5 py-7 text-center">
        <p className="text-lg font-bold tracking-wide" style={{ color: GOLD }}>
          PRIORITY
        </p>
        <p className="mt-0.5 text-[10px] tracking-[0.2em] text-white/60">
          ASESORES DE SEGUROS
        </p>
      </div>

      <div className="mx-auto max-w-2xl px-5 py-6">
        {/* Ya respondió: se le dice qué decidió y cuándo, y puede cambiarlo. */}
        {ya && (
          <div className="mb-5 rounded-xl border-2 p-4" style={{ borderColor: '#bbf7d0', backgroundColor: '#f0fdf4' }}>
            <div className="flex items-start gap-2.5">
              <Check className="mt-0.5 h-5 w-5 shrink-0" style={{ color: '#15803d' }} />
              <div>
                <p className="text-sm font-semibold" style={{ color: '#15803d' }}>
                  Ya nos diste tu autorización
                </p>
                {data.otorgadoEn && (
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    El{' '}
                    {new Date(data.otorgadoEn).toLocaleDateString('es-EC', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })}
                    . Puedes retirarla cuando quieras desde aquí mismo.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {revocado && (
          <div className="mb-5 rounded-xl border-2 p-4" style={{ borderColor: '#fed7aa', backgroundColor: '#fffbeb' }}>
            <p className="text-sm font-semibold" style={{ color: '#b45309' }}>
              Retiraste tu autorización
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Si cambias de opinión, puedes volver a darla abajo.
            </p>
          </div>
        )}

        <h1 className="text-xl font-bold" style={{ color: NAVY }}>
          {data.nombre.split(' ')[0]}, necesitamos tu autorización
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          La Ley Orgánica de Protección de Datos Personales nos pide tu permiso expreso para
          tratar tus datos como tu bróker de seguros. Léelo y decide.
        </p>

        {/* El texto completo, no un resumen: la ley pide consentimiento
            INFORMADO, y un resumen no informa. */}
        <div
          className="mt-4 max-h-[420px] overflow-y-auto rounded-xl bg-white p-5 text-[13px] leading-relaxed"
          onScroll={(e) => {
            const el = e.currentTarget
            if (el.scrollHeight - el.scrollTop - el.clientHeight < 60) setLeido(true)
          }}
        >
          <pre className="whitespace-pre-wrap font-sans">{data.texto}</pre>
        </div>

        <p className="mt-2 text-[11px] text-muted-foreground">
          Versión {data.version}
        </p>

        {error && (
          <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">{error}</p>
        )}

        <div className="mt-5 space-y-2.5">
          {!ya ? (
            <>
              <button
                type="button"
                onClick={() => aceptar.mutate()}
                disabled={aceptar.isPending}
                className="w-full rounded-xl py-3.5 text-sm font-semibold text-white disabled:opacity-40"
                style={{ backgroundColor: NAVY }}
              >
                {aceptar.isPending ? 'Guardando…' : 'Autorizo el tratamiento de mis datos'}
              </button>
              {/* No se bloquea el botón hasta que baje del todo: obligar a hacer
                  scroll no hace que nadie lea, y sí frustra a quien ya leyó. */}
              {!leido && (
                <p className="text-center text-[11px] text-muted-foreground">
                  Tómate un momento para leerlo antes de decidir.
                </p>
              )}
            </>
          ) : (
            <button
              type="button"
              onClick={() => revocar.mutate()}
              disabled={revocar.isPending}
              className="w-full rounded-xl border py-3 text-sm font-medium disabled:opacity-40"
              style={{ color: NAVY }}
            >
              {revocar.isPending ? 'Guardando…' : 'Retirar mi autorización'}
            </button>
          )}
        </div>

        <p className="mt-4 flex items-start gap-1.5 text-[11px] text-muted-foreground">
          <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Guardamos la fecha y hora de tu respuesta como constancia. Para cualquier consulta
          sobre tus datos, escríbenos a datos@priority.ec.
        </p>
      </div>
    </div>
  )
}
