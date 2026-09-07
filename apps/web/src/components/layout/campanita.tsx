'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Bell, CheckCheck } from 'lucide-react'

const NAVY = '#0C2057'
const GOLD = '#DBAA59'

interface Aviso {
  id: string
  tipo: string
  titulo: string
  detalle: string | null
  enlace: string | null
  leida: boolean
  createdAt: string
}

/** "hace 5 min", "hace 2 h", "ayer". */
function cuandoFue(iso: string): string {
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (min < 1) return 'ahora'
  if (min < 60) return `hace ${min} min`
  const h = Math.round(min / 60)
  if (h < 24) return `hace ${h} h`
  const d = Math.round(h / 24)
  if (d === 1) return 'ayer'
  if (d < 7) return `hace ${d} días`
  return new Date(iso).toLocaleDateString('es-EC', { day: 'numeric', month: 'short' })
}

export function Campanita() {
  const [abierto, setAbierto] = useState(false)
  const caja = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const qc = useQueryClient()

  const { data } = useQuery<{ avisos: Aviso[]; noLeidas: number }>({
    queryKey: ['notificaciones'],
    queryFn: () => api.get('/notificaciones').then((r) => r.data),
    // Se revisa cada minuto: un aviso que llega mientras trabajas debería
    // aparecer sin tener que recargar la página.
    refetchInterval: 60_000,
  })

  const marcarLeida = useMutation({
    mutationFn: (id: string) => api.patch(`/notificaciones/${id}/leida`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notificaciones'] }),
  })

  const marcarTodas = useMutation({
    mutationFn: () => api.patch('/notificaciones/leidas'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notificaciones'] }),
  })

  // Cerrar al pulsar fuera. Sin esto, el panel se queda abierto tapando la
  // pantalla mientras se intenta trabajar en otra cosa.
  useEffect(() => {
    if (!abierto) return
    const fuera = (e: MouseEvent) => {
      if (caja.current && !caja.current.contains(e.target as Node)) setAbierto(false)
    }
    document.addEventListener('mousedown', fuera)
    return () => document.removeEventListener('mousedown', fuera)
  }, [abierto])

  const avisos = data?.avisos ?? []
  const noLeidas = data?.noLeidas ?? 0

  return (
    <div className="relative" ref={caja}>
      <button
        onClick={() => setAbierto((v) => !v)}
        className="relative flex h-9 w-9 items-center justify-center rounded-lg text-[#25324b]/60 transition-all hover:bg-[#f0f2f7] hover:text-[#25324b]"
        aria-label="Notificaciones"
      >
        <Bell className="h-[18px] w-[18px]" />
        {noLeidas > 0 ? (
          <span className="absolute right-1.5 top-1.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {noLeidas > 9 ? '9+' : noLeidas}
          </span>
        ) : (
          <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-[#25324b]/15" />
        )}
      </button>

      {abierto && (
        <div className="absolute right-0 top-11 z-50 w-[340px] overflow-hidden rounded-xl border bg-white shadow-lg">
          <div className="flex items-center justify-between border-b px-3.5 py-2.5">
            <p className="text-sm font-semibold" style={{ color: NAVY }}>
              Notificaciones
            </p>
            {noLeidas > 0 && (
              <button
                onClick={() => marcarTodas.mutate()}
                className="flex items-center gap-1 text-[11px] text-muted-foreground hover:underline"
              >
                <CheckCheck className="h-3 w-3" /> Marcar todas
              </button>
            )}
          </div>

          <div className="max-h-[380px] overflow-y-auto">
            {avisos.length === 0 ? (
              <p className="px-3.5 py-8 text-center text-xs text-muted-foreground">
                No tienes notificaciones
              </p>
            ) : (
              avisos.map((a) => (
                <button
                  key={a.id}
                  onClick={() => {
                    if (!a.leida) marcarLeida.mutate(a.id)
                    if (a.enlace) {
                      router.push(a.enlace)
                      setAbierto(false)
                    }
                  }}
                  className="flex w-full gap-2.5 border-b px-3.5 py-2.5 text-left transition-colors last:border-b-0 hover:bg-muted/40"
                >
                  {/* Punto dorado en los no leídos: distingue de un vistazo lo
                      nuevo de lo ya visto, sin tener que leerlo todo. */}
                  <span
                    className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{ backgroundColor: a.leida ? 'transparent' : GOLD }}
                  />
                  <div className="min-w-0 flex-1">
                    <p
                      className="text-xs"
                      style={{ color: NAVY, fontWeight: a.leida ? 400 : 600 }}
                    >
                      {a.titulo}
                    </p>
                    {a.detalle && (
                      <p className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground">
                        {a.detalle}
                      </p>
                    )}
                    <p className="mt-0.5 text-[10px] text-muted-foreground/70">
                      {cuandoFue(a.createdAt)}
                    </p>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
