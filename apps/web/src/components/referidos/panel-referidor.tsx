'use client'

import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import {
  Check,
  Copy,
  Download,
  Share2,
  Sparkles,
  TrendingUp,
  UserPlus,
  X,
} from 'lucide-react'
import { NIVELES, nivelDe, progresoNivel, siguienteNivel } from './niveles'

const NAVY = '#0C2057'
const GOLD = '#DBAA59'
const VERDE = '#15803d'
const AMBAR = '#b45309'

interface Referido {
  id: string
  nombres: string
  interes: string | null
  estado: 'RECIBIDO' | 'EN_GESTION' | 'CERRADO' | 'ACREDITADO' | 'NO_PROSPERO'
  puntos: number | null
  monto: number | null
  motivo: string | null
  createdAt: string
  acreditadoEn: string | null
}

interface Panel {
  codigo: string
  nombres: string
  puntos: number
  ganado: number
  porCobrar: number
  puntosPorReferido: number
  referidos: Referido[]
}

/**
 * Cómo se nombra cada estado al referidor.
 *
 * Se le dice en qué va cada referido —las fuentes coinciden en que la
 * transparencia sostiene la participación— pero sin detalles internos: no ve
 * quién lo está gestionando ni en qué etapa del pipeline está.
 */
const ESTADO: Record<Referido['estado'], { label: string; color?: string; fondo?: string }> = {
  RECIBIDO: { label: 'Recibido' },
  EN_GESTION: { label: 'Lo está viendo un asesor' },
  CERRADO: { label: 'Cerrado' },
  ACREDITADO: { label: 'Acreditado', color: VERDE, fondo: '#f0fdf4' },
  NO_PROSPERO: { label: 'No prosperó', color: AMBAR, fondo: '#fffbeb' },
}

/** Premios de referencia, hasta que se cargue el catálogo real. */
const ESCALONES = [
  { puntos: 20, nombre: 'Café y desayuno' },
  { puntos: 50, nombre: 'Entrada al cine' },
  { puntos: 80, nombre: 'Un día en Jacarandá' },
]

const RAMOS = [
  { valor: 'SALUD', label: 'Salud' },
  { valor: 'AUTO', label: 'Vehículo' },
  { valor: 'VIDA', label: 'Vida' },
  { valor: 'HOGAR', label: 'Hogar' },
]

/**
 * Pantalla del referidor.
 *
 * Entra con su código, que es su credencial: no hay usuario ni contraseña porque
 * pedirle crear una cuenta para mandar un contacto perdería a la mitad antes de
 * empezar.
 */
/**
 * Invitacion a instalar la app.
 *
 * El navegador avisa cuando se puede instalar y hay que guardar ese aviso para
 * dispararlo despues: si no se captura, el unico camino es el menu del
 * navegador, que casi nadie encuentra.
 *
 * En iPhone no existe ese aviso, asi que ahi se explica el paso a mano.
 */
function useInstalar() {
  const [evento, setEvento] = useState<any>(null)
  const [esIphone, setEsIphone] = useState(false)
  const [yaInstalada, setYaInstalada] = useState(true)

  useEffect(() => {
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true
    setYaInstalada(standalone)
    setEsIphone(/iphone|ipad|ipod/i.test(window.navigator.userAgent))

    const alInstalar = (e: Event) => {
      e.preventDefault()
      setEvento(e)
    }
    window.addEventListener('beforeinstallprompt', alInstalar)
    return () => window.removeEventListener('beforeinstallprompt', alInstalar)
  }, [])

  return {
    puede: !yaInstalada && (!!evento || esIphone),
    esIphone,
    instalar: async () => {
      if (!evento) return
      evento.prompt()
      await evento.userChoice
      setEvento(null)
    },
  }
}

