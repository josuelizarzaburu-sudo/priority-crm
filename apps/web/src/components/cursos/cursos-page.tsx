'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Award, Check, ChevronLeft, Lock, PlayCircle, Settings } from 'lucide-react'
import { useSession } from 'next-auth/react'
import { CursosAdmin } from './cursos-admin'

const NAVY = '#0C2057'
const GOLD = '#DBAA59'
const VERDE = '#5FD38D'

interface ModuloResumen {
  id: string
  titulo: string
  duracionMin: number | null
  orden: number
  preguntas: number
  aprobado: boolean
}

interface CursoResumen {
  id: string
  titulo: string
  descripcion: string | null
  aseguradora: string | null
  publicado: boolean
  totalModulos: number
  modulosAprobados: number
  completado: boolean
  certificado: { nota: number; venceEn: string; codigo: string; vencido: boolean } | null
  modulos: ModuloResumen[]
}

interface Pregunta {
  id: string
  enunciado: string
  /** `valor` es la posición original: es contra eso que corrige el servidor. */
  opciones: { texto: string; valor: number }[]
}

interface ModuloAbierto {
  id: string
  titulo: string
  descripcion: string | null
  youtubeUrl: string
  curso: { id: string; titulo: string; notaMinima: number }
  preguntas: Pregunta[]
  puedeIntentar: boolean
  motivoBloqueo: string | null
  segundosRestantes: number | null
  intentosRestantesHoy: number | null
  yaAprobado: boolean
}

interface Resultado {
  nota: number
  aciertos: number
  total: number
  aprobado: boolean
  notaMinima: number
  detalle: {
    preguntaId: string
    enunciado: string
    // Al reprobar llegan en null: no se revela la respuesta para que el
    // siguiente intento no sea copiar y pegar.
    correcta: number | null
    elegida: number | null
    acerto: boolean
    explicacion: string | null
  }[]
  certificado: { nota: number; venceEn: string; codigo: string } | null
  intentosRestantesHoy: number | null
  esperaMinutos: number
}

