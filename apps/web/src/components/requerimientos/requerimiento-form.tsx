'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSession } from 'next-auth/react'
import { X, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { api } from '@/lib/api'
import { BuscadorCliente, type ClienteSugerido } from '@/components/reclamos/buscador-cliente'

const NAVY = '#0C2057'
const JEFES = ['SUPER_ADMIN', 'OWNER', 'JEFE_OPERACIONES']

const ESTADOS = [
  { valor: 'EN_TRAMITE', label: 'En trámite' },
  { valor: 'MAS_INFORMACION', label: 'Más información' },
  { valor: 'SOLUCIONADO', label: 'Solucionado' },
]

// Tipos de gestión administrativa que puede pedir un cliente.
const TIPOS = [
  { valor: 'BIENVENIDA', label: 'Bienvenida' },
  { valor: 'DATOS_FACTURACION', label: 'Datos de facturación' },
  { valor: 'CAMBIO_FORMA_PAGO', label: 'Cambio de forma de pago' },
  { valor: 'CAMBIO_DEDUCIBLE', label: 'Cambio de deducible' },
  { valor: 'ACTUALIZACION_DATOS', label: 'Actualización de datos' },
  { valor: 'INCLUSION_DEPENDIENTES', label: 'Inclusión de dependientes' },
  { valor: 'EXCLUSION_DEPENDIENTES', label: 'Exclusión de dependientes' },
  { valor: 'CANCELACION', label: 'Cancelación' },
  { valor: 'COTIZACION', label: 'Cotización' },
  { valor: 'PRE_NOTIFICACION', label: 'Pre notificación' },
  { valor: 'OTROS', label: 'Otros' },
]

const ASEGURADORAS = ['BMI', 'HUMANA', 'CONFIAMED', 'SALUDSA', 'BUPA', 'PALIG', 'VUMI', 'SEGUROS ATLANTIDA']

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  )
}

const dia = (v: string | null | undefined) => (v ? String(v).slice(0, 10) : '')
const txt = (v: any) => (v === null || v === undefined ? '' : String(v))

/**
 * Formulario de requerimiento. Sirve para crear (sin `req`) y para editar.
 * Se muestra como panel lateral para no perder de vista la lista.
 */
