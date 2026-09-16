'use client'

import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Check, ShieldCheck } from 'lucide-react'

const NAVY = '#0C2057'
const GOLD = '#DBAA59'

const RAMOS = [
  { valor: 'SALUD', label: 'Salud' },
  { valor: 'AUTO', label: 'Vehículo' },
  { valor: 'VIDA', label: 'Vida' },
  { valor: 'HOGAR', label: 'Hogar' },
]

/**
 * Donde aterriza el contacto referido.
 *
 * Es la pantalla que Daniela comparte por WhatsApp: su amigo entra, pone sus
 * datos y listo. Antes ella tenía que escribirlos por él, lo que significaba
 * pedirle los datos primero, anotarlos y transcribirlos.
 *
 * Distinta de /r/[codigo], que es su panel privado con sus puntos.
 */
export function InvitacionReferido({ codigo }: { codigo: string }) {
  const [form, setForm] = useState<Record<string, string>>({})
  const [enviado, setEnviado] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Solo para saludar con el nombre de quien refiere: "Daniela te recomendó".
  const { data: quienRefiere } = useQuery<{ nombres: string }>({
    queryKey: ['invitacion', codigo],
    queryFn: () => api.get(`/referidos/invitacion/${codigo}`).then((r) => r.data),
    retry: false,
  })

  const enviar = useMutation({
    mutationFn: () => api.post(`/referidos/panel/${codigo}/referir`, form),
    onSuccess: () => {
      setEnviado(true)
      setError(null)
    },
    onError: (e: any) => {
      const m = e?.response?.data?.message
      setError(Array.isArray(m) ? m.join(', ') : (m ?? 'No se pudo enviar'))
    },
  })

  if (enviado) {
    return (
      <div className="flex min-h-screen items-center justify-center px-5">
        <div className="max-w-sm text-center">
          <div
            className="mx-auto flex h-14 w-14 items-center justify-center rounded-full"
            style={{ backgroundColor: '#f0fdf4' }}
          >
            <Check className="h-7 w-7" style={{ color: '#15803d' }} />
          </div>
          <p className="mt-4 text-lg font-semibold" style={{ color: NAVY }}>
            Listo, {form.nombres?.split(' ')[0]}
          </p>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Un asesor de Priority te va a contactar en las próximas horas. Sin compromiso.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#f4f5f7' }}>
      {/* Cabecera con el logo: quien llega aquí no conoce Priority y lo primero
          que necesita saber es quién le está escribiendo. */}
      <div style={{ backgroundColor: NAVY }} className="px-5 py-7 text-center">
        <p className="text-lg font-bold tracking-wide" style={{ color: GOLD }}>
          PRIORITY
        </p>
        <p className="mt-0.5 text-[10px] tracking-[0.2em] text-white/60">
          ASESORES DE SEGUROS
        </p>
      </div>

      <div className="mx-auto max-w-md px-5 py-6">
        <p className="text-xl font-bold" style={{ color: NAVY }}>
          {quienRefiere?.nombres
            ? `${quienRefiere.nombres} te recomendó`
            : 'Te recomendaron Priority'}
        </p>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Déjanos tus datos y un asesor te contacta para explicarte tus opciones. Sin costo y
          sin compromiso.
        </p>

        <div className="mt-5 space-y-2.5 rounded-xl bg-white p-4">
          {error && (
            <p className="rounded-lg bg-amber-50 px-2.5 py-2 text-xs text-amber-900">{error}</p>
          )}

          <input
            autoFocus
            value={form.nombres ?? ''}
            onChange={(e) => setForm((f) => ({ ...f, nombres: e.target.value }))}
            placeholder="Tu nombre"
            className="h-11 w-full rounded-lg border px-3 text-sm"
          />
          <input
            value={form.celular ?? ''}
            onChange={(e) => setForm((f) => ({ ...f, celular: e.target.value }))}
            placeholder="Tu celular"
            inputMode="tel"
            className="h-11 w-full rounded-lg border px-3 text-sm"
          />
          <input
            value={form.email ?? ''}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            placeholder="Tu correo (opcional)"
            inputMode="email"
            className="h-11 w-full rounded-lg border px-3 text-sm"
          />

          <div className="pt-1">
            <p className="mb-2 text-xs text-muted-foreground">¿Qué te interesa?</p>
            <div className="flex flex-wrap gap-1.5">
              {RAMOS.map((r) => (
                <button
                  key={r.valor}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, interes: r.valor }))}
                  className="rounded-full border px-3.5 py-1.5 text-xs"
                  style={
                    form.interes === r.valor
                      ? { backgroundColor: NAVY, color: '#fff', borderColor: NAVY }
                      : undefined
                  }
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={() => enviar.mutate()}
            disabled={!form.nombres?.trim() || !form.celular?.trim() || enviar.isPending}
            className="mt-2 w-full rounded-lg py-3 text-sm font-semibold text-white disabled:opacity-40"
            style={{ backgroundColor: NAVY }}
          >
            {enviar.isPending ? 'Enviando…' : 'Quiero que me contacten'}
          </button>
        </div>

        {/* Quien deja su celular a un desconocido necesita saber qué se hace con
            él. Decirlo aquí evita la duda que frena el envío. */}
        <p className="mt-3 flex items-start gap-1.5 text-[11px] text-muted-foreground">
          <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Tus datos solo se usan para que un asesor te contacte. No los compartimos con nadie.
        </p>
      </div>
    </div>
  )
}
