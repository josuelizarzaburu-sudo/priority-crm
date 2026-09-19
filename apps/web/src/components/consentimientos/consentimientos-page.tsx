'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Check, FileText, Mail, ShieldCheck } from 'lucide-react'

const NAVY = '#0C2057'
const VERDE = '#15803d'
const AMBAR = '#b45309'
const ROJO = '#b91c1c'

interface Fila {
  id: string
  nombre: string
  email: string | null
  celular: string | null
  estado: 'OTORGADO' | 'PENDIENTE' | 'NO_SOLICITADO' | 'REVOCADO' | 'SIN_CORREO'
  otorgadoEn: string | null
  vecesEnviado: number
  ultimoEnvio: string | null
  version: string | null
}

interface Tablero {
  total: number
  otorgados: number
  pendientes: number
  noSolicitados: number
  revocados: number
  sinCorreo: number
  filas: Fila[]
}

const ESTADO: Record<Fila['estado'], { label: string; color: string; fondo: string }> = {
  OTORGADO: { label: 'Autorizó', color: VERDE, fondo: '#f0fdf4' },
  PENDIENTE: { label: 'Sin responder', color: AMBAR, fondo: '#fffbeb' },
  NO_SOLICITADO: { label: 'Sin pedir', color: '#6b7280', fondo: '#f4f5f7' },
  REVOCADO: { label: 'Retiró', color: ROJO, fondo: '#fef2f2' },
  SIN_CORREO: { label: 'Sin correo', color: '#6b7280', fondo: '#f4f5f7' },
}

/**
 * Tablero de consentimientos (LOPDP).
 *
 * Responde dos preguntas: a quién le falta autorizar —para la campaña— y qué
 * evidencia hay de cada uno, si la autoridad la pide.
 */
