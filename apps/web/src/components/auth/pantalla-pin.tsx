'use client'

import { useCallback, useEffect, useState } from 'react'
import { signOut } from 'next-auth/react'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Check, Lock, ShieldCheck } from 'lucide-react'

const NAVY = '#0C2057'
const GOLD = '#DBAA59'
const LARGO = 6

/** Teclado numérico. En móvil es más rápido y menos propenso a errores que
 *  escribir en un campo suelto. */
function Teclado({
  onDigito,
  onBorrar,
  deshabilitado,
}: {
  onDigito: (d: string) => void
  onBorrar: () => void
  deshabilitado?: boolean
}) {
  const teclas = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '←']
  return (
    <div className="mx-auto grid max-w-[260px] grid-cols-3 gap-3">
      {teclas.map((t, i) =>
        t === '' ? (
          <div key={i} />
        ) : (
          <button
            key={i}
            type="button"
            disabled={deshabilitado}
            onClick={() => (t === '←' ? onBorrar() : onDigito(t))}
            /* Numeros en BLANCO: el navy de la marca sobre el fondo navy de
               esta pantalla los dejaba practicamente invisibles. */
            className="h-14 rounded-xl border text-xl font-medium text-white transition-colors active:bg-white/20 disabled:opacity-40"
            style={{ borderColor: 'rgba(255,255,255,.28)' }}
          >
            {t}
          </button>
        ),
      )}
    </div>
  )
}

function Puntos({ n, error }: { n: number; error?: boolean }) {
  return (
    <div className="mb-6 flex justify-center gap-2.5">
      {Array.from({ length: LARGO }).map((_, i) => (
        <span
          key={i}
          className="h-3 w-3 rounded-full transition-colors"
          style={{
            backgroundColor: error ? '#dc2626' : i < n ? GOLD : 'rgba(255,255,255,.25)',
          }}
        />
      ))}
    </div>
  )
}

/**
 * Pantalla de PIN: cubre la app entera hasta que se desbloquea.
 *
 * Tiene dos modos, segun si la persona ya tiene PIN:
 *  - configurar: lo crea. Exige la contraseña escrita.
 *  - desbloquear: lo pide para entrar.
 */