export function RequerimientoForm({
  req,
  onCerrar,
}: {
  req?: any
  onCerrar: () => void
}) {
  const qc = useQueryClient()
  const { data: session } = useSession()
  const esJefe = JEFES.includes((session?.user as any)?.role ?? '')
  const editando = Boolean(req?.id)

  const [error, setError] = useState<string | null>(null)

  // Un requerimiento solucionado queda cerrado. Solo jefe de operaciones y admin
  // pueden corregirlo; el servidor aplica la misma regla.
  const rolActual = (session?.user as { role?: string } | undefined)?.role ?? ''
  const puedeEditarCerrado = ['SUPER_ADMIN', 'OWNER', 'JEFE_OPERACIONES'].includes(rolActual)
  const estaCerrado =
    editando && txt(req?.estado) === 'SOLUCIONADO' && !puedeEditarCerrado
  const [confirmarBorrar, setConfirmarBorrar] = useState(false)
  // Id del cliente de la base cuando el requerimiento quedó enganchado a una ficha.
  // Va aparte de `form` porque `form` es todo strings y este puede ser null.
  const [clienteId, setClienteId] = useState<string | null>(req?.clienteId ?? null)

  // Titular + dependientes del cliente enlazado, para poder ELEGIR el paciente
  // en vez de escribirlo. Se consulta la ficha apenas se selecciona un titular,
  // porque el buscador solo devuelve nombre y cedula, no los dependientes.
  const { data: fichaCliente } = useQuery({
    queryKey: ['cliente-dependientes', clienteId],
    enabled: !!clienteId,
    queryFn: async () => (await api.get(`/clientes/${clienteId}`)).data,
  })

  const pacientesSugeridos: string[] = (() => {
    const c: any = fichaCliente ?? (req as any)?.cliente
    if (!c) return []
    const nombres = [`${c.nombres ?? ''} ${c.apellidos ?? ''}`.trim()]
    for (const d of c.dependientes ?? []) {
      const n = `${d.nombres ?? ''} ${d.apellidos ?? ''}`.trim()
      if (n) nombres.push(n)
    }
    return nombres.filter(Boolean)
  })()

  const [form, setForm] = useState<Record<string, string>>({
    clienteNombre: txt(req?.clienteNombre),
    pacienteNombre: txt(req?.pacienteNombre),
    aseguradora: txt(req?.aseguradora),
    contrato: txt(req?.contrato) || 'INDIVIDUAL',
    tipo: txt(req?.tipo) || 'DATOS_FACTURACION',
    tipoOtro: txt(req?.tipoOtro),
    requerimiento: txt(req?.requerimiento),
    fechaRecepcion: dia(req?.fechaRecepcion),
    fechaEnvioAseguradora: dia(req?.fechaEnvioAseguradora),
    fechaEnvioCliente: dia(req?.fechaEnvioCliente),
    estado: txt(req?.estado) || 'EN_TRAMITE',
    observaciones: txt(req?.observaciones),
  })

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }))

  const refrescar = () => {
    qc.invalidateQueries({ queryKey: ['requerimientos'] })
    qc.invalidateQueries({ queryKey: ['requerimientos-resumen'] })
  }

  const guardar = useMutation({
    mutationFn: async () => {
      const payload: Record<string, unknown> = {}
      for (const [k, v] of Object.entries(form)) {
        const s = (v ?? '').trim()
        // tipo y estado son enums: nunca deben ir null.
        payload[k] = s === '' ? (k === 'tipo' || k === 'estado' ? undefined : null) : s
      }
      payload.clienteNombre = (form.clienteNombre ?? '').trim()
      // Solo va enganchado si el asesor eligió un cliente de la base.
      payload.clienteId = clienteId

      if (!editando) {
        return (await api.post('/requerimientos', payload)).data
      }

      // Al editar, la observación NO se guarda en el campo: va como nota nueva a
      // la bitácora, para que quede el histórico con autor y fecha.
      const nuevaNota = (form.observaciones ?? '').trim()
      delete payload.observaciones
      const res = (await api.patch(`/requerimientos/${req.id}`, payload)).data
      if (nuevaNota) {
        await api.post(`/requerimientos/${req.id}/notas`, { contenido: nuevaNota })
      }
      return res
    },
    onSuccess: () => {
      refrescar()
      onCerrar()
    },
    onError: (e: any) => setError(e?.response?.data?.message ?? 'No se pudo guardar.'),
  })

  // Envio del correo de bienvenida. Va por su propio endpoint y no con el
  // guardado normal: es una comunicacion al cliente y debe ser una accion
  // explicita, no un efecto de guardar el formulario.
  const enviarBienvenida = useMutation({
    mutationFn: async () =>
      (await api.post(`/requerimientos/${req?.id}/enviar-bienvenida`)).data,
    onSuccess: () => {
      refrescar()
      onCerrar()
    },
    onError: (e: any) =>
      setError(e?.response?.data?.message ?? 'No se pudo enviar el correo.'),
  })

  const borrar = useMutation({
    mutationFn: async () => (await api.delete(`/requerimientos/${req.id}`)).data,
    onSuccess: () => {
      refrescar()
      onCerrar()
    },
    onError: (e: any) => setError(e?.response?.data?.message ?? 'No se pudo eliminar.'),
  })

  // Los días se calculan solos; aquí solo se muestran como referencia.
  const dias = (a: string, b: string) => {
    if (!form[a] || !form[b]) return null
    const d = Math.round(
      (new Date(form[b]).getTime() - new Date(form[a]).getTime()) / 86400000,
    )
    return d >= 0 ? d : null
  }
  const diasCli = dias('fechaRecepcion', 'fechaEnvioCliente')

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={onCerrar}>
      <div
        className="h-full w-full max-w-2xl overflow-y-auto bg-background p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold" style={{ color: NAVY }}>
            {editando ? 'Reclamo' : 'Nuevo requerimiento'}
          </h2>
          <button type="button" onClick={onCerrar} aria-label="Cerrar" className="p-1">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Campo label="Cliente (titular) *">
            <BuscadorCliente
              valor={form.clienteNombre}
              clienteId={clienteId}
              onSeleccionar={(c: ClienteSugerido) => {
                set('clienteNombre', `${c.nombres} ${c.apellidos}`.trim())
                setClienteId(c.id)
              }}
              onTextoLibre={(texto) => {
                set('clienteNombre', texto)
                // Si vuelve a escribir, deja de estar enganchado a la ficha
                setClienteId(null)
              }}
            />
          </Campo>
          <Campo label="Paciente">
            {/* Ofrece el titular y sus dependientes cuando el requerimiento esta enlazado
                a una ficha. Sigue siendo texto libre: los requerimientos historicos vienen
                sin cliente y hay que poder escribir el nombre a mano. */}
            {pacientesSugeridos.length > 0 ? (
              <>
                <select
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={pacientesSugeridos.includes(form.pacienteNombre) ? form.pacienteNombre : '__otro__'}
                  onChange={(e) =>
                    set('pacienteNombre', e.target.value === '__otro__' ? '' : e.target.value)
                  }
                >
                  {pacientesSugeridos.map((n, i) => (
                    <option key={n} value={n}>
                      {n}
                      {i === 0 ? ' (titular)' : ''}
                    </option>
                  ))}
                  <option value="__otro__">Otro (escribir)</option>
                </select>
                {!pacientesSugeridos.includes(form.pacienteNombre) && (
                  <Input
                    className="mt-2"
                    placeholder="Nombre del paciente"
                    value={form.pacienteNombre}
                    onChange={(e) => set('pacienteNombre', e.target.value)}
                  />
                )}
              </>
            ) : (
              <Input
                placeholder="Si es distinto del titular"
                value={form.pacienteNombre}
                onChange={(e) => set('pacienteNombre', e.target.value)}
              />
            )}
          </Campo>

          <Campo label="Aseguradora">
            <Input
              list="aseguradoras-requerimiento"
              value={form.aseguradora}
              onChange={(e) => set('aseguradora', e.target.value)}
            />
            <datalist id="aseguradoras-requerimiento">
              {ASEGURADORAS.map((a) => (
                <option key={a} value={a} />
              ))}
            </datalist>
          </Campo>
          <Campo label="Contrato">
            <select
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={form.contrato === 'INDIVIDUAL' ? 'INDIVIDUAL' : 'CORPORATIVO'}
              onChange={(e) => set('contrato', e.target.value === 'INDIVIDUAL' ? 'INDIVIDUAL' : '')}
            >
              <option value="INDIVIDUAL">Individual</option>
              <option value="CORPORATIVO">Corporativo</option>
            </select>
            {form.contrato !== 'INDIVIDUAL' && (
              <Input
                className="mt-2"
                placeholder="Nombre de la empresa"
                value={form.contrato}
                onChange={(e) => set('contrato', e.target.value)}
              />
            )}
          </Campo>

          <Campo label="Tipo de requerimiento">
            <select
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={form.tipo}
              onChange={(e) => set('tipo', e.target.value)}
            >
              {TIPOS.map((t) => (
                <option key={t.valor} value={t.valor}>
                  {t.label}
                </option>
              ))}
            </select>
            {form.tipo === 'OTROS' && (
              <Input
                className="mt-2"
                placeholder="¿Cuál?"
                value={form.tipoOtro}
                onChange={(e) => set('tipoOtro', e.target.value)}
              />
            )}
          </Campo>

          <div className="md:col-span-2">
            <Campo label="Requerimiento">
              <textarea
                rows={2}
                className="w-full rounded-md border border-input bg-background p-2 text-sm"
                placeholder="Qué pide el cliente"
                value={form.requerimiento}
                onChange={(e) => set('requerimiento', e.target.value)}
              />
            </Campo>
          </div>

          <Campo label="Fecha de recepción">
            <Input
              type="date"
              value={form.fechaRecepcion}
              onChange={(e) => set('fechaRecepcion', e.target.value)}
            />
          </Campo>
          <Campo label="Fecha de envío a la aseguradora">
            <Input
              type="date"
              value={form.fechaEnvioAseguradora}
              onChange={(e) => set('fechaEnvioAseguradora', e.target.value)}
            />
          </Campo>

          <Campo label="Fecha de envío al cliente">
            <Input
              type="date"
              value={form.fechaEnvioCliente}
              onChange={(e) => set('fechaEnvioCliente', e.target.value)}
            />
            {diasCli !== null && (
              <p className="text-[11px] text-muted-foreground">
                {diasCli} días desde la recepción
              </p>
            )}
          </Campo>
          <Campo label="Estado">
            <select
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={form.estado}
              onChange={(e) => set('estado', e.target.value)}
            >
              {ESTADOS.map((x) => (
                <option key={x.valor} value={x.valor}>
                  {x.label}
                </option>
              ))}
            </select>
          </Campo>
          <div className="md:col-span-2">
            <Campo label={editando ? 'Agregar observación' : 'Observaciones'}>
              <textarea
                rows={2}
                className="w-full rounded-md border border-input bg-background p-2 text-sm"
                placeholder={editando ? 'Se agrega a la bitácora al guardar' : ''}
                value={form.observaciones}
                onChange={(e) => set('observaciones', e.target.value)}
              />
              {editando && (
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Las observaciones no se editan ni se borran: cada una queda registrada
                  con su autor y fecha.
                </p>
              )}
            </Campo>
          </div>
        </div>

        {/* Bitácora: notas anteriores, de la más nueva a la más vieja */}
        {editando && ((req as any)?.notas ?? []).length > 0 && (
          <div className="mt-4 space-y-2 border-t pt-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Bitácora
            </p>
            {((req as any).notas as any[]).map((n) => (
              <div key={n.id} className="rounded-md border bg-muted/30 p-2">
                <p className="whitespace-pre-wrap text-sm">{n.contenido}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {n.autorNombre ?? 'Usuario eliminado'} ·{' '}
                  {new Date(n.createdAt).toLocaleString('es-EC', {
                    day: '2-digit', month: '2-digit', year: '2-digit',
                    hour: '2-digit', minute: '2-digit',
                  })}
                </p>
              </div>
            ))}
          </div>
        )}

        {editando && req?.ejecutivoNombre && (
          <p className="mt-3 text-xs text-muted-foreground">
            Gestionado por {req.ejecutivoNombre}
             {!req.ejecutivo && ' (ya no trabaja en Priority)'}
          </p>
        )}

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

        <div className="mt-5 flex items-center justify-between gap-2">
          <div>
            {editando && esJefe && (
              confirmarBorrar ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">¿Eliminar?</span>
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    disabled={borrar.isPending}
                    onClick={() => borrar.mutate()}
                  >
                    Sí, eliminar
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setConfirmarBorrar(false)}
                  >
                    Cancelar
                  </Button>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground hover:text-red-600"
                  onClick={() => setConfirmarBorrar(true)}
                >
                  <Trash2 className="mr-1 h-4 w-4" /> Eliminar
                </Button>
              )
            )}
          </div>
          <div className="flex gap-2">
            {/* Solo en los de bienvenida y una sola vez: si ya se envio, el boton
                queda deshabilitado para que el cliente no reciba el correo dos
                veces. El backend lo comprueba igual, esto es solo la señal visual. */}
            {editando && form.tipo === 'BIENVENIDA' && (
              <Button
                type="button"
                variant="outline"
                disabled={
                  enviarBienvenida.isPending || !!(req as any)?.correoBienvenidaEnviado
                }
                onClick={() => {
                  setError(null)
                  enviarBienvenida.mutate()
                }}
              >
                {(req as any)?.correoBienvenidaEnviado
                  ? 'Bienvenida enviada'
                  : enviarBienvenida.isPending
                    ? 'Enviando…'
                    : 'Enviar bienvenida'}
              </Button>
            )}
            <Button type="button" variant="ghost" onClick={onCerrar}>
              Cancelar
            </Button>
            <Button
              type="button"
              style={{ backgroundColor: NAVY, color: '#fff' }}
              disabled={guardar.isPending || !form.clienteNombre.trim() || estaCerrado}
              onClick={() => {
                setError(null)
                guardar.mutate()
              }}
            >
              {guardar.isPending ? 'Guardando…' : 'Guardar'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
