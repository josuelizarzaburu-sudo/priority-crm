'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  cotizarBmiTodos,
  BMI_PLAN_LABEL,
  BMI_REGIONES,
  type BmiRegion,
  type BmiPlanId,
} from '@/lib/bmi-tarifas'
import { cotizarHumana, type Sexo } from '@/lib/humana-tarifas'
import {
  cotizarConfiamed,
  CONFIAMED_DEDUCIBLE_LABEL,
  type ConfiamedRed,
} from '@/lib/confiamed-tarifas'
import { CATALOGS } from '@/lib/comparativos-data'

const NAVY = '#0C2057'
const GOLD = '#DBAA59'

interface Miembro {
  id: string
  parentesco: string
  edad: string
  sexo: Sexo
  maternidad: boolean
}

let nextId = 1
const nuevoMiembro = (parentesco: string, sexo: Sexo = 'M'): Miembro => ({
  id: `m${nextId++}`,
  parentesco,
  edad: '',
  sexo,
  maternidad: false,
})

const money = (n: number) =>
  n.toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

// Botón "+ Comparar / ✓ Añadido" reutilizable (usado en las cards mobile de resultados).
function CompararBtn({
  sel,
  onClick,
  className = '',
}: {
  sel: boolean
  onClick: () => void
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border font-medium transition-colors ${className}`}
      style={{
        borderColor: GOLD,
        backgroundColor: sel ? GOLD : '#fff',
        color: sel ? '#fff' : NAVY,
      }}
    >
      {sel ? '✓ Añadido' : '+ Comparar'}
    </button>
  )
}

// Fila etiqueta → valor para las cards mobile de resultados.
function CardStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm text-[#333]">{value}</span>
    </div>
  )
}

const PLAN_ORDER: BmiPlanId[] = ['sigma', 'innova', 'gmm']

// Una opción marcada para pasar al comparativo.
interface SeleccionComparativo {
  id: string // clave única (ej "bmi-sigma-D500")
  catalogId: string // id del plan en el catálogo del comparativo (ej "ab0")
  aseguradora: string // "BMI", "Humana", "Confiamed", "Salud"...
  plan: string // "Sigma", "MH 50", "CONFIPLUS Red 1"...
  detalle: string // deducible o red específica (ej "Deducible 500")
  mensual: number // prima mensual
  deducible?: string // para BMI: el deducible elegido (ej "D500", "5000")
  red?: 'red1' | 'red2' // para Confiamed: la red elegida
}

// Mapeo de plan del cotizador -> id del plan en el catálogo del comparativo
const BMI_CATALOG_ID: Record<BmiPlanId, string> = {
  sigma: 'ab0',
  innova: 'ab1',
  gmm: 'ab2',
}
// Humana: plan del motor -> id catálogo
const HUMANA_CATALOG_ID: Record<string, string> = {
  MH50: 'ab3',
  MH80: 'ab4',
  // PH30 y MH150 no tienen columna en el catálogo salud abierto; se omiten del match directo
}
// Confiamed: deducible -> id catálogo
const CONFIAMED_CATALOG_ID: Record<string, string> = {
  '30000': 'ab5',
  '60000': 'ab6',
  '110000': 'ab7',
  '10000': 'ce2',
}

// Aseguradoras que tienen cotizador automático. El resto se cotiza manualmente.
const ASEGURADORAS_AUTO = new Set(['BMI', 'Humana', 'Confiamed'])

// Planes del catálogo salud SIN cotizador (Saludsa, Bupa, etc.) para la sección manual.
const PLANES_MANUALES = CATALOGS.salud.plans.filter((p) => !ASEGURADORAS_AUTO.has(p.insurer))

// Guardamos el trabajo en curso del cotizador (integrantes + seleccionados) para que el
// vendedor pueda ir y volver del comparativo sin perder los datos ya ingresados del cliente.
// sessionStorage: se limpia solo al cerrar la pestaña, así no se mezcla con el siguiente cliente
// si el vendedor cierra y abre una pestaña nueva.
const COTIZADOR_STORAGE_KEY = 'priority-cotizador-en-curso-v1'

type CotizadorGuardado = {
  region: BmiRegion
  confiamedRed: ConfiamedRed
  miembros: Miembro[]
  seleccionados: SeleccionComparativo[]
}

export function CotizadorPage() {
  const router = useRouter()
  const [region, setRegion] = useState<BmiRegion>('Sierra')
  const [confiamedRed, setConfiamedRed] = useState<ConfiamedRed>('red1')
  const [miembros, setMiembros] = useState<Miembro[]>([nuevoMiembro('Titular')])
  // Opciones marcadas que irán al comparativo
  const [seleccionados, setSeleccionados] = useState<SeleccionComparativo[]>([])
  // Sección manual: plan elegido y precio digitado
  const [manualPlanId, setManualPlanId] = useState('')
  const [manualPrecio, setManualPrecio] = useState('')
  // Evita que el efecto de "guardar" pise el sessionStorage con los valores por defecto
  // antes de que el efecto de "restaurar" alcance a correr.
  const [hidratado, setHidratado] = useState(false)

  // Restaurar cotización en curso (si el vendedor viene de vuelta desde /comparativos, o recargó la página)
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(COTIZADOR_STORAGE_KEY)
      if (raw) {
        const data: CotizadorGuardado = JSON.parse(raw)
        if (data.region) setRegion(data.region)
        if (data.confiamedRed) setConfiamedRed(data.confiamedRed)
        if (data.miembros?.length) setMiembros(data.miembros)
        if (data.seleccionados?.length) setSeleccionados(data.seleccionados)
      }
    } catch {
      // sessionStorage no disponible o dato corrupto: seguimos con el formulario en blanco
    }
    setHidratado(true)
  }, [])

  // Guardar automáticamente en cada cambio
  useEffect(() => {
    if (!hidratado) return
    const data: CotizadorGuardado = { region, confiamedRed, miembros, seleccionados }
    try {
      sessionStorage.setItem(COTIZADOR_STORAGE_KEY, JSON.stringify(data))
    } catch {
      // si falla el guardado (modo privado, cuota llena, etc.) no interrumpimos el flujo
    }
  }, [hidratado, region, confiamedRed, miembros, seleccionados])

  // Botón "Nueva cotización": limpia todo para empezar con otro cliente sin arrastrar datos
  const nuevaCotizacion = () => {
    if (!confirm('¿Empezar una cotización nueva? Se perderán los datos e integrantes actuales.')) return
    sessionStorage.removeItem(COTIZADOR_STORAGE_KEY)
    setRegion('Sierra')
    setConfiamedRed('red1')
    setMiembros([nuevoMiembro('Titular')])
    setSeleccionados([])
    setManualPlanId('')
    setManualPrecio('')
  }

  const toggleSeleccion = (opcion: SeleccionComparativo) =>
    setSeleccionados((prev) =>
      prev.some((s) => s.id === opcion.id)
        ? prev.filter((s) => s.id !== opcion.id)
        : [...prev, opcion],
    )
  const estaSeleccionado = (id: string) => seleccionados.some((s) => s.id === id)
  const quitarSeleccion = (id: string) =>
    setSeleccionados((prev) => prev.filter((s) => s.id !== id))

  // Agregar un plan manual (Saludsa, Bupa...) a los seleccionados
  const agregarManual = () => {
    const plan = PLANES_MANUALES.find((p) => p.id === manualPlanId)
    const precio = parseFloat(manualPrecio.replace(',', '.'))
    if (!plan || !Number.isFinite(precio) || precio <= 0) return
    const selId = `manual-${plan.id}`
    setSeleccionados((prev) => [
      ...prev.filter((s) => s.id !== selId),
      {
        id: selId,
        catalogId: plan.id,
        aseguradora: plan.insurer,
        plan: plan.name,
        detalle: 'Manual',
        mensual: precio,
      },
    ])
    setManualPlanId('')
    setManualPrecio('')
  }

  const addMiembro = (parentesco: string) =>
    setMiembros((prev) => [...prev, nuevoMiembro(parentesco)])
  const updateMiembro = (id: string, patch: Partial<Miembro>) =>
    setMiembros((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)))
  const removeMiembro = (id: string) =>
    setMiembros((prev) => prev.filter((m) => m.id !== id))

  // Personas con edad válida (para BMI: solo edad; para Humana: edad + sexo)
  const personas = useMemo(
    () =>
      miembros
        .map((m) => ({ edad: parseInt(m.edad, 10), sexo: m.sexo, maternidad: m.maternidad }))
        .filter((p) => Number.isFinite(p.edad) && p.edad >= 0 && p.edad <= 105),
    [miembros],
  )

  const bmi = useMemo(() => {
    if (personas.length === 0) return null
    return cotizarBmiTodos(region, personas.map((p) => ({ edad: p.edad })))
  }, [region, personas])

  const humana = useMemo(() => {
    if (personas.length === 0) return null
    return cotizarHumana(personas.map((p) => ({ edad: p.edad, sexo: p.sexo })))
  }, [personas])

  const confiamed = useMemo(() => {
    if (personas.length === 0) return null
    return cotizarConfiamed(
      personas.map((p) => ({ edad: p.edad, sexo: p.sexo, maternidad: p.maternidad })),
      confiamedRed,
    )
  }, [personas, confiamedRed])

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: NAVY }}>
            Cotizador
          </h1>
          <p className="text-sm text-muted-foreground">
            Herramienta interna · BMI (Sigma · Innova · GMM) y Humana · Salud individual/familiar
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={nuevaCotizacion} className="self-start">
          Nueva cotización
        </Button>
      </div>

      {/* ── Datos del cliente ── */}
      <div className="rounded-xl border bg-card p-4">
        <h2 className="mb-3 text-sm font-bold" style={{ color: NAVY }}>
          Datos del cliente
        </h2>

        <div className="mb-4">
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
            Región <span className="font-normal">(solo BMI)</span>
          </label>
          <div className="flex flex-wrap gap-2">
            {BMI_REGIONES.map((r) => {
              const active = region === r
              return (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRegion(r)}
                  className="rounded-full border px-4 py-1.5 text-sm font-medium transition-colors"
                  style={{
                    borderColor: GOLD,
                    backgroundColor: active ? GOLD : '#fff',
                    color: active ? '#fff' : NAVY,
                  }}
                >
                  {r}
                </button>
              )
            })}
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
            Integrantes (edad y sexo)
          </label>
          <div className="space-y-2">
            {miembros.map((m) => (
              <div key={m.id} className="flex flex-wrap items-center gap-2">
                <span className="w-28 shrink-0 text-sm" style={{ color: NAVY }}>
                  {m.parentesco}
                </span>
                <Input
                  type="number"
                  min={0}
                  max={105}
                  placeholder="Edad"
                  value={m.edad}
                  onChange={(e) => updateMiembro(m.id, { edad: e.target.value })}
                  className="h-9 w-24"
                />
                {/* Sexo (para Humana y Confiamed) */}
                <div className="flex overflow-hidden rounded-md border">
                  {(['M', 'F'] as const).map((s) => {
                    const active = m.sexo === s
                    return (
                      <button
                        key={s}
                        type="button"
                        onClick={() => updateMiembro(m.id, { sexo: s })}
                        className="px-3 py-1.5 text-sm font-medium transition-colors"
                        style={{
                          backgroundColor: active ? NAVY : '#fff',
                          color: active ? '#fff' : NAVY,
                        }}
                      >
                        {s === 'M' ? 'H' : 'M'}
                      </button>
                    )
                  })}
                </div>
                {/* Maternidad (para Confiamed) */}
                <button
                  type="button"
                  onClick={() => updateMiembro(m.id, { maternidad: !m.maternidad })}
                  className="rounded-md border px-3 py-1.5 text-xs font-medium transition-colors"
                  style={{
                    borderColor: m.maternidad ? GOLD : undefined,
                    backgroundColor: m.maternidad ? GOLD : '#fff',
                    color: m.maternidad ? '#fff' : NAVY,
                  }}
                  title="Incluir maternidad (Confiamed)"
                >
                  Maternidad
                </button>
                {m.parentesco !== 'Titular' && (
                  <button
                    type="button"
                    onClick={() => removeMiembro(m.id)}
                    className="rounded px-2 text-sm text-muted-foreground hover:text-red-600"
                    aria-label="Quitar"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>
          <p className="mt-1.5 text-[11px] text-muted-foreground">H = Hombre · M = Mujer</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => addMiembro('Cónyuge')}
              disabled={miembros.some((m) => m.parentesco === 'Cónyuge')}
            >
              + Cónyuge
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => addMiembro('Hijo/a')}>
              + Hijo/a
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => addMiembro('Dependiente')}
            >
              + Dependiente
            </Button>
          </div>
        </div>
      </div>

      {personas.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-muted/30 p-8 text-center text-sm text-muted-foreground">
          Ingresa al menos la edad del titular para ver las cotizaciones.
        </div>
      ) : (
        <div className="space-y-6">
          <p className="text-xs text-muted-foreground">
            {personas.length} {personas.length === 1 ? 'persona' : 'personas'} · Precios en USD
          </p>

          {/* ── BMI ── */}
          <div>
            <h2 className="mb-2 text-base font-bold" style={{ color: NAVY }}>
              BMI · {region}
            </h2>
            <div className="space-y-4">
              {bmi &&
                PLAN_ORDER.map((plan) => (
                  <div key={plan} className="rounded-xl border bg-card p-4">
                    <h3 className="mb-3 text-sm font-bold" style={{ color: NAVY }}>
                      {BMI_PLAN_LABEL[plan]}
                    </h3>
                    <div className="hidden overflow-x-auto md:block">
                      <table className="w-full border-collapse text-sm">
                        <thead>
                          <tr style={{ backgroundColor: NAVY, color: '#fff' }}>
                            <th className="px-3 py-2 text-left font-semibold">Deducible</th>
                            <th className="px-3 py-2 text-right font-semibold">Mensual</th>
                            <th className="px-3 py-2 text-right font-semibold">Anual</th>
                            <th className="px-3 py-2 text-right font-semibold">Contado −9%</th>
                            <th className="px-3 py-2 text-right font-semibold">Diferido −5%</th>
                            <th className="px-3 py-2 text-center font-semibold"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {bmi[plan].map((r, i) => (
                            <tr
                              key={r.deducible}
                              style={i % 2 === 1 ? { backgroundColor: '#f8f9fc' } : undefined}
                            >
                              <td className="px-3 py-2 font-medium" style={{ color: NAVY }}>
                                {r.label}
                              </td>
                              <td
                                className="px-3 py-2 text-right font-bold"
                                style={{ color: NAVY }}
                              >
                                ${money(r.mensualNormal)}
                              </td>
                              <td className="px-3 py-2 text-right text-[#333]">
                                ${money(r.anualNormal)}
                              </td>
                              <td className="px-3 py-2 text-right text-[#333]">
                                ${money(r.anualContado)}
                              </td>
                              <td className="px-3 py-2 text-right text-[#333]">
                                ${money(r.anualDiferido)}
                              </td>
                              <td className="px-2 py-2 text-center">
                                {(() => {
                                  const selId = `bmi-${plan}-${r.deducible}`
                                  const sel = estaSeleccionado(selId)
                                  return (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        toggleSeleccion({
                                          id: selId,
                                          catalogId: BMI_CATALOG_ID[plan],
                                          aseguradora: 'BMI',
                                          plan: BMI_PLAN_LABEL[plan],
                                          detalle: r.label,
                                          mensual: r.mensualNormal,
                                          deducible: r.deducible,
                                        })
                                      }
                                      className="rounded-full border px-2 py-0.5 text-[11px] font-medium transition-colors"
                                      style={{
                                        borderColor: GOLD,
                                        backgroundColor: sel ? GOLD : '#fff',
                                        color: sel ? '#fff' : NAVY,
                                      }}
                                    >
                                      {sel ? '✓ Añadido' : '+ Comparar'}
                                    </button>
                                  )
                                })()}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Mobile: cards apiladas por deducible */}
                    <div className="space-y-3 md:hidden">
                      {bmi[plan].map((r) => {
                        const selId = `bmi-${plan}-${r.deducible}`
                        const sel = estaSeleccionado(selId)
                        return (
                          <div key={r.deducible} className="rounded-lg border p-3">
                            <div className="mb-2 flex items-baseline justify-between gap-2">
                              <span className="text-sm font-bold" style={{ color: NAVY }}>
                                {r.label}
                              </span>
                              <span className="text-base font-bold" style={{ color: NAVY }}>
                                ${money(r.mensualNormal)}
                                <span className="text-xs font-normal text-muted-foreground">
                                  {' '}
                                  /mes
                                </span>
                              </span>
                            </div>
                            <div className="mb-3 space-y-1 border-t pt-2">
                              <CardStat label="Anual" value={`$${money(r.anualNormal)}`} />
                              <CardStat label="Contado −9%" value={`$${money(r.anualContado)}`} />
                              <CardStat label="Diferido −5%" value={`$${money(r.anualDiferido)}`} />
                            </div>
                            <CompararBtn
                              sel={sel}
                              onClick={() =>
                                toggleSeleccion({
                                  id: selId,
                                  catalogId: BMI_CATALOG_ID[plan],
                                  aseguradora: 'BMI',
                                  plan: BMI_PLAN_LABEL[plan],
                                  detalle: r.label,
                                  mensual: r.mensualNormal,
                                  deducible: r.deducible,
                                })
                              }
                              className="w-full py-2 text-xs"
                            />
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}
            </div>
          </div>

          {/* ── Humana ── */}
          <div>
            <h2 className="mb-2 text-base font-bold" style={{ color: NAVY }}>
              Humana
            </h2>
            <div className="rounded-xl border bg-card p-4">
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr style={{ backgroundColor: NAVY, color: '#fff' }}>
                      <th className="px-3 py-2 text-left font-semibold">Plan</th>
                      <th className="px-3 py-2 text-right font-semibold">Sin descuento</th>
                      <th className="px-3 py-2 text-right font-semibold">Descuento</th>
                      <th className="px-3 py-2 text-right font-semibold">Mensual final</th>
                      <th className="px-3 py-2 text-center font-semibold"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {humana &&
                      humana.map((r, i) => (
                        <tr
                          key={r.plan}
                          style={i % 2 === 1 ? { backgroundColor: '#f8f9fc' } : undefined}
                        >
                          <td className="px-3 py-2 font-medium" style={{ color: NAVY }}>
                            {r.label}
                          </td>
                          <td className="px-3 py-2 text-right text-[#333]">
                            ${money(r.subtotal)}
                          </td>
                          <td className="px-3 py-2 text-right text-[#333]">
                            {Math.round(r.descuento * 100)}%
                          </td>
                          <td className="px-3 py-2 text-right font-bold" style={{ color: NAVY }}>
                            ${money(r.mensual)}
                          </td>
                          <td className="px-2 py-2 text-center">
                            {(() => {
                              const catalogId = HUMANA_CATALOG_ID[r.plan]
                              if (!catalogId) return null // PH30 y MH150 no van al comparativo por ahora
                              const selId = `humana-${r.plan}`
                              const sel = estaSeleccionado(selId)
                              return (
                                <button
                                  type="button"
                                  onClick={() =>
                                    toggleSeleccion({
                                      id: selId,
                                      catalogId,
                                      aseguradora: 'Humana',
                                      plan: r.label,
                                      detalle: `${personas.length} pers · ${Math.round(r.descuento * 100)}% desc`,
                                      mensual: r.mensual,
                                    })
                                  }
                                  className="rounded-full border px-2 py-0.5 text-[11px] font-medium transition-colors"
                                  style={{
                                    borderColor: GOLD,
                                    backgroundColor: sel ? GOLD : '#fff',
                                    color: sel ? '#fff' : NAVY,
                                  }}
                                >
                                  {sel ? '✓ Añadido' : '+ Comparar'}
                                </button>
                              )
                            })()}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile: cards apiladas por plan */}
              <div className="space-y-3 md:hidden">
                {humana?.map((r) => {
                  const catalogId = HUMANA_CATALOG_ID[r.plan]
                  const selId = `humana-${r.plan}`
                  const sel = estaSeleccionado(selId)
                  return (
                    <div key={r.plan} className="rounded-lg border p-3">
                      <div className="mb-2 flex items-baseline justify-between gap-2">
                        <span className="text-sm font-bold" style={{ color: NAVY }}>
                          {r.label}
                        </span>
                        <span className="text-base font-bold" style={{ color: NAVY }}>
                          ${money(r.mensual)}
                          <span className="text-xs font-normal text-muted-foreground"> /mes</span>
                        </span>
                      </div>
                      <div className="mb-3 space-y-1 border-t pt-2">
                        <CardStat label="Sin descuento" value={`$${money(r.subtotal)}`} />
                        <CardStat label="Descuento" value={`${Math.round(r.descuento * 100)}%`} />
                      </div>
                      {catalogId ? (
                        <CompararBtn
                          sel={sel}
                          onClick={() =>
                            toggleSeleccion({
                              id: selId,
                              catalogId,
                              aseguradora: 'Humana',
                              plan: r.label,
                              detalle: `${personas.length} pers · ${Math.round(r.descuento * 100)}% desc`,
                              mensual: r.mensual,
                            })
                          }
                          className="w-full py-2 text-xs"
                        />
                      ) : null}
                    </div>
                  )
                })}
              </div>
              <p className="mt-3 text-[11px] text-muted-foreground">
                Descuento por Nº de personas ({personas.length}). Incluye seguro campesino (0,5%).
                Planes generales (adultos).
              </p>
            </div>
          </div>

          {/* ── Confiamed ── */}
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-3">
              <h2 className="text-base font-bold" style={{ color: NAVY }}>
                Confiamed
              </h2>
              {/* Selector de red */}
              <div className="flex overflow-hidden rounded-md border">
                {(['red1', 'red2'] as const).map((r) => {
                  const active = confiamedRed === r
                  return (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setConfiamedRed(r)}
                      className="px-3 py-1 text-xs font-medium transition-colors"
                      style={{
                        backgroundColor: active ? NAVY : '#fff',
                        color: active ? '#fff' : NAVY,
                      }}
                    >
                      {r === 'red1' ? 'Red 1 Top y libre elección' : 'Red 2'}
                    </button>
                  )
                })}
              </div>
            </div>
            <div className="rounded-xl border bg-card p-4">
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr style={{ backgroundColor: NAVY, color: '#fff' }}>
                      <th className="px-3 py-2 text-left font-semibold">Deducible</th>
                      <th className="px-3 py-2 text-right font-semibold">Mensual</th>
                      <th className="px-3 py-2 text-right font-semibold">Anual</th>
                      <th className="px-3 py-2 text-center font-semibold"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {confiamed &&
                      confiamed.map((r, i) => (
                        <tr
                          key={r.deducible}
                          style={i % 2 === 1 ? { backgroundColor: '#f8f9fc' } : undefined}
                        >
                          <td className="px-3 py-2 font-medium" style={{ color: NAVY }}>
                            {CONFIAMED_DEDUCIBLE_LABEL[r.deducible]}
                          </td>
                          <td className="px-3 py-2 text-right font-bold" style={{ color: NAVY }}>
                            ${money(r.mensual)}
                          </td>
                          <td className="px-3 py-2 text-right text-[#333]">${money(r.anual)}</td>
                          <td className="px-2 py-2 text-center">
                            {(() => {
                              const redLabel = confiamedRed === 'red1' ? 'Red 1 Top' : 'Red 2'
                              const selId = `confiamed-${confiamedRed}-${r.deducible}`
                              const sel = estaSeleccionado(selId)
                              return (
                                <button
                                  type="button"
                                  onClick={() =>
                                    toggleSeleccion({
                                      id: selId,
                                      catalogId: CONFIAMED_CATALOG_ID[r.deducible],
                                      aseguradora: 'Confiamed',
                                      plan: `CONFIPLUS ${redLabel}`,
                                      detalle: CONFIAMED_DEDUCIBLE_LABEL[r.deducible],
                                      mensual: r.mensual,
                                      red: confiamedRed,
                                    })
                                  }
                                  className="rounded-full border px-2 py-0.5 text-[11px] font-medium transition-colors"
                                  style={{
                                    borderColor: GOLD,
                                    backgroundColor: sel ? GOLD : '#fff',
                                    color: sel ? '#fff' : NAVY,
                                  }}
                                >
                                  {sel ? '✓ Añadido' : '+ Comparar'}
                                </button>
                              )
                            })()}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile: cards apiladas por deducible */}
              <div className="space-y-3 md:hidden">
                {confiamed?.map((r) => {
                  const redLabel = confiamedRed === 'red1' ? 'Red 1 Top' : 'Red 2'
                  const selId = `confiamed-${confiamedRed}-${r.deducible}`
                  const sel = estaSeleccionado(selId)
                  return (
                    <div key={r.deducible} className="rounded-lg border p-3">
                      <div className="mb-2 flex items-baseline justify-between gap-2">
                        <span className="text-sm font-bold" style={{ color: NAVY }}>
                          {CONFIAMED_DEDUCIBLE_LABEL[r.deducible]}
                        </span>
                        <span className="text-base font-bold" style={{ color: NAVY }}>
                          ${money(r.mensual)}
                          <span className="text-xs font-normal text-muted-foreground"> /mes</span>
                        </span>
                      </div>
                      <div className="mb-3 space-y-1 border-t pt-2">
                        <CardStat label="Anual" value={`$${money(r.anual)}`} />
                      </div>
                      <CompararBtn
                        sel={sel}
                        onClick={() =>
                          toggleSeleccion({
                            id: selId,
                            catalogId: CONFIAMED_CATALOG_ID[r.deducible],
                            aseguradora: 'Confiamed',
                            plan: `CONFIPLUS ${redLabel}`,
                            detalle: CONFIAMED_DEDUCIBLE_LABEL[r.deducible],
                            mensual: r.mensual,
                            red: confiamedRed,
                          })
                        }
                        className="w-full py-2 text-xs"
                      />
                    </div>
                  )
                })}
              </div>
              <p className="mt-3 text-[11px] text-muted-foreground">
                Producto CONFIPLUS · {confiamedRed === 'red1' ? 'Red 1 Top y libre elección' : 'Red 2'}.
                Marca "Maternidad" en cada integrante que la requiera. Sin descuento familiar;
                precios incluyen impuestos.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Aseguradoras manuales (Saludsa, Bupa...) ── */}
      <div className="rounded-xl border border-dashed bg-card p-4">
        <h2 className="mb-1 text-base font-bold" style={{ color: NAVY }}>
          Agregar plan manual
        </h2>
        <p className="mb-3 text-xs text-muted-foreground">
          Para aseguradoras sin cotizador (Saludsa, Bupa). Elige el plan y digita el precio mensual.
        </p>
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-[200px] flex-1">
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Plan</label>
            <select
              value={manualPlanId}
              onChange={(e) => setManualPlanId(e.target.value)}
              className="h-9 w-full rounded-md border bg-white px-2 text-sm"
              style={{ color: NAVY }}
            >
              <option value="">Selecciona un plan…</option>
              {PLANES_MANUALES.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.insurer} · {p.name}
                </option>
              ))}
            </select>
          </div>
          <div className="w-32">
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              Precio /mes
            </label>
            <div className="flex items-center gap-1">
              <span className="text-sm text-muted-foreground">$</span>
              <Input
                placeholder="0,00"
                value={manualPrecio}
                onChange={(e) => setManualPrecio(e.target.value)}
                className="h-9"
              />
            </div>
          </div>
          <Button
            type="button"
            onClick={agregarManual}
            disabled={!manualPlanId || !manualPrecio}
            style={{ backgroundColor: GOLD, color: '#fff' }}
          >
            + Agregar
          </Button>
        </div>
      </div>

      {/* ── Seleccionados para el comparativo ── */}
      {seleccionados.length > 0 && (
        <div
          className="sticky bottom-4 rounded-xl border-2 bg-card p-4 shadow-lg"
          style={{ borderColor: GOLD }}
        >
          <h2 className="mb-3 text-sm font-bold" style={{ color: NAVY }}>
            Seleccionados para el comparativo ({seleccionados.length})
          </h2>
          <div className="space-y-2">
            {seleccionados.map((s) => (
              <div
                key={s.id}
                className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2"
              >
                <div className="min-w-0 flex-1">
                  <span className="text-sm font-medium" style={{ color: NAVY }}>
                    {s.aseguradora} · {s.plan}
                  </span>
                  <span className="ml-2 text-xs text-muted-foreground">{s.detalle}</span>
                </div>
                <span className="shrink-0 text-sm font-bold" style={{ color: NAVY }}>
                  ${money(s.mensual)}/mes
                </span>
                <button
                  type="button"
                  onClick={() => quitarSeleccion(s.id)}
                  className="shrink-0 rounded px-1.5 text-sm text-muted-foreground hover:text-red-600"
                  aria-label="Quitar"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setSeleccionados([])}
              className="text-xs text-muted-foreground hover:text-red-600"
            >
              Limpiar todo
            </button>
            <Button
              type="button"
              style={{ backgroundColor: NAVY, color: '#fff' }}
              onClick={() => {
                // Codificar las selecciones en la URL para pasarlas al comparativo.
                // catalogId es lo que el comparativo usa para encontrar el plan; sin él llega vacío.
                const payload = seleccionados.map((s) => ({
                  catalogId: s.catalogId,
                  aseguradora: s.aseguradora,
                  plan: s.plan,
                  detalle: s.detalle,
                  mensual: s.mensual,
                  deducible: s.deducible,
                  red: s.red,
                }))
                const encoded = encodeURIComponent(JSON.stringify(payload))
                router.push(`/comparativos?cotizacion=${encoded}`)
              }}
            >
              Generar comparativo
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
