'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { ArrowLeft, AlertTriangle, Building2, User, Shield, Users, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { api } from '@/lib/api'
import { AgregarPoliza } from './agregar-poliza'
import { EditarCliente } from './editar-cliente'
import { EditarPoliza } from './editar-poliza'
import { NotasCliente } from './notas-cliente'
import { AgregarDependiente } from './agregar-dependiente'
import { CambiarEjecutiva } from './cambiar-ejecutiva'

const NAVY = '#0C2057'
const GOLD = '#DBAA59'

const TIPO_LABEL: Record<string, string> = {
  SALUD: 'Salud',
  AUTO: 'Auto',
  VIDA: 'Vida',
  HOGAR: 'Hogar',
}

interface Dependiente {
  id: string
  nombres: string
  apellidos: string | null
  identificacion: string | null
  fechaNacimiento: string | null
  parentesco: string
}

interface PolizaDependiente {
  dependiente: { id: string; nombres: string; apellidos: string | null }
}

interface Poliza {
  id: string
  tipo: 'SALUD' | 'AUTO' | 'VIDA' | 'HOGAR'
  numeroContrato: string | null
  sumaAsegurada: string | number | null
  marca: string | null
  modelo: string | null
  anio: number | null
  placa: string | null
  tiempoCobertura: string | null
  observacion: string | null
  estado: string | null
  aseguradora: string | null
  plan: string | null
  deducible: string | null
  formaPago: string | null
  fechaEmision: string | null
  primaNeta: string | number | null
  agenteNombre: string | null
  revisar: boolean
  revisarMotivo: string | null
  dependientes: PolizaDependiente[]
}

interface ClienteDetalle {
  id: string
  nombres: string
  apellidos: string
  identificacion: string
  nombrePreferido: string | null
  referidoDe: string | null
  contactoSugerido: string | null
  cedulaEditada: boolean
  genero: string | null
  fechaNacimiento: string | null
  email: string | null
  telefono: string | null
  celular: string | null
  ciudad: string | null
  direccion: string | null
  origenLead: string | null
  vieneDeOtroSeguro: string | null
  empresa: string | null
  tipoCliente: string | null
  agenteNombre: string | null
  notas: string | null
  revisar: boolean
  revisarMotivo: string | null
  ejecutivoNombre: string | null
  ejecutivo: { id: string; name: string; email: string } | null
  dependientes: Dependiente[]
  polizas: Poliza[]
  notas_: {
    id: string
    contenido: string
    autorNombre: string | null
    createdAt: string
  }[]
}

const fmtFecha = (v: string | null) => {
  if (!v) return '—'
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('es-EC', { timeZone: 'UTC' })
}

const fmtMonto = (v: string | number | null) => {
  if (v === null || v === undefined) return '—'
  const n = typeof v === 'string' ? parseFloat(v) : v
  return Number.isNaN(n) ? '—' : `$${n.toLocaleString('es-EC', { minimumFractionDigits: 2 })}`
}

const bonito = (v: string | null) =>
  v ? v.charAt(0) + v.slice(1).toLowerCase().replace(/_/g, ' ') : '—'

// Resalta en dorado como prefiere que le llamen. Ej: "PABLO ALEJANDRO CARRILLO"
// con preferido "PABLO" -> pinta solo esa palabra.
function NombreConPreferido({
  nombres,
  apellidos,
  preferido,
}: {
  nombres: string
  apellidos: string
  preferido: string | null
}) {
  const completo = `${nombres} ${apellidos}`.trim()
  if (!preferido) return <>{completo}</>

  const limpia = (t: string) =>
    t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase()

  const objetivo = limpia(preferido.trim())
  const palabras = completo.split(/\s+/)
  // Si el preferido no aparece dentro del nombre (ej. empresa "SEGUROS IDEAL"
  // con preferido "PRIORITY"), lo mostramos aparte en vez de perderlo.
  const apareceDentro = palabras.some((p) => limpia(p) === objetivo)

  if (!apareceDentro) {
    return (
      <>
        {completo}{' '}
        <span style={{ color: GOLD }}>({preferido})</span>
      </>
    )
  }

  return (
    <>
      {palabras.map((p, i) => (
        <span key={i} style={limpia(p) === objetivo ? { color: GOLD } : undefined}>
          {p}
          {i < palabras.length - 1 ? ' ' : ''}
        </span>
      ))}
    </>
  )
}