export function PanelReferidor({ codigo }: { codigo: string }) {
  const qc = useQueryClient()
  const instalacion = useInstalar()
  const [verComoInstalar, setVerComoInstalar] = useState(false)
  const [abierto, setAbierto] = useState(false)
  const [copiado, setCopiado] = useState(false)
  const [form, setForm] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)

  const { data, isLoading, isError, error: errorPanel } = useQuery<Panel>({
    queryKey: ['panel-referidor', codigo],
    queryFn: () => api.get(`/referidos/panel/${codigo}`).then((r) => r.data),
    // Sin reintentos: si el código no existe, insistir no lo va a crear, y
    // deja la pantalla cargando varios segundos sin decir nada.
    retry: false,
  })

  const referir = useMutation({
    mutationFn: () => api.post(`/referidos/panel/${codigo}/referir`, form),
    onSuccess: () => {
      setForm({})
      setAbierto(false)
      setError(null)
      qc.invalidateQueries({ queryKey: ['panel-referidor', codigo] })
    },
    onError: (e: any) => {
      const m = e?.response?.data?.message
      setError(Array.isArray(m) ? m.join(', ') : (m ?? 'No se pudo enviar'))
    },
  })

  if (isLoading) {
    return <p className="py-20 text-center text-sm text-muted-foreground">Cargando…</p>
  }

  if (isError || !data) {
    /**
     * Se distingue el código que no existe de un fallo del servidor.
     *
     * Antes los dos decían "no encontramos ese código", así que un error de
     * conexión parecía un enlace mal copiado y no había forma de saber cuál de
     * los dos era.
     */
    const estado = (errorPanel as any)?.response?.status
    const noExiste = estado === 404
    const detalle = (errorPanel as any)?.response?.data?.message ?? (errorPanel as any)?.message

    return (
      <div className="flex min-h-[70vh] items-center justify-center px-4">
        <div className="max-w-sm text-center">
          <p className="text-sm" style={{ color: NAVY }}>
            {noExiste
              ? 'No encontramos ese código.'
              : 'No pudimos cargar tu información en este momento.'}
          </p>
          <p className="mt-1.5 text-xs text-muted-foreground">
            {noExiste
              ? 'Revisa el enlace que te compartieron, o pídelo de nuevo.'
              : 'Vuelve a intentarlo en un momento.'}
          </p>
          {/* El detalle técnico, en pequeño: sirve para poder decir qué pasó
              cuando alguien reporta el problema. */}
          {!noExiste && detalle && (
            <p className="mt-3 text-[10px] text-muted-foreground/60">{String(detalle)}</p>
          )}
        </div>
      </div>
    )
  }

  /**
   * Nivel y progreso.
   *
   * Es lo que hace funcionar a Vitality: no basta con acumular puntos, tiene que
   * haber una categoría visible y un siguiente escalón cerca. "Te faltan 2 para
   * Plata" mueve más que "tienes 30 puntos".
   */
  const acreditados = data.referidos.filter((r) => r.estado === 'ACREDITADO').length
  const enCamino = data.referidos.filter((r) =>
    ['RECIBIDO', 'EN_GESTION', 'CERRADO'].includes(r.estado),
  ).length

  const nivel = nivelDe(acreditados)
  const siguiente = siguienteNivel(acreditados)
  const progreso = progresoNivel(acreditados)
  const proximoPremio = ESCALONES.find((e) => e.puntos > data.puntos)

  /**
   * El enlace que comparte NO es el de su panel.
   *
   * /r/CODIGO es privado —sus puntos, sus referidos— y /ref/CODIGO es donde su
   * contacto pone sus datos. Compartir el primero le habria mostrado a su amigo
   * los puntos de ella en vez de un formulario.
   *
   * Se usa el dominio publico y no la direccion desde donde se abre: quien
   * recibe el enlace no es del equipo, y "crm.priorityhealth.ec" le diria que
   * esta entrando a un sistema interno.
   */
  const dominioPublico =
    process.env.NEXT_PUBLIC_DOMINIO_REFERIDOS ??
    (typeof window !== 'undefined' ? window.location.origin : '')

  const enlaceInvitar = `${dominioPublico}/ref/${data.codigo}`

  /** Mensaje listo para WhatsApp, que es por donde lo va a mandar. */
  const mensajeWhatsapp = encodeURIComponent(
    `Hola! Te recomiendo a Priority, mis asesores de seguros. Son muy buenos. ` +
      `Déjales tus datos aquí y te contactan sin compromiso: ${enlaceInvitar}`,
  )

  return (
    <div className="min-h-screen pb-10" style={{ backgroundColor: '#f4f5f7' }}>
      {/*
        Cabecera con el nivel y el progreso.
        Es lo primero que se ve y lo que da sensación de avance: un número de
        puntos suelto no dice nada, "te faltan 2 para Plata" sí.
      */}
      <div
        className="px-5 pb-16 pt-7"
        style={{ background: `linear-gradient(160deg, ${NAVY} 0%, #16307a 100%)` }}
      >
        <div className="mx-auto max-w-lg">
          <p className="text-xs text-white/60">Hola, {data.nombres.split(' ')[0]}</p>

          <div className="mt-3 flex items-end justify-between gap-4">
            <div>
              <div
                className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1"
                style={{ backgroundColor: 'rgba(255,255,255,.12)' }}
              >
                <Sparkles className="h-3 w-3" style={{ color: GOLD }} />
                <span className="text-xs font-semibold" style={{ color: GOLD }}>
                  Nivel {nivel.nombre}
                </span>
              </div>
              <p className="mt-2 text-4xl font-bold text-white">{data.puntos}</p>
              <p className="text-xs text-white/60">puntos acumulados</p>
            </div>

            <div className="text-right">
              <p className="text-2xl font-bold" style={{ color: GOLD }}>
                ${data.porCobrar.toFixed(0)}
              </p>
              <p className="text-[11px] text-white/60">por cobrar</p>
            </div>
          </div>

          <div className="mt-4">
            <div className="mb-1.5 flex items-center justify-between text-[11px] text-white/70">
              <span>{nivel.nombre}</span>
              <span>
                {siguiente
                  ? `${siguiente.faltan} ${siguiente.faltan === 1 ? 'referido' : 'referidos'} para ${siguiente.nivel.nombre}`
                  : 'Nivel máximo'}
              </span>
            </div>
            <div
              className="h-2 overflow-hidden rounded-full"
              style={{ backgroundColor: 'rgba(255,255,255,.15)' }}
            >
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{ width: `${progreso * 100}%`, backgroundColor: GOLD }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* El contenido sube sobre el degradado: da profundidad y hace que la
          primera tarjeta sea lo que se toca. */}
      <div className="mx-auto -mt-10 max-w-lg space-y-3 px-4">
      <div className="rounded-2xl bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] text-muted-foreground">Tu código</p>
          <p className="text-lg font-bold tracking-wide" style={{ color: NAVY }}>{data.codigo}</p>
        </div>
        <button
          type="button"
          onClick={() => {
            navigator.clipboard?.writeText(enlaceInvitar)
            setCopiado(true)
            setTimeout(() => setCopiado(false), 2000)
          }}
          className="flex shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-medium"
          style={{ color: NAVY }}
        >
          {copiado ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          {copiado ? 'Copiado' : 'Copiar'}
        </button>
        </div>

        {/* WhatsApp primero: es por donde de verdad se comparte, y con el
            mensaje ya escrito no tiene que pensar qué decir. */}
        <a
          href={`https://wa.me/?text=${mensajeWhatsapp}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-white active:scale-[.98]"
          style={{ backgroundColor: '#25D366', transition: 'transform .1s' }}
        >
          <Share2 className="h-4 w-4" /> Compartir por WhatsApp
        </a>

        <button
          type="button"
          onClick={() => setAbierto(true)}
          className="mt-2 flex w-full items-center justify-center gap-1.5 py-1.5 text-xs text-muted-foreground"
        >
          <UserPlus className="h-3.5 w-3.5" /> o agrégalo tú mismo
        </button>
      </div>

        {/* Instalar: va arriba porque cuanto antes la tenga en la pantalla de
            inicio, mas probable es que vuelva. */}
        {instalacion.puede && (
          <button
            type="button"
            onClick={() => (instalacion.esIphone ? setVerComoInstalar(true) : instalacion.instalar())}
            className="flex w-full items-center gap-2.5 rounded-2xl bg-white p-3.5 text-left"
          >
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
              style={{ backgroundColor: '#fffbf3' }}
            >
              <Download className="h-4 w-4" style={{ color: GOLD }} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium" style={{ color: NAVY }}>
                Ténla a mano
              </p>
              <p className="text-[11px] text-muted-foreground">
                Instálala en tu celular y entra con un toque
              </p>
            </div>
          </button>
        )}

        {/* Dos cifras que cuentan la historia: lo cerrado y lo que viene. */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-white p-3.5">
            <p className="text-[11px] text-muted-foreground">Cerrados</p>
            <p className="text-2xl font-bold" style={{ color: NAVY }}>
              {acreditados}
            </p>
          </div>
          <div className="rounded-2xl bg-white p-3.5">
            <p className="text-[11px] text-muted-foreground">En camino</p>
            <p className="text-2xl font-bold" style={{ color: enCamino > 0 ? GOLD : NAVY }}>
              {enCamino}
            </p>
          </div>
        </div>

        {/* El próximo premio. Lo que sostiene la participación no es el premio
            grande, sino ver que el primero está cerca. */}
        {proximoPremio && (
          <div className="rounded-2xl bg-white p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11px] text-muted-foreground">Tu próximo premio</p>
                <p className="text-sm font-semibold" style={{ color: NAVY }}>
                  {proximoPremio.nombre}
                </p>
              </div>
              <p className="shrink-0 text-xs font-medium" style={{ color: GOLD }}>
                faltan {proximoPremio.puntos - data.puntos} pts
              </p>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${(data.puntos / proximoPremio.puntos) * 100}%`,
                  backgroundColor: GOLD,
                }}
              />
            </div>
          </div>
        )}

        {/* Los niveles, para que vea a dónde puede llegar. */}
        <div className="rounded-2xl bg-white p-4">
          <p className="mb-3 text-[11px] text-muted-foreground">Tus niveles</p>
          <div className="flex items-stretch gap-1.5">
            {NIVELES.map((n) => {
              const alcanzado = acreditados >= n.desde
              const actual = n.id === nivel.id
              return (
                <div
                  key={n.id}
                  className="flex-1 rounded-xl px-2 py-2.5 text-center"
                  style={{
                    backgroundColor: alcanzado ? n.fondo : '#fafafa',
                    border: actual ? `1.5px solid ${n.color}` : '1px solid transparent',
                    opacity: alcanzado ? 1 : 0.5,
                  }}
                >
                  <p
                    className="text-[11px] font-semibold"
                    style={{ color: alcanzado ? n.color : '#9ca3af' }}
                  >
                    {n.nombre}
                  </p>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">{n.desde}+</p>
                </div>
              )
            })}
          </div>
          {siguiente?.nivel.beneficio && (
            <p className="mt-2.5 flex items-start gap-1.5 text-[11px] text-muted-foreground">
              <TrendingUp className="mt-0.5 h-3 w-3 shrink-0" style={{ color: GOLD }} />
              En {siguiente.nivel.nombre}: {siguiente.nivel.beneficio}
            </p>
          )}
        </div>

      {/* En iPhone no hay aviso de instalacion: se explica el paso a mano. */}
      {verComoInstalar && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40"
          onClick={() => setVerComoInstalar(false)}
        >
          <div
            className="w-full max-w-lg rounded-t-3xl bg-white p-5"
            onClick={(ev) => ev.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-semibold" style={{ color: NAVY }}>
                Instalar en tu iPhone
              </p>
              <button type="button" onClick={() => setVerComoInstalar(false)}>
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>
            <div className="space-y-3">
              {[
                'Toca el botón de compartir, abajo en el centro de la pantalla.',
                'Baja y elige «Añadir a pantalla de inicio».',
                'Toca «Añadir». Listo, te queda el ícono.',
              ].map((t, i) => (
                <div key={i} className="flex gap-3">
                  <span
                    className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold"
                    style={{ backgroundColor: '#fffbf3', color: GOLD }}
                  >
                    {i + 1}
                  </span>
                  <p className="text-xs text-muted-foreground">{t}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {!abierto ? (
        <button
          type="button"
          onClick={() => setAbierto(true)}
          className="flex w-full items-center justify-center gap-2 rounded-xl border py-2.5 text-sm font-medium"
          style={{ color: NAVY }}
        >
          <UserPlus className="h-4 w-4" /> O agrégalo tú mismo
        </button>
      ) : (
        <div className="space-y-2.5 rounded-xl border p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold" style={{ color: NAVY }}>
              Referir a alguien
            </p>
            <button type="button" onClick={() => setAbierto(false)}>
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>

          {error && (
            <p className="rounded-lg bg-amber-50 px-2.5 py-2 text-xs text-amber-900">{error}</p>
          )}

          <input
            autoFocus
            value={form.nombres ?? ''}
            onChange={(e) => setForm((f) => ({ ...f, nombres: e.target.value }))}
            placeholder="Nombre de tu contacto"
            className="h-10 w-full rounded-lg border px-3 text-sm"
          />
          <input
            value={form.celular ?? ''}
            onChange={(e) => setForm((f) => ({ ...f, celular: e.target.value }))}
            placeholder="Celular"
            inputMode="tel"
            className="h-10 w-full rounded-lg border px-3 text-sm"
          />
          <input
            value={form.email ?? ''}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            placeholder="Correo (opcional)"
            inputMode="email"
            className="h-10 w-full rounded-lg border px-3 text-sm"
          />

          <div>
            <p className="mb-1.5 text-[11px] text-muted-foreground">¿Qué le interesa?</p>
            <div className="flex flex-wrap gap-1.5">
              {RAMOS.map((r) => (
                <button
                  key={r.valor}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, interes: r.valor }))}
                  className="rounded-full border px-3 py-1 text-xs"
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

          <input
            value={form.nota ?? ''}
            onChange={(e) => setForm((f) => ({ ...f, nota: e.target.value }))}
            placeholder="Algo que debamos saber (opcional)"
            className="h-10 w-full rounded-lg border px-3 text-sm"
          />

          <button
            type="button"
            onClick={() => referir.mutate()}
            disabled={!form.nombres?.trim() || !form.celular?.trim() || referir.isPending}
            className="w-full rounded-lg py-2.5 text-sm font-semibold text-white disabled:opacity-40"
            style={{ backgroundColor: NAVY }}
          >
            {referir.isPending ? 'Enviando…' : 'Enviar'}
          </button>
          <p className="text-center text-[11px] text-muted-foreground">
            Un asesor lo contacta y tú ganas {data.puntosPorReferido} puntos cuando cierre.
          </p>
        </div>
      )}

      {data.referidos.length > 0 && (
        <div>
          <p className="mb-2 text-xs text-muted-foreground">
            Tus referidos ({data.referidos.length})
          </p>
          <div className="overflow-hidden rounded-xl border">
            {data.referidos.map((r, i) => {
              const e = ESTADO[r.estado]
              return (
                <div
                  key={r.id}
                  className="flex items-start justify-between gap-3 px-3.5 py-2.5"
                  style={{ borderTop: i > 0 ? '1px solid #e5e7eb' : undefined }}
                >
                  <div className="min-w-0">
                    <p className="text-sm" style={{ color: NAVY }}>
                      {r.nombres}
                    </p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {RAMOS.find((x) => x.valor === r.interes)?.label ?? 'Sin definir'} ·{' '}
                      {new Date(r.createdAt).toLocaleDateString('es-EC', {
                        day: 'numeric',
                        month: 'short',
                      })}
                    </p>
                    {/* Cuando no prospera se dice por qué: sin eso, la próxima
                        vez refiere otro contacto igual. */}
                    {r.motivo && (
                      <p className="mt-0.5 text-[11px]" style={{ color: AMBAR }}>
                        {r.motivo}
                      </p>
                    )}
                  </div>

                  <span
                    className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium"
                    style={{
                      backgroundColor: e.fondo ?? '#f4f5f7',
                      color: e.color ?? '#6b7280',
                    }}
                  >
                    {r.estado === 'ACREDITADO' && r.puntos
                      ? `+${r.puntos} pts · $${r.monto}`
                      : e.label}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

        {/* Primera vez: en vez de ceros, cómo funciona. Alguien que entra y ve
            todo en cero sin explicación no vuelve. */}
        {data.referidos.length === 0 && (
          <div className="rounded-2xl bg-white p-5">
            <p className="text-sm font-semibold" style={{ color: NAVY }}>
              Cómo funciona
            </p>
            <div className="mt-3 space-y-3">
              {[
                'Compartes tu enlace con quien creas que le sirve un seguro.',
                'Un asesor lo contacta y le explica sus opciones, sin compromiso.',
                `Si contrata, ganas dinero y ${data.puntosPorReferido} puntos.`,
              ].map((t, i) => (
                <div key={i} className="flex gap-3">
                  <span
                    className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold"
                    style={{ backgroundColor: '#fffbf3', color: GOLD }}
                  >
                    {i + 1}
                  </span>
                  <p className="text-xs text-muted-foreground">{t}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