export function ConsentimientosPage() {
  const qc = useQueryClient()
  const [filtro, setFiltro] = useState('')
  const [evidencia, setEvidencia] = useState<any[] | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)

  const { data } = useQuery<Tablero>({
    queryKey: ['consentimientos', filtro],
    queryFn: () =>
      api
        .get('/consentimientos/tablero', { params: filtro ? { estado: filtro } : {} })
        .then((r) => r.data),
  })

  const refrescar = () => qc.invalidateQueries({ queryKey: ['consentimientos'] })

  const solicitar = useMutation({
    mutationFn: (clienteId: string) =>
      api.post(`/consentimientos/cliente/${clienteId}/solicitar`),
    onSuccess: () => {
      setAviso('Enlace enviado.')
      setTimeout(() => setAviso(null), 4000)
      refrescar()
    },
    onError: (e: any) => setAviso(e?.response?.data?.message ?? 'No se pudo enviar'),
  })

  const masivo = useMutation({
    mutationFn: () => api.post('/consentimientos/solicitar-masivo', { limite: 50 }).then((r) => r.data),
    onSuccess: (d: any) => {
      setAviso(`Se enviaron ${d.enviados} de ${d.revisados} correos.`)
      setTimeout(() => setAviso(null), 6000)
      refrescar()
    },
  })

  const verEvidencia = useMutation({
    mutationFn: (clienteId: string) =>
      api.get(`/consentimientos/cliente/${clienteId}/evidencia`).then((r) => r.data),
    onSuccess: (d) => setEvidencia(d),
  })

  if (!data) return null

  const cumplimiento = data.total > 0 ? Math.round((data.otorgados / data.total) * 100) : 0

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-1">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold md:text-3xl" style={{ color: NAVY }}>
            Protección de datos
          </h1>
          <p className="text-sm text-muted-foreground">
            Autorización de tratamiento de datos personales (LOPDP)
          </p>
        </div>
        <Button
          onClick={() => masivo.mutate()}
          disabled={masivo.isPending}
          style={{ backgroundColor: NAVY, color: '#fff' }}
        >
          <Mail className="mr-1.5 h-4 w-4" />
          {masivo.isPending ? 'Enviando…' : 'Enviar a los que faltan'}
        </Button>
      </div>

      {aviso && (
        <p className="rounded-lg border px-3 py-2 text-xs" style={{ borderColor: '#bbf7d0', backgroundColor: '#f0fdf4', color: VERDE }}>
          {aviso}
        </p>
      )}

      {/* El porcentaje primero: es lo que se responde si preguntan cómo van. */}
      <div className="rounded-xl border p-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs text-muted-foreground">Clientes que ya autorizaron</p>
            <p className="text-3xl font-bold" style={{ color: cumplimiento >= 80 ? VERDE : AMBAR }}>
              {cumplimiento}%
            </p>
          </div>
          <p className="text-sm text-muted-foreground">
            {data.otorgados} de {data.total}
          </p>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${cumplimiento}%`, backgroundColor: cumplimiento >= 80 ? VERDE : AMBAR }}
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {(
          [
            ['', `Todos (${data.total})`],
            ['OTORGADO', `Autorizaron (${data.otorgados})`],
            ['PENDIENTE', `Sin responder (${data.pendientes})`],
            ['NO_SOLICITADO', `Sin pedir (${data.noSolicitados})`],
            ['REVOCADO', `Retiraron (${data.revocados})`],
            ['SIN_CORREO', `Sin correo (${data.sinCorreo})`],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setFiltro(id)}
            className="rounded-full border px-3 py-1 text-xs font-medium"
            style={filtro === id ? { backgroundColor: NAVY, color: '#fff', borderColor: NAVY } : undefined}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border">
        {data.filas.map((f, i) => {
          const e = ESTADO[f.estado]
          return (
            <div
              key={f.id}
              className="flex flex-wrap items-center justify-between gap-3 px-3.5 py-2.5"
              style={{ borderTop: i > 0 ? '1px solid #f1f2f4' : undefined }}
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium" style={{ color: NAVY }}>
                  {f.nombre}
                </p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {f.email ?? 'sin correo'}
                  {f.otorgadoEn &&
                    ` · autorizó el ${new Date(f.otorgadoEn).toLocaleDateString('es-EC', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}`}
                  {/* Cuántas veces se le escribió: a los tres envíos sin
                      respuesta, conviene llamar en vez de insistir por correo. */}
                  {f.estado === 'PENDIENTE' &&
                    f.vecesEnviado > 0 &&
                    ` · ${f.vecesEnviado} ${f.vecesEnviado === 1 ? 'envío' : 'envíos'}`}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <span
                  className="rounded-full px-2.5 py-1 text-[11px] font-semibold"
                  style={{ backgroundColor: e.fondo, color: e.color }}
                >
                  {e.label}
                </span>

                {f.estado === 'OTORGADO' ? (
                  <button
                    type="button"
                    onClick={() => verEvidencia.mutate(f.id)}
                    className="text-[11px] hover:underline"
                    style={{ color: NAVY }}
                  >
                    Ver constancia
                  </button>
                ) : f.estado !== 'SIN_CORREO' && f.estado !== 'REVOCADO' ? (
                  <button
                    type="button"
                    onClick={() => solicitar.mutate(f.id)}
                    disabled={solicitar.isPending}
                    className="text-[11px] hover:underline disabled:opacity-40"
                    style={{ color: NAVY }}
                  >
                    {f.vecesEnviado > 0 ? 'Reenviar' : 'Enviar'}
                  </button>
                ) : null}
              </div>
            </div>
          )
        })}

        {data.filas.length === 0 && (
          <p className="py-12 text-center text-sm text-muted-foreground">
            No hay clientes en este estado.
          </p>
        )}
      </div>

      {/* La constancia, como se le muestra a la autoridad. */}
      {evidencia && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setEvidencia(null)}
        >
          <div
            className="max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-5"
            onClick={(ev) => ev.stopPropagation()}
          >
            <p className="flex items-center gap-1.5 text-sm font-semibold" style={{ color: NAVY }}>
              <FileText className="h-4 w-4" /> Constancia de autorización
            </p>

            {evidencia.map((ev: any, i: number) => (
              <div key={i} className="mt-4 space-y-1.5 rounded-lg bg-muted/40 p-3.5 text-xs">
                {[
                  ['Titular', ev.titular],
                  ['Identificación', ev.identificacion ?? '—'],
                  ['Estado', ev.estado],
                  ['Correo al que se envió', ev.correoAlQueSeEnvio],
                  [
                    'Fecha y hora',
                    ev.otorgadoEn
                      ? new Date(ev.otorgadoEn).toLocaleString('es-EC', {
                          dateStyle: 'full',
                          timeStyle: 'medium',
                        })
                      : '—',
                  ],
                  ['Desde la IP', ev.desdeIp ?? '—'],
                  ['Versión del texto', ev.versionDelTexto],
                ].map(([k, v]) => (
                  <div key={k as string} className="flex justify-between gap-3">
                    <span className="text-muted-foreground">{k}</span>
                    <span className="text-right font-medium" style={{ color: NAVY }}>
                      {v as string}
                    </span>
                  </div>
                ))}

                {/* La huella prueba que el texto no cambió desde que lo aceptó.
                    Si no coincide, hay que decirlo: fingir que todo está bien
                    sería peor que el problema. */}
                <div
                  className="mt-2 flex items-start gap-1.5 border-t pt-2 text-[11px]"
                  style={{ color: ev.coincide ? VERDE : ROJO }}
                >
                  {ev.coincide ? (
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  ) : (
                    <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  )}
                  {ev.coincide
                    ? 'El texto vigente es idéntico al que aceptó el titular.'
                    : 'El texto cambió desde que el titular aceptó. Hay que volver a pedirle autorización.'}
                </div>
              </div>
            ))}

            <Button className="mt-4 w-full" variant="outline" onClick={() => setEvidencia(null)}>
              Cerrar
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
