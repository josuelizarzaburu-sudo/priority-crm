'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { EditorPreguntas } from './editor-preguntas'
import { AlertTriangle, ChevronDown, ChevronRight, HelpCircle, Plus, Trash2, X } from 'lucide-react'

const NAVY = '#0C2057'
const GOLD = '#DBAA59'

interface Modulo {
  id: string
  titulo: string
  duracionMin: number | null
  orden: number
  preguntas: number
}

interface Curso {
  id: string
  titulo: string
  descripcion: string | null
  aseguradora: string | null
  publicado: boolean
  totalModulos: number
  modulos: Modulo[]
}

export function CursosAdmin() {
  const qc = useQueryClient()
  const [abierto, setAbierto] = useState<string | null>(null)
  const [creandoCurso, setCreandoCurso] = useState(false)
  const [editandoPreguntas, setEditandoPreguntas] = useState<Modulo | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [nuevoCurso, setNuevoCurso] = useState({ titulo: '', aseguradora: '', descripcion: '' })
  const [nuevoModulo, setNuevoModulo] = useState({ titulo: '', youtubeUrl: '', duracionMin: '' })

  const { data: cursos = [], isLoading } = useQuery<Curso[]>({
    queryKey: ['cursos-admin'],
    queryFn: () => api.get('/cursos').then((r) => r.data),
  })

  const refrescar = () => {
    qc.invalidateQueries({ queryKey: ['cursos-admin'] })
    qc.invalidateQueries({ queryKey: ['cursos'] })
  }
  const fallo = (e: any) => {
    const m = e?.response?.data?.message
    setError(Array.isArray(m) ? m.join(', ') : (m ?? 'No se pudo completar la acción'))
  }

  const crearCurso = useMutation({
    mutationFn: () => api.post('/cursos', nuevoCurso),
    onSuccess: () => {
      setNuevoCurso({ titulo: '', aseguradora: '', descripcion: '' })
      setCreandoCurso(false)
      setError(null)
      refrescar()
    },
    onError: fallo,
  })

  const publicar = useMutation({
    mutationFn: ({ id, publicado }: { id: string; publicado: boolean }) =>
      api.patch(`/cursos/${id}`, { publicado }),
    onSuccess: () => {
      setError(null)
      refrescar()
    },
    onError: fallo,
  })

  const borrarCurso = useMutation({
    mutationFn: (id: string) => api.delete(`/cursos/${id}`),
    onSuccess: () => {
      setError(null)
      refrescar()
    },
    onError: fallo,
  })

  const crearModulo = useMutation({
    mutationFn: (cursoId: string) =>
      api.post(`/cursos/${cursoId}/modulos`, {
        titulo: nuevoModulo.titulo,
        youtubeUrl: nuevoModulo.youtubeUrl,
        duracionMin: nuevoModulo.duracionMin ? Number(nuevoModulo.duracionMin) : undefined,
      }),
    onSuccess: () => {
      setNuevoModulo({ titulo: '', youtubeUrl: '', duracionMin: '' })
      setError(null)
      refrescar()
    },
    onError: fallo,
  })

  const borrarModulo = useMutation({
    mutationFn: (id: string) => api.delete(`/cursos/modulos/${id}`),
    onSuccess: () => {
      setError(null)
      refrescar()
    },
    onError: fallo,
  })

  if (editandoPreguntas) {
    return (
      <div className="mx-auto max-w-2xl">
        <EditorPreguntas
          moduloId={editandoPreguntas.id}
          tituloModulo={editandoPreguntas.titulo}
          onCerrar={() => {
            setEditandoPreguntas(null)
            refrescar()
          }}
        />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold" style={{ color: NAVY }}>
            Administrar cursos
          </h2>
          <p className="text-xs text-muted-foreground">
            Un curso por tema. Dentro van los módulos, cada uno con su video y sus preguntas.
          </p>
        </div>
        <Button
          onClick={() => setCreandoCurso((v) => !v)}
          style={{ backgroundColor: NAVY, color: '#fff' }}
        >
          <Plus className="mr-1 h-4 w-4" /> Nuevo curso
        </Button>
      </div>

      {error && (
        <div className="flex items-start justify-between gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          <span className="flex items-start gap-1.5">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            {error}
          </span>
          <button type="button" onClick={() => setError(null)} aria-label="Cerrar">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {creandoCurso && (
        <div className="space-y-2.5 rounded-xl border p-4">
          <Input
            autoFocus
            placeholder="Nombre del curso — ej. Cotizador BMI"
            value={nuevoCurso.titulo}
            onChange={(e) => setNuevoCurso((c) => ({ ...c, titulo: e.target.value }))}
          />
          <Input
            placeholder="Categoría — ej. Cotizadores, Aseguradoras, CRM"
            value={nuevoCurso.aseguradora}
            onChange={(e) => setNuevoCurso((c) => ({ ...c, aseguradora: e.target.value }))}
          />
          <Textarea
            rows={2}
            placeholder="Descripción (opcional)"
            value={nuevoCurso.descripcion}
            onChange={(e) => setNuevoCurso((c) => ({ ...c, descripcion: e.target.value }))}
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setCreandoCurso(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => crearCurso.mutate()}
              disabled={!nuevoCurso.titulo.trim() || crearCurso.isPending}
              style={{ backgroundColor: NAVY, color: '#fff' }}
            >
              Crear curso
            </Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <p className="py-10 text-center text-sm text-muted-foreground">Cargando…</p>
      ) : cursos.length === 0 ? (
        <div className="rounded-xl border border-dashed py-10 text-center">
          <p className="text-sm text-muted-foreground">
            Todavía no hay cursos. Crea el primero para empezar.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {cursos.map((c) => {
            const expandido = abierto === c.id
            const sinPreguntas = c.modulos.filter((m) => m.preguntas === 0)

            return (
              <div key={c.id} className="rounded-xl border">
                <button
                  type="button"
                  onClick={() => setAbierto(expandido ? null : c.id)}
                  className="flex w-full items-center gap-2.5 p-3.5 text-left"
                >
                  {expandido ? (
                    <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold" style={{ color: NAVY }}>
                      {c.titulo}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {c.aseguradora ? `${c.aseguradora} · ` : ''}
                      {c.totalModulos} módulo{c.totalModulos === 1 ? '' : 's'}
                    </p>
                  </div>
                  <span
                    className="shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-medium"
                    style={
                      c.publicado
                        ? { backgroundColor: '#dcfce7', color: '#15803d' }
                        : { backgroundColor: '#fef3c7', color: '#b45309' }
                    }
                  >
                    {c.publicado ? 'Publicado' : 'Borrador'}
                  </span>
                </button>

                {expandido && (
                  <div className="space-y-3 border-t p-3.5">
                    {c.modulos.length === 0 ? (
                      <p className="text-xs text-muted-foreground">
                        Sin módulos todavía. Agrega el primero abajo.
                      </p>
                    ) : (
                      <div className="space-y-1.5">
                        {c.modulos.map((m, i) => (
                          <div
                            key={m.id}
                            className="flex items-center gap-2.5 rounded-lg border px-3 py-2"
                          >
                            <span className="text-xs text-muted-foreground">{i + 1}</span>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm" style={{ color: NAVY }}>
                                {m.titulo}
                              </p>
                              <p
                                className="text-[11px]"
                                style={{ color: m.preguntas === 0 ? '#b45309' : '#64748b' }}
                              >
                                {m.duracionMin ? `${m.duracionMin} min · ` : ''}
                                {m.preguntas === 0
                                  ? 'Sin preguntas — agrégalas'
                                  : `${m.preguntas} pregunta${m.preguntas === 1 ? '' : 's'}`}
                              </p>
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setEditandoPreguntas(m)}
                            >
                              <HelpCircle className="mr-1 h-3.5 w-3.5" />
                              Preguntas
                            </Button>
                            <button
                              type="button"
                              onClick={() => {
                                if (confirm(`¿Eliminar el módulo "${m.titulo}"?`)) {
                                  borrarModulo.mutate(m.id)
                                }
                              }}
                              className="shrink-0 text-muted-foreground hover:text-red-600"
                              aria-label="Eliminar módulo"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Alta de módulo. El enlace se acepta como se copie de
                        YouTube; el servidor lo normaliza. */}
                    <div className="space-y-2 rounded-lg bg-muted/40 p-3">
                      <p className="text-xs font-semibold" style={{ color: GOLD }}>
                        Agregar módulo
                      </p>
                      <Input
                        placeholder="Título — ej. Regiones y tarifas"
                        value={nuevoModulo.titulo}
                        onChange={(e) =>
                          setNuevoModulo((m) => ({ ...m, titulo: e.target.value }))
                        }
                        className="h-9 text-sm"
                      />
                      <Input
                        placeholder="Enlace de YouTube (no listado)"
                        value={nuevoModulo.youtubeUrl}
                        onChange={(e) =>
                          setNuevoModulo((m) => ({ ...m, youtubeUrl: e.target.value }))
                        }
                        className="h-9 text-sm"
                      />
                      <div className="flex gap-2">
                        <Input
                          type="number"
                          placeholder="Minutos"
                          value={nuevoModulo.duracionMin}
                          onChange={(e) =>
                            setNuevoModulo((m) => ({ ...m, duracionMin: e.target.value }))
                          }
                          className="h-9 max-w-[110px] text-sm"
                        />
                        <Button
                          size="sm"
                          className="ml-auto"
                          onClick={() => crearModulo.mutate(c.id)}
                          disabled={
                            !nuevoModulo.titulo.trim() ||
                            !nuevoModulo.youtubeUrl.trim() ||
                            crearModulo.isPending
                          }
                          style={{ backgroundColor: NAVY, color: '#fff' }}
                        >
                          Agregar
                        </Button>
                      </div>
                    </div>

                    {/* Aviso antes de publicar: el servidor lo rechaza igual,
                        pero es mejor saberlo antes de intentarlo. */}
                    {!c.publicado && sinPreguntas.length > 0 && (
                      <p className="text-[11px] text-amber-700">
                        Para publicar, todos los módulos necesitan preguntas. Faltan en:{' '}
                        {sinPreguntas.map((m) => m.titulo).join(', ')}.
                      </p>
                    )}

                    <div className="flex justify-between gap-2 border-t pt-3">
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm(`¿Eliminar el curso "${c.titulo}"?`)) {
                            borrarCurso.mutate(c.id)
                          }
                        }}
                        className="text-xs text-muted-foreground hover:text-red-600"
                      >
                        Eliminar curso
                      </button>
                      <Button
                        size="sm"
                        variant={c.publicado ? 'outline' : 'default'}
                        onClick={() =>
                          publicar.mutate({ id: c.id, publicado: !c.publicado })
                        }
                        disabled={publicar.isPending}
                        style={
                          c.publicado ? undefined : { backgroundColor: '#15803d', color: '#fff' }
                        }
                      >
                        {c.publicado ? 'Despublicar' : 'Publicar curso'}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
