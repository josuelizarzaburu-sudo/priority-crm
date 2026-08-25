'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useSession } from 'next-auth/react'
import { usePathname } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { PantallaPin } from './pantalla-pin'

/** Minutos de inactividad tras los que se vuelve a pedir el PIN. */
const MINUTOS_INACTIVIDAD = 15

/**
 * Decide cuándo hay que pedir el PIN.
 *
 * Solo en MÓVIL: en la computadora de la oficina el teléfono no se lo lleva
 * nadie, y pedir PIN ahí sería fricción sin motivo.
 *
 * Se pide al abrir la app y tras 15 minutos sin usarla. Pedirlo en cada cambio
 * de pantalla sería insoportable y la gente terminaría poniendo 123456.
 *
 * El interruptor NEXT_PUBLIC_PIN_ACTIVO permite encenderlo cuando el equipo ya
 * esté avisado, sin volver a desplegar.
 */
export function GuardianPin({ children }: { children: React.ReactNode }) {
  const { status } = useSession()
  const pathname = usePathname()

  const [desbloqueado, setDesbloqueado] = useState(false)
  const [esMovil, setEsMovil] = useState<boolean | null>(null)
  const ultimaActividad = useRef(Date.now())

  // Se mide por ancho de pantalla y no por el user agent: lo que importa es si
  // el aparato se lleva encima, y una tablet en la calle corre el mismo riesgo
  // que un teléfono.
  useEffect(() => {
    const medir = () => setEsMovil(window.innerWidth < 1024)
    medir()
    window.addEventListener('resize', medir)
    return () => window.removeEventListener('resize', medir)
  }, [])

  const activo =
    process.env.NEXT_PUBLIC_PIN_ACTIVO === 'true' &&
    status === 'authenticated' &&
    esMovil === true &&
    // El login no lleva PIN: aún no hay sesión que proteger.
    !pathname?.startsWith('/login')

  const { data: estado } = useQuery<{ configurado: boolean }>({
    queryKey: ['pin', 'estado'],
    queryFn: () => api.get('/auth/pin/estado').then((r) => r.data),
    enabled: activo,
    staleTime: 60_000,
  })

  // Reloj de inactividad. Se reinicia con cualquier interacción real; mover el
  // ratón no cuenta como uso en un teléfono.
  const marcar = useCallback(() => {
    ultimaActividad.current = Date.now()
  }, [])

  useEffect(() => {
    if (!activo || !desbloqueado) return
    const eventos = ['click', 'keydown', 'touchstart', 'scroll']
    eventos.forEach((e) => window.addEventListener(e, marcar, { passive: true }))

    const t = setInterval(() => {
      if (Date.now() - ultimaActividad.current > MINUTOS_INACTIVIDAD * 60_000) {
        setDesbloqueado(false)
      }
    }, 30_000)

    // Volver a la app tras un rato en segundo plano también cuenta: es el caso
    // de dejar el teléfono sobre la mesa.
    const alVolver = () => {
      if (
        document.visibilityState === 'visible' &&
        Date.now() - ultimaActividad.current > MINUTOS_INACTIVIDAD * 60_000
      ) {
        setDesbloqueado(false)
      }
    }
    document.addEventListener('visibilitychange', alVolver)

    return () => {
      eventos.forEach((e) => window.removeEventListener(e, marcar))
      clearInterval(t)
      document.removeEventListener('visibilitychange', alVolver)
    }
  }, [activo, desbloqueado, marcar])

  if (!activo || !estado) return <>{children}</>

  if (!estado.configurado) {
    return (
      <PantallaPin
        modo="configurar"
        onListo={() => {
          marcar()
          setDesbloqueado(true)
        }}
      />
    )
  }

  if (!desbloqueado) {
    return (
      <PantallaPin
        modo="desbloquear"
        onListo={() => {
          marcar()
          setDesbloqueado(true)
        }}
      />
    )
  }

  return <>{children}</>
}