export function PantallaPin({
  modo,
  onListo,
}: {
  modo: 'configurar' | 'desbloquear'
  onListo: () => void
}) {
  const [pin, setPin] = useState('')
  const [confirmacion, setConfirmacion] = useState('')
  const [paso, setPaso] = useState<'pin' | 'repetir' | 'password'>('pin')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(false)
  /** Confirmacion breve tras crear el PIN, antes de entrar al CRM. */
  const [listo, setListo] = useState(false)

  const actual = paso === 'repetir' ? confirmacion : pin
  const set = paso === 'repetir' ? setConfirmacion : setPin

  const verificar = useCallback(async (valor: string) => {
    setCargando(true)
    setError(null)
    try {
      await api.post('/auth/pin/verificar', { pin: valor })
      onListo()
    } catch (e: any) {
      const d = e?.response?.data
      // Agotados los intentos, el servidor pide cerrar sesion: se cumple aqui
      // porque de nada sirve avisar si la sesion sigue viva en el telefono.
      if (d?.cerrarSesion) {
        await signOut({ callbackUrl: '/login' })
        return
      }
      setError(
        d?.intentosRestantes !== undefined
          ? `PIN incorrecto. Te ${d.intentosRestantes === 1 ? 'queda 1 intento' : `quedan ${d.intentosRestantes} intentos`}.`
          : (d?.message ?? 'No se pudo verificar el PIN'),
      )
      setPin('')
    } finally {
      setCargando(false)
    }
  }, [onListo])

  // Al completar los 6 digitos avanza solo: pedir un boton extra despues de
  // teclear el ultimo numero es un paso que nadie espera.
  useEffect(() => {
    if (cargando) return
    if (modo === 'desbloquear' && pin.length === LARGO) {
      verificar(pin)
    } else if (modo === 'configurar' && paso === 'pin' && pin.length === LARGO) {
      setPaso('repetir')
    } else if (modo === 'configurar' && paso === 'repetir' && confirmacion.length === LARGO) {
      if (confirmacion !== pin) {
        setError('Los PIN no coinciden. Empieza de nuevo.')
        setPin('')
        setConfirmacion('')
        setPaso('pin')
      } else {
        setPaso('password')
      }
    }
  }, [pin, confirmacion, paso, modo, cargando, verificar])

  async function guardar() {
    setCargando(true)
    setError(null)
    try {
      await api.post('/auth/pin/configurar', { pin, password })
      // Se muestra la confirmacion un momento y despues se entra: sin ella, la
      // pantalla desaparecia de golpe y no quedaba claro si se habia guardado.
      setListo(true)
      setTimeout(() => onListo(), 900)
    } catch (e: any) {
      const m = e?.response?.data?.message
      setError(Array.isArray(m) ? m.join(', ') : (m ?? 'No se pudo guardar el PIN'))
      // Si la contraseña estaba mal, se vuelve a ese paso; el PIN ya elegido se
      // conserva para no hacerle teclear todo otra vez.
      setPassword('')
    } finally {
      setCargando(false)
    }
  }

  const titulo =
    modo === 'desbloquear'
      ? 'Ingresa tu PIN'
      : paso === 'pin'
        ? 'Crea tu PIN'
        : paso === 'repetir'
          ? 'Repite tu PIN'
          : 'Confirma con tu contraseña'

  if (listo) {
    return (
      <div
        className="fixed inset-0 z-[100] flex flex-col items-center justify-center p-6 text-center text-white"
        style={{ background: `linear-gradient(160deg, ${NAVY} 0%, #081334 100%)` }}
      >
        <div
          className="mb-4 flex h-16 w-16 items-center justify-center rounded-full"
          style={{ backgroundColor: 'rgba(95,211,141,.15)' }}
        >
          <Check className="h-8 w-8" style={{ color: '#5FD38D' }} strokeWidth={3} />
        </div>
        <p className="text-lg font-bold">PIN configurado</p>
        <p className="mt-1 text-sm text-slate-300">Entrando al CRM…</p>
      </div>
    )
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center p-6 text-white"
      style={{ background: `linear-gradient(160deg, ${NAVY} 0%, #081334 100%)` }}
    >
      <div className="w-full max-w-sm text-center">
        <div
          className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl"
          style={{ backgroundColor: 'rgba(219,170,89,.15)' }}
        >
          {modo === 'desbloquear' ? (
            <Lock className="h-6 w-6" style={{ color: GOLD }} />
          ) : (
            <ShieldCheck className="h-6 w-6" style={{ color: GOLD }} />
          )}
        </div>

        <h1 className="text-xl font-bold">{titulo}</h1>
        <p className="mb-7 mt-1.5 text-sm text-slate-300">
          {modo === 'configurar' && paso === 'pin'
            ? 'Con este PIN entrarás desde el celular sin escribir tu contraseña.'
            : modo === 'configurar' && paso === 'password'
              ? 'Escribe tu contraseña para confirmar que eres tú.'
              : modo === 'desbloquear'
                ? 'Protege los datos de tus clientes si pierdes el teléfono.'
                : ''}
        </p>

        {paso === 'password' ? (
          <div className="space-y-3">
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Tu contraseña"
              autoFocus
              /* Se bloquea el autocompletado a proposito: si el navegador
                 rellenara la contraseña guardada, quien robe el telefono podria
                 ponerse un PIN nuevo sin saberla, y el PIN no serviria de nada. */
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              name={`confirmacion-${Math.random().toString(36).slice(2)}`}
              className="bg-white/10 text-center text-white placeholder:text-slate-400"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && password) guardar()
              }}
            />
            <Button
              onClick={guardar}
              disabled={!password || cargando}
              className="w-full"
              style={{ backgroundColor: GOLD, color: NAVY }}
            >
              {cargando ? 'Guardando…' : 'Guardar PIN'}
            </Button>
          </div>
        ) : (
          <>
            <Puntos n={actual.length} error={!!error} />
            <Teclado
              deshabilitado={cargando}
              onDigito={(d) => {
                setError(null)
                set((v) => (v.length < LARGO ? v + d : v))
              }}
              onBorrar={() => {
                setError(null)
                set((v) => v.slice(0, -1))
              }}
            />
          </>
        )}

        {error && <p className="mt-5 text-sm text-red-300">{error}</p>}

        {modo === 'desbloquear' && (
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="mt-7 text-xs text-slate-400 underline underline-offset-2"
          >
            Olvidé mi PIN — entrar con contraseña
          </button>
        )}
      </div>
    </div>
  )
}