function Dato({ label, valor }: { label: string; valor: string | null }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-sm font-medium">{valor || '—'}</div>
    </div>
  )
}

export function ClienteDetalle({ id }: { id: string }) {
  const router = useRouter()

  const qc = useQueryClient()
  const { data: session } = useSession()
  const rol = (session?.user as any)?.role ?? ''
  /** Confirmación escrita antes de borrar. */
  const [confirmarBorrado, setConfirmarBorrado] = useState('')
  const [motivoCancelacion, setMotivoCancelacion] = useState('')
  const [cancelando, setCancelando] = useState(false)

  const cambiarEstado = useMutation({
    mutationFn: (datos: { estado: 'ACTIVO' | 'CANCELADO'; motivo?: string }) =>
      api.patch(`/clientes/${id}/estado`, datos).then((r) => r.data),
    onSuccess: () => {
      setCancelando(false)
      setMotivoCancelacion('')
      qc.invalidateQueries({ queryKey: ['cliente', id] })
      qc.invalidateQueries({ queryKey: ['clientes'] })
    },
  })

  const eliminarCliente = useMutation({
    mutationFn: () => api.delete(`/clientes/${id}`).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clientes'] })
      router.push('/clientes')
    },
  })
  // Borrar una poliza pierde datos: solo jefe de operaciones y admin.
  const puedeEliminar = ['SUPER_ADMIN', 'OWNER', 'JEFE_OPERACIONES'].includes(rol)
  // Reasignar un cliente es decision de Yessenia (o admin), no de la ejecutiva.
  // El permiso de verdad lo aplica el servidor; esto solo esconde el boton.
  const puedeCambiarEjecutiva = ['SUPER_ADMIN', 'OWNER', 'JEFE_OPERACIONES'].includes(rol)
  const [cambiandoEjecutiva, setCambiandoEjecutiva] = useState(false)
  const [borrando, setBorrando] = useState<string | null>(null)

  const { data: c, isLoading, isError, error } = useQuery({
    queryKey: ['cliente', id],
    queryFn: async () => (await api.get(`/clientes/${id}`)).data as ClienteDetalle,
  })

  const eliminar = useMutation({
    mutationFn: async (polizaId: string) =>
      (await api.delete(`/clientes/${id}/polizas/${polizaId}`)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cliente', id] })
      setBorrando(null)
    },
  })

  if (isLoading) {
    return <p className="py-12 text-center text-muted-foreground">Cargando ficha…</p>
  }

  if (isError || !c) {
    const status = (error as any)?.response?.status
    return (
      <div className="py-12 text-center">
        <p className="text-muted-foreground">
          {status === 403
            ? 'Este cliente pertenece a otra ejecutiva.'
            : status === 404
              ? 'No se encontró el cliente.'
              : 'No se pudo cargar la ficha.'}
        </p>
        <Button variant="outline" className="mt-4" onClick={() => router.push('/clientes')}>
          Volver a la lista
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      {/* ── Encabezado ── */}
      <div>
        <Button variant="ghost" size="sm" className="mb-2 -ml-2" onClick={() => router.push('/clientes')}>
          <ArrowLeft className="mr-1 h-4 w-4" /> Clientes
        </Button>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold" style={{ color: NAVY }}>
            <NombreConPreferido
              nombres={c.nombres}
              apellidos={c.apellidos}
              preferido={c.nombrePreferido}
            />
          </h1>
          {/* La empresa va junto al nombre y no solo en la lista de datos: al
              abrir la ficha de un corporativo, saber de que empresa es cambia
              como se atiende la llamada. */}
          {c.empresa && (
            <Badge variant="outline" style={{ borderColor: GOLD, color: NAVY }}>
              <Building2 className="mr-1 h-3 w-3" /> {c.empresa}
            </Badge>
          )}
          {c.revisar && (
            <Badge variant="outline" className="border-amber-500 text-amber-600">
              <AlertTriangle className="mr-1 h-3 w-3" /> Datos por revisar
            </Badge>
          )}
        </div>
        <p className="text-sm text-muted-foreground">Cédula {c.identificacion}</p>
        {c.revisar && c.revisarMotivo && (
          <p className="mt-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            {c.revisarMotivo}
          </p>
        )}
      </div>

      {/* Un cliente cancelado se ve de inmediato: sigue en la base para
          consultar su historial, pero ya no es cliente activo y quien abra la
          ficha tiene que saberlo antes de llamarlo. */}
      {(c as any)?.estado === 'CANCELADO' && (
        <div className="rounded-xl border-2 border-slate-300 bg-slate-50 p-3.5">
          <p className="text-sm font-semibold text-slate-700">Cliente cancelado</p>
          {(c as any)?.motivoCancelacion && (
            <p className="mt-0.5 text-xs text-slate-600">
              {(c as any).motivoCancelacion}
            </p>
          )}
          {(c as any)?.canceladoEn && (
            <p className="mt-0.5 text-[11px] text-slate-500">
              Desde el{' '}
              {new Date((c as any).canceladoEn).toLocaleDateString('es-EC', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </p>
          )}
          <Button
            variant="outline"
            size="sm"
            className="mt-2"
            onClick={() => cambiarEstado.mutate({ estado: 'ACTIVO' })}
            disabled={cambiarEstado.isPending}
          >
            Reactivar cliente
          </Button>
        </div>
      )}

      {/* ── Datos personales ── */}
      <section className="rounded-lg border bg-card p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-sm font-bold" style={{ color: NAVY }}>
            <User className="h-4 w-4" /> Datos personales
          </h2>
          <EditarCliente cliente={c as any} />
        </div>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Dato label="Celular" valor={c.celular} />
          <Dato label="Teléfono" valor={c.telefono} />
          <Dato label="Correo" valor={c.email} />
          <Dato label="Fecha de nacimiento" valor={fmtFecha(c.fechaNacimiento)} />
          <Dato label="Género" valor={bonito(c.genero)} />
          <Dato label="Ciudad" valor={c.ciudad} />
          <Dato label="Dirección" valor={c.direccion} />
          {/* Datos que vienen del CRM comercial al ganarse el deal. Solo se
              muestran si existen: las fichas cargadas a mano no los traen. */}
          <Dato
            label="Origen"
            valor={
              c.origenLead === 'PROPIO'
                ? 'Propio'
                : c.origenLead === 'PRIORITY'
                  ? 'Priority'
                  : c.origenLead === 'PRIORITY_HEALTH'
                    ? 'Priority Health'
                    : null
            }
          />
          {/* Empresa: solo en los corporativos. En un cliente individual seria
              una fila vacia que no aporta nada. */}
          {c.empresa && <Dato label="Empresa" valor={c.empresa} />}
          <Dato label="Viene de otro seguro" valor={c.vieneDeOtroSeguro} />
          <Dato label="Persona de contacto" valor={c.contactoSugerido} />
          <Dato label="Referido de" valor={c.referidoDe} />
          <div>
            <div className="text-xs text-muted-foreground">Ejecutiva</div>
            <div className="flex items-center gap-2">
              <span className="text-sm">
                {c.ejecutivo?.name ?? c.ejecutivoNombre ?? '—'}
              </span>
              {puedeCambiarEjecutiva && (
                <button
                  type="button"
                  onClick={() => setCambiandoEjecutiva(true)}
                  className="text-[11px] font-medium underline underline-offset-2"
                  style={{ color: GOLD }}
                >
                  Cambiar
                </button>
              )}
            </div>
          </div>
        </div>
        {c.notas && (
          <div className="mt-4 border-t pt-3">
            <div className="text-xs text-muted-foreground">Notas</div>
            <p className="text-sm">{c.notas}</p>
          </div>
        )}
      </section>

      {/* ── Dependientes ── */}
      <section className="rounded-lg border bg-card p-4">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-bold" style={{ color: NAVY }}>
          <Users className="h-4 w-4" /> Dependientes ({c.dependientes.length})
        </h2>
        {c.dependientes.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Este cliente no tiene dependientes registrados.
          </p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {c.dependientes.map((d) => (
              <div key={d.id} className="rounded-md border p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium" style={{ color: NAVY }}>
                    {d.nombres} {d.apellidos ?? ''}
                  </span>
                  <Badge variant="secondary">{bonito(d.parentesco)}</Badge>
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {d.identificacion ? `Cédula ${d.identificacion}` : 'Sin cédula'} ·{' '}
                  {fmtFecha(d.fechaNacimiento)}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-3">
          <AgregarDependiente clienteId={c.id} />
        </div>
      </section>

      {/* ── Pólizas ── */}
      <section className="rounded-lg border bg-card p-4">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-bold" style={{ color: NAVY }}>
          <Shield className="h-4 w-4" /> Pólizas ({c.polizas.length})
        </h2>
        {c.polizas.length === 0 ? (
          <p className="text-sm text-muted-foreground">Todavía no hay pólizas registradas.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {c.polizas.map((p) => (
              <div key={p.id} className="rounded-md border p-4">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <Badge style={{ backgroundColor: NAVY, color: '#fff' }}>
                    {TIPO_LABEL[p.tipo] ?? p.tipo}
                  </Badge>
                  <span className="font-bold" style={{ color: NAVY }}>
                    {p.aseguradora ?? 'Sin aseguradora'}
                  </span>
                  {p.plan && <span className="text-sm text-muted-foreground">· {p.plan}</span>}
                  {/* POR_RENOVAR va en ambar: es lo unico de esta lista que pide
                      accion, y en gris se perderia entre los demas estados. */}
                  {p.estado && (
                    <Badge
                      variant="outline"
                      className={
                        p.estado === 'POR_RENOVAR'
                          ? 'border-amber-500 bg-amber-50 text-amber-700'
                          : undefined
                      }
                    >
                      {bonito(p.estado)}
                    </Badge>
                  )}
                  {p.revisar && (
                    <Badge variant="outline" className="border-amber-500 text-amber-600">
                      Revisar
                    </Badge>
                  )}

                  {/* Editar: disponible para todos. Es la salida de la ejecutiva
                      cuando se equivoco, ya que borrar esta reservado al jefe. */}
                  <div className={puedeEliminar ? 'ml-auto' : 'ml-auto flex items-center'}>
                    <EditarPoliza
                      clienteId={c.id}
                      poliza={p as any}
                      dependientes={c.dependientes}
                    />
                  </div>

                  {/* Borrar: solo jefe/admin. Pide confirmacion en el mismo lugar. */}
                  {puedeEliminar && (
                  <div>
                    {borrando === p.id ? (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">¿Eliminar?</span>
                        <Button
                          type="button"
                          size="sm"
                          variant="destructive"
                          disabled={eliminar.isPending}
                          onClick={() => eliminar.mutate(p.id)}
                        >
                          {eliminar.isPending ? 'Eliminando…' : 'Sí, eliminar'}
                        </Button>
                        <Button type="button" size="sm" variant="ghost" onClick={() => setBorrando(null)}>
                          Cancelar
                        </Button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setBorrando(p.id)}
                        className="rounded p-1.5 text-muted-foreground hover:bg-red-50 hover:text-red-600"
                        aria-label="Eliminar póliza"
                        title="Eliminar póliza"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                  )}
                </div>

                {/* Campos comunes a todos los ramos */}
                <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                  <Dato label="Contrato" valor={p.numeroContrato} />
                  <Dato label="Prima anual" valor={fmtMonto(p.primaNeta)} />
                  <Dato label="Forma de pago" valor={bonito(p.formaPago)} />
                  <Dato label="Vigencia" valor={fmtFecha(p.fechaEmision)} />
                  {p.tipo !== 'SALUD' && (
                    <Dato label="Suma asegurada" valor={fmtMonto(p.sumaAsegurada)} />
                  )}
                  {(p.tipo === 'SALUD' || p.tipo === 'AUTO') && (
                    <Dato label="Deducible" valor={p.deducible} />
                  )}
                  {p.tipo === 'VIDA' && (
                    <Dato label="Tiempo de cobertura" valor={p.tiempoCobertura} />
                  )}
                  <Dato label="Agente" valor={p.agenteNombre} />
                </div>

                {/* Datos del vehículo, solo para pólizas de auto */}
                {p.tipo === 'AUTO' && (p.marca || p.placa) && (
                  <div className="mt-3 rounded-md bg-muted/40 p-3">
                    <div className="mb-2 text-xs font-semibold" style={{ color: NAVY }}>
                      Vehículo
                    </div>
                    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                      <Dato label="Marca" valor={p.marca} />
                      <Dato label="Modelo" valor={p.modelo} />
                      <Dato label="Año" valor={p.anio ? String(p.anio) : null} />
                      <Dato label="Placa" valor={p.placa} />
                    </div>
                  </div>
                )}
                <div className="mt-3 border-t pt-2">
                  <div className="text-xs text-muted-foreground">
                    Cubre a{' '}
                    {p.dependientes.length === 0
                      ? 'ningún dependiente (solo el titular)'
                      : p.dependientes
                          .map((pd) => `${pd.dependiente.nombres} ${pd.dependiente.apellidos ?? ''}`.trim())
                          .join(', ')}
                  </div>
                </div>
                {p.observacion && (
                  <p className="mt-2 rounded-md bg-[#f7f8fc] px-3 py-2 text-xs text-[#2a3350]">
                    <span className="font-semibold">Observación:</span> {p.observacion}
                  </p>
                )}
                {p.revisar && p.revisarMotivo && (
                  <p className="mt-2 text-xs text-amber-700">{p.revisarMotivo}</p>
                )}

                {/* Historial de renovaciones de esta póliza.
                    Es la historia de la relación: cuánto subió cada año y qué se
                    le dijo al cliente. Antes había que ir a Renovaciones a
                    buscarlo, siendo justo lo que se consulta al abrir la ficha. */}
                {(p as any).renovaciones?.length > 0 && (
                  <details className="mt-2.5 border-t pt-2">
                    <summary className="cursor-pointer text-[11px] text-muted-foreground">
                      Renovaciones ({(p as any).renovaciones.length})
                    </summary>
                    <div className="mt-1.5 space-y-1.5">
                      {(p as any).renovaciones.map((r: any) => {
                        const actual = r.valorActual ? Number(r.valorActual) : null
                        const nueva = r.valorRenovacion ? Number(r.valorRenovacion) : null
                        const sube =
                          actual && nueva && actual > 0
                            ? Math.round(((nueva - actual) / actual) * 1000) / 10
                            : null
                        return (
                          <div key={r.id} className="rounded-lg bg-muted/40 px-2.5 py-1.5 text-[11px]">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span style={{ color: NAVY }}>
                                {new Date(r.fechaRenovacion).toLocaleDateString('es-EC', {
                                  day: 'numeric',
                                  month: 'short',
                                  year: 'numeric',
                                  timeZone: 'UTC',
                                })}
                              </span>
                              <span className="text-muted-foreground">
                                {actual !== null && nueva !== null && (
                                  <>
                                    ${(actual / 12).toFixed(2)} → ${(nueva / 12).toFixed(2)} /mes
                                  </>
                                )}
                                {sube !== null && (
                                  <strong
                                    className="ml-1.5"
                                    style={{ color: sube > 10 ? '#b45309' : undefined }}
                                  >
                                    {sube > 0 ? '+' : ''}
                                    {sube}%
                                  </strong>
                                )}
                              </span>
                            </div>
                            {r.comentarios && (
                              <p className="mt-0.5 text-muted-foreground">{r.comentarios}</p>
                            )}
                            {r.notas?.map((n: any) => (
                              <p key={n.id} className="mt-0.5 text-muted-foreground">
                                {n.contenido}
                                {n.autorNombre && ` — ${n.autorNombre}`}
                              </p>
                            ))}
                          </div>
                        )
                      })}
                    </div>
                  </details>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Permite sumar una poliza cuando el cliente contrata un ramo nuevo */}
        <div className="mt-4">
          <AgregarPoliza clienteId={c.id} dependientes={c.dependientes} />
        </div>
      </section>

      {/* Cancelar: la salida normal cuando un cliente se va. A diferencia de
          eliminar, no pierde nada —el historial sigue ahí— y se puede deshacer. */}
      {(c as any)?.estado !== 'CANCELADO' && (
        <div className="rounded-xl border p-4">
          <p className="text-sm font-semibold" style={{ color: NAVY }}>
            Cancelar cliente
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Deja de aparecer entre los clientes activos, pero se conserva todo su historial y
            se puede reactivar.
          </p>

          {cancelando ? (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <input
                autoFocus
                value={motivoCancelacion}
                onChange={(e) => setMotivoCancelacion(e.target.value)}
                placeholder="Motivo de la cancelación"
                className="h-9 max-w-[320px] flex-1 rounded-md border bg-background px-2 text-sm"
              />
              <Button
                size="sm"
                disabled={!motivoCancelacion.trim() || cambiarEstado.isPending}
                onClick={() =>
                  cambiarEstado.mutate({ estado: 'CANCELADO', motivo: motivoCancelacion })
                }
                style={{ backgroundColor: NAVY, color: '#fff' }}
              >
                Confirmar
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setCancelando(false)}>
                No
              </Button>
            </div>
          ) : (
            <Button variant="outline" size="sm" className="mt-3" onClick={() => setCancelando(true)}>
              Marcar como cancelado
            </Button>
          )}
        </div>
      )}

      {/* Eliminar: solo SUPER_ADMIN. Es irreversible y se lleva las polizas,
          dependientes y renovaciones del cliente. Va al final de la ficha, no
          arriba: no es una accion que se busque a menudo. */}
      {rol === 'SUPER_ADMIN' && (
        <div className="rounded-xl border-2 border-red-200 bg-red-50/40 p-4">
          <p className="text-sm font-semibold text-red-800">Eliminar cliente</p>
          <p className="mt-1 text-xs text-red-900/80">
            Borra la ficha con sus <strong>pólizas, dependientes y renovaciones</strong>. Los
            requerimientos y reembolsos se conservan como registro. Es irreversible.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <input
              value={confirmarBorrado}
              onChange={(e) => setConfirmarBorrado(e.target.value)}
              placeholder="Escribe ELIMINAR para confirmar"
              className="h-9 max-w-[280px] rounded-md border bg-white px-2 text-sm"
            />
            <Button
              variant="outline"
              className="border-red-300 text-red-700 hover:bg-red-100"
              disabled={confirmarBorrado !== 'ELIMINAR' || eliminarCliente.isPending}
              onClick={() => eliminarCliente.mutate()}
            >
              <Trash2 className="mr-1.5 h-4 w-4" />
              {eliminarCliente.isPending ? 'Eliminando…' : 'Eliminar cliente'}
            </Button>
          </div>
          {eliminarCliente.isError && (
            <p className="mt-2 text-xs text-red-700">
              {(eliminarCliente.error as any)?.response?.data?.message ?? 'No se pudo eliminar'}
            </p>
          )}
        </div>
      )}

      {/* ── Bitácora ── */}
      <NotasCliente clienteId={c.id} notas={c.notas_ ?? []} />

      {cambiandoEjecutiva && (
        <CambiarEjecutiva
          clienteId={c.id}
          ejecutivaActual={c.ejecutivo?.name ?? c.ejecutivoNombre ?? null}
          ejecutivaActualId={c.ejecutivo?.id ?? null}
          onCerrar={() => setCambiandoEjecutiva(false)}
        />
      )}
    </div>
  )
}
