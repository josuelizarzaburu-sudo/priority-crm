'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { ArrowLeft, AlertTriangle, User, Shield, Users, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { api } from '@/lib/api'
import { AgregarPoliza } from './agregar-poliza'
import { EditarCliente } from './editar-cliente'
import { EditarPoliza } from './editar-poliza'
import { NotasCliente } from './notas-cliente'
import { AgregarDependiente } from './agregar-dependiente'

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
  // Borrar una poliza pierde datos: solo jefe de operaciones y admin.
  const puedeEliminar = ['SUPER_ADMIN', 'OWNER', 'JEFE_OPERACIONES'].includes(rol)
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
          <Dato label="Contacto sugerido" valor={c.contactoSugerido} />
          <Dato label="Referido de" valor={c.referidoDe} />
          <Dato label="Ejecutiva" valor={c.ejecutivo?.name ?? c.ejecutivoNombre} />
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
                  {p.estado && <Badge variant="outline">{bonito(p.estado)}</Badge>}
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
                  <Dato label="Prima neta" valor={fmtMonto(p.primaNeta)} />
                  <Dato label="Forma de pago" valor={bonito(p.formaPago)} />
                  <Dato label="Emisión" valor={fmtFecha(p.fechaEmision)} />
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
              </div>
            ))}
          </div>
        )}

        {/* Permite sumar una poliza cuando el cliente contrata un ramo nuevo */}
        <div className="mt-4">
          <AgregarPoliza clienteId={c.id} dependientes={c.dependientes} />
        </div>
      </section>

      {/* ── Bitácora ── */}
      <NotasCliente clienteId={c.id} notas={c.notas_ ?? []} />
    </div>
  )
}