function fecha(iso: string) {
  return new Date(iso).toLocaleDateString('es-EC', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

/** Un módulo en curso: video arriba, preguntas debajo. */
function VistaModulo({
  moduloId,
  onSalir,
}: {
  moduloId: string
  onSalir: () => void
}) {
  const qc = useQueryClient()
  const [respuestas, setRespuestas] = useState<Record<string, number>>({})
  const [resultado, setResultado] = useState<Resultado | null>(null)

  const { data: modulo, isLoading } = useQuery<ModuloAbierto>({
    queryKey: ['curso-modulo', moduloId],
    queryFn: () => api.get(`/cursos/modulos/${moduloId}`).then((r) => r.data),
  })

  const enviar = useMutation({
    mutationFn: () =>
      api
        .post(`/cursos/modulos/${moduloId}/responder`, {
          respuestas: Object.entries(respuestas).map(([preguntaId, opcion]) => ({
            preguntaId,
            opcion,
          })),
        })
        .then((r) => r.data as Resultado),
    onSuccess: (r) => {
      setResultado(r)
      qc.invalidateQueries({ queryKey: ['cursos'] })
      qc.invalidateQueries({ queryKey: ['mis-certificados'] })
    },
  })

  if (isLoading || !modulo) {
    return <p className="py-16 text-center text-sm text-muted-foreground">Cargando…</p>
  }

  const todasRespondidas = modulo.preguntas.every((p) => respuestas[p.id] !== undefined)

  // ── Resultado ──
  if (resultado) {
    return (
      <div className="mx-auto max-w-4xl space-y-4">
        <div
          className="rounded-2xl p-7 text-center text-white md:p-9"
          style={{
            background: resultado.aprobado
              ? `linear-gradient(135deg, ${NAVY}, #1a3a6b)`
              : 'linear-gradient(135deg, #7f1d1d, #991b1b)',
          }}
        >
          <p className="text-5xl font-bold md:text-6xl">{resultado.nota}</p>
          <p className="mt-1 text-sm opacity-80">
            {resultado.aciertos} de {resultado.total} correctas
          </p>
          <p className="mt-3 text-lg font-semibold" style={{ color: resultado.aprobado ? GOLD : '#fecaca' }}>
            {resultado.aprobado ? '¡Aprobado!' : `Necesitas ${resultado.notaMinima} para aprobar`}
          </p>
          {!resultado.aprobado && (
            <p className="mt-2 text-xs opacity-75">
              {resultado.intentosRestantesHoy === 0
                ? 'Se te acabaron los intentos de hoy. Vuelve mañana con el video repasado.'
                : `Podrás reintentar en ${resultado.esperaMinutos} minutos${
                    resultado.intentosRestantesHoy !== null
                      ? ` · te ${resultado.intentosRestantesHoy === 1 ? 'queda 1 intento' : `quedan ${resultado.intentosRestantesHoy} intentos`} hoy`
                      : ''
                  }`}
            </p>
          )}
        </div>

        {resultado.certificado && (
          <div className="rounded-xl border-2 p-5 text-center" style={{ borderColor: GOLD }}>
            <Award className="mx-auto h-9 w-9" style={{ color: GOLD }} />
            <p className="mt-2 font-bold" style={{ color: NAVY }}>
              ¡Completaste el curso!
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Certificado {resultado.certificado.codigo} · nota {resultado.certificado.nota}
            </p>
          </div>
        )}

        {!resultado.aprobado && (
          <p className="text-xs text-muted-foreground">
            Estas fallaste. No se muestran las respuestas: vuelve al video y repásalas.
          </p>
        )}

        {/* Al aprobar, el repaso completo con explicaciones: es donde de verdad
            se aprende. Al reprobar solo se marca cual se fallo. */}
        <div className="grid gap-2 lg:grid-cols-2">
          {resultado.detalle.map((d, i) => (
            <div
              key={d.preguntaId}
              className="rounded-xl border p-3.5"
              style={{
                borderLeftWidth: 4,
                borderLeftColor: d.acerto ? VERDE : '#dc2626',
              }}
            >
              <p className="text-sm font-medium" style={{ color: NAVY }}>
                {i + 1}. {d.enunciado}
              </p>
              <p className="mt-1 text-xs" style={{ color: d.acerto ? '#15803d' : '#b91c1c' }}>
                {d.acerto ? 'Correcta' : 'Incorrecta'}
              </p>
              {d.explicacion && (
                <p className="mt-1.5 text-xs text-muted-foreground">{d.explicacion}</p>
              )}
            </div>
          ))}
        </div>

        <div className="flex justify-end gap-2">
          {/* No se ofrece "reintentar" al instante: hay que esperar, asi que el
              boton mandaria a una pantalla que no deja enviar. Se vuelve al
              curso, que es lo util —repasar el video. */}
          <Button onClick={onSalir} style={{ backgroundColor: NAVY, color: '#fff' }}>
            Volver al curso
          </Button>
        </div>
      </div>
    )
  }

  // ── Video + preguntas ──
  return (
    <div className="w-full space-y-4">
      <button
        type="button"
        onClick={onSalir}
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" /> {modulo.curso.titulo}
      </button>

      <div>
        <h1 className="text-2xl font-bold md:text-3xl" style={{ color: NAVY }}>
          {modulo.titulo}
        </h1>
        {modulo.descripcion && (
          <p className="mt-1 text-sm text-muted-foreground md:text-base">{modulo.descripcion}</p>
        )}
      </div>

      {/* Dos columnas en pantallas anchas: el video a la izquierda y las
          preguntas a la derecha, ambos a la vista.
          Ademas de aprovechar el ancho, deja consultar el video mientras se
          responde sin tener que desplazarse arriba y abajo.
          En movil se apila, con el video primero. */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(380px,1fr)] lg:items-start">
        <div className="aspect-video overflow-hidden rounded-xl bg-black lg:sticky lg:top-4">
          <iframe
            src={modulo.youtubeUrl}
            title={modulo.titulo}
            className="h-full w-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>

        <div className="rounded-xl border p-4 md:p-5">
          {/* Si no puede intentar, se dice ANTES de las preguntas: descubrirlo
              despues de responder todo seria irritante. */}
          {!modulo.puedeIntentar && modulo.motivoBloqueo && (
            <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-900">
              {modulo.motivoBloqueo}
            </div>
          )}
          {modulo.puedeIntentar &&
            modulo.intentosRestantesHoy !== null &&
            !modulo.yaAprobado && (
              <p className="mb-3 text-xs text-muted-foreground">
                Te {modulo.intentosRestantesHoy === 1 ? 'queda 1 intento' : `quedan ${modulo.intentosRestantesHoy} intentos`} hoy en este módulo.
              </p>
            )}
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide" style={{ color: GOLD }}>
            {modulo.preguntas.length === 1
              ? '1 pregunta'
              : `${modulo.preguntas.length} preguntas`}
          </p>

          <div className="space-y-5">
            {modulo.preguntas.map((p, i) => (
              <div key={p.id}>
                <p className="mb-2.5 text-sm font-medium md:text-base" style={{ color: NAVY }}>
                  {i + 1}. {p.enunciado}
                </p>
                <div className="space-y-1.5">
                  {p.opciones.map((op, j) => {
                    const elegida = respuestas[p.id] === j
                    return (
                      <button
                        key={j}
                        type="button"
                        onClick={() => setRespuestas((r) => ({ ...r, [p.id]: j }))}
                        className="flex w-full items-center gap-2.5 rounded-lg border p-3 text-left text-sm transition-colors md:text-[15px]"
                        style={{
                          borderColor: elegida ? NAVY : undefined,
                          borderWidth: elegida ? 1.5 : 1,
                          backgroundColor: elegida ? '#eef2f8' : undefined,
                        }}
                      >
                        <span
                          className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2"
                          style={{ borderColor: elegida ? NAVY : '#cbd5e1' }}
                        >
                          {elegida && (
                            <span
                              className="h-2 w-2 rounded-full"
                              style={{ backgroundColor: NAVY }}
                            />
                          )}
                        </span>
                        {op.texto}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>

            <Button
              className="mt-5 w-full"
              disabled={!todasRespondidas || enviar.isPending || !modulo.puedeIntentar}
              onClick={() => enviar.mutate()}
              style={{ backgroundColor: NAVY, color: '#fff' }}
            >
              {enviar.isPending
                ? 'Corrigiendo…'
                : todasRespondidas
                  ? 'Enviar respuestas'
                  : 'Responde todas las preguntas'}
            </Button>
          </div>
        </div>
    </div>
  )
}

/** Lista de módulos de un curso. */
function VistaCurso({ curso, onSalir }: { curso: CursoResumen; onSalir: () => void }) {
  const [moduloAbierto, setModuloAbierto] = useState<string | null>(null)

  if (moduloAbierto) {
    return <VistaModulo moduloId={moduloAbierto} onSalir={() => setModuloAbierto(null)} />
  }

  const pct = curso.totalModulos
    ? Math.round((curso.modulosAprobados / curso.totalModulos) * 100)
    : 0

  // 4xl y no 2xl: la tarjeta del curso y la lista de modulos aprovechan el
  // ancho. No se deja completo a proposito: una linea de texto de 2000px se lee
  // peor que una de 900.
  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <button
        type="button"
        onClick={onSalir}
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" /> Capacitaciones
      </button>

      <div
        className="rounded-2xl p-5 text-white"
        style={{ background: `linear-gradient(135deg, ${NAVY}, #1a3a6b)` }}
      >
        {curso.aseguradora && (
          <p className="text-xs uppercase tracking-wide" style={{ color: GOLD }}>
            {curso.aseguradora}
          </p>
        )}
        <h1 className="mt-0.5 text-2xl font-bold md:text-3xl">{curso.titulo}</h1>
        {curso.descripcion && (
          <p className="mt-1.5 text-sm text-slate-300 md:text-base">{curso.descripcion}</p>
        )}
        <div className="mt-4 flex items-center gap-2.5">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/20">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${pct}%`, backgroundColor: VERDE }}
            />
          </div>
          <span className="shrink-0 text-xs text-slate-300">
            {curso.modulosAprobados} de {curso.totalModulos}
          </span>
        </div>
      </div>

      {curso.certificado && !curso.certificado.vencido && (
        <div
          className="flex items-center gap-3 rounded-xl border-2 p-4"
          style={{ borderColor: GOLD, backgroundColor: '#fffbf3' }}
        >
          <Award className="h-8 w-8 shrink-0" style={{ color: GOLD }} />
          <div className="min-w-0">
            <p className="text-sm font-bold" style={{ color: NAVY }}>
              Certificado obtenido · {curso.certificado.nota}/100
            </p>
            <p className="text-xs text-muted-foreground">
              Válido hasta {fecha(curso.certificado.venceEn)} · código {curso.certificado.codigo}
            </p>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {curso.modulos.map((m, i) => {
          // Se abre el primero sin aprobar y todos los ya aprobados; el resto
          // queda bloqueado. Sin ese orden, se salta al ultimo y el certificado
          // deja de significar algo.
          const anteriores = curso.modulos.slice(0, i)
          const desbloqueado = anteriores.every((a) => a.aprobado)
          const sinPreguntas = m.preguntas === 0

          return (
            <button
              key={m.id}
              type="button"
              disabled={!desbloqueado || sinPreguntas}
              onClick={() => setModuloAbierto(m.id)}
              className="flex w-full items-center gap-3.5 rounded-xl border p-4 text-left transition-shadow disabled:cursor-not-allowed hover:enabled:shadow-sm md:p-5"
              style={{ opacity: desbloqueado ? 1 : 0.5 }}
            >
              <span
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full md:h-9 md:w-9"
                style={{
                  backgroundColor: m.aprobado ? VERDE : desbloqueado ? '#eef2f8' : '#f1f5f9',
                }}
              >
                {m.aprobado ? (
                  <Check className="h-4 w-4 text-white" strokeWidth={3} />
                ) : desbloqueado ? (
                  <PlayCircle className="h-4 w-4" style={{ color: NAVY }} />
                ) : (
                  <Lock className="h-3.5 w-3.5 text-slate-400" />
                )}
              </span>

              <div className="min-w-0 flex-1">
                <p
                  className="text-sm font-medium md:text-base"
                  style={{ color: m.aprobado ? '#64748b' : NAVY }}
                >
                  Módulo {i + 1} · {m.titulo}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {m.duracionMin ? `${m.duracionMin} min · ` : ''}
                  {sinPreguntas
                    ? 'Sin preguntas todavía'
                    : m.preguntas === 1
                      ? '1 pregunta'
                      : `${m.preguntas} preguntas`}
                </p>
              </div>

              {m.aprobado && (
                <span className="shrink-0 text-xs" style={{ color: VERDE }}>
                  Aprobado
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

/** Quién administra cursos. Debe coincidir con la API. */
const PUEDEN_ADMINISTRAR = ['SUPER_ADMIN', 'OWNER', 'MANAGER']

export function CursosPage() {
  const [cursoAbierto, setCursoAbierto] = useState<string | null>(null)
  const [administrando, setAdministrando] = useState(false)
  const { data: session } = useSession()
  const puedeAdministrar = PUEDEN_ADMINISTRAR.includes((session?.user as any)?.role ?? '')

  const { data: cursos = [], isLoading } = useQuery<CursoResumen[]>({
    queryKey: ['cursos'],
    queryFn: () => api.get('/cursos').then((r) => r.data),
  })

  const activo = cursos.find((c) => c.id === cursoAbierto)
  if (activo) {
    return <VistaCurso curso={activo} onSalir={() => setCursoAbierto(null)} />
  }

  if (administrando) {
    return (
      <div className="space-y-3 p-1">
        <button
          type="button"
          onClick={() => setAdministrando(false)}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" /> Capacitaciones
        </button>
        <CursosAdmin />
      </div>
    )
  }

  const certificados = cursos.filter((c) => c.certificado)

  // Se agrupan por aseguradora: dentro de "Cotizadores" tiene que verse BMI,
  // Humana y Saludsa como cursos aparte, no todo mezclado en una lista.
  const grupos = cursos.reduce<Record<string, CursoResumen[]>>((acc, c) => {
    const k = c.aseguradora?.trim() || 'General'
    ;(acc[k] ??= []).push(c)
    return acc
  }, {})

  // Ancho completo: en el celular se veia bien, pero en monitor quedaba una
  // columna estrecha en medio de mucho vacio. Es el mismo ajuste que ya hicimos
  // en Tareas.
  return (
    <div className="w-full space-y-6 p-1 xl:p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold md:text-3xl" style={{ color: NAVY }}>
            Capacitaciones
          </h1>
          <p className="text-sm text-muted-foreground">
            Mira los videos, responde las preguntas y obtén tu certificado
          </p>
        </div>
        {puedeAdministrar && (
          <Button variant="outline" onClick={() => setAdministrando(true)}>
            <Settings className="mr-1.5 h-4 w-4" /> Administrar
          </Button>
        )}
      </div>

      {isLoading ? (
        <p className="py-12 text-center text-sm text-muted-foreground">Cargando…</p>
      ) : cursos.length === 0 ? (
        <div className="rounded-xl border border-dashed py-12 text-center">
          <PlayCircle className="mx-auto h-8 w-8 text-muted-foreground/40" />
          <p className="mt-3 text-sm text-muted-foreground">
            Todavía no hay cursos publicados.
          </p>
        </div>
      ) : (
        Object.entries(grupos).map(([grupo, lista]) => (
          <section key={grupo} className="space-y-2">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {grupo}
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {lista.map((c) => {
                const pct = c.totalModulos
                  ? Math.round((c.modulosAprobados / c.totalModulos) * 100)
                  : 0
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setCursoAbierto(c.id)}
                    className="rounded-xl border p-4 text-left transition-shadow hover:shadow-sm"
                    style={{
                      borderLeftWidth: 4,
                      borderLeftColor: c.completado ? VERDE : GOLD,
                    }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-base font-semibold" style={{ color: NAVY }}>
                        {c.titulo}
                      </p>
                      {c.completado && (
                        <Award className="h-4 w-4 shrink-0" style={{ color: GOLD }} />
                      )}
                    </div>
                    {!c.publicado && (
                      <span className="mt-1 inline-block rounded bg-amber-50 px-1.5 py-0.5 text-[10px] text-amber-800">
                        Borrador
                      </span>
                    )}
                    <div className="mt-3 flex items-center gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${pct}%`,
                            backgroundColor: c.completado ? VERDE : GOLD,
                          }}
                        />
                      </div>
                      <span className="shrink-0 text-[11px] text-muted-foreground">
                        {c.modulosAprobados}/{c.totalModulos}
                      </span>
                    </div>
                  </button>
                )
              })}
            </div>
          </section>
        ))
      )}

      {/* Mis certificados, al pie: es la vitrina de lo que ya logro. */}
      {certificados.length > 0 && (
        <section className="space-y-2 border-t pt-5">
          <h2 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <Award className="h-3.5 w-3.5" /> Mis certificados
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {certificados.map((c) => (
              <div
                key={c.id}
                className="rounded-xl border p-3.5"
                style={{
                  borderColor: c.certificado!.vencido ? '#fca5a5' : GOLD,
                  backgroundColor: c.certificado!.vencido ? '#fef2f2' : '#fffbf3',
                }}
              >
                <p className="text-sm font-semibold" style={{ color: NAVY }}>
                  {c.titulo}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {c.certificado!.nota}/100 · código {c.certificado!.codigo}
                </p>
                <p
                  className="mt-1 text-xs"
                  style={{ color: c.certificado!.vencido ? '#b91c1c' : '#64748b' }}
                >
                  {c.certificado!.vencido
                    ? `Venció en ${fecha(c.certificado!.venceEn)} — repite el curso`
                    : `Válido hasta ${fecha(c.certificado!.venceEn)}`}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
