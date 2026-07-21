'use client'

import { useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Printer, Eye, EyeOff } from 'lucide-react'
import { CATALOGS, type CatalogKey } from '@/lib/comparativos-data'
import { PRIORITY_LOGO_DATA_URI } from '@/lib/priority-logo'
import { cn } from '@/lib/utils'

const NAVY = '#0C2057'
const GOLD = '#DBAA59'

const MAX_PLANS = 3

const TAB_LABELS: { key: CatalogKey; label: string }[] = [
  { key: 'salud', label: 'Salud' },
  { key: 'internacional', label: 'Internacionales' },
  { key: 'vehiculos', label: 'Vehículos' },
]

const SUBTITLES: Record<CatalogKey, string> = {
  salud: 'Planes Médicos Locales',
  internacional: 'Planes Médicos Internacionales',
  vehiculos: 'Seguro de Vehículos · Livianos',
}

const PRIMA_LABEL: Record<CatalogKey, string> = {
  salud: 'Prima mensual',
  internacional: 'Prima mensual',
  vehiculos: 'Prima mensual (12 meses)',
}

const NETWORK_LABEL: Record<'abierta' | 'cerrada', string> = {
  abierta: 'Red Abierta',
  cerrada: 'Red Cerrada',
}

// Orden preferido de aseguradoras SOLO en el paso 1 (selección de planes).
// Saludsa siempre primero; el resto mantiene el orden en que aparece en el catálogo.
const INSURER_PRIORITY: Record<string, number> = {
  Saludsa: 0,
}

// Filas de maternidad: se ocultan por completo cuando el asesor elige "Sin Maternidad"
const MATERNIDAD_LABELS = ['Maternidad', 'Complicaciones de Maternidad', 'Complicaciones Recién Nacido']

// Valores que cuentan como "no lo tiene" para efectos de ocultar filas tipo Vitality
const NEGATIVE_VALUES = new Set(['no posee', 'no incluye', '—', 'no aplica'])

// Planes de BMI que permiten cotizar varias primas, una por cada deducible.
// El asesor elige un deducible de la lista y escribe la prima manualmente.
const BMI_DEDUCIBLE_PLANS: Record<string, number[]> = {
  'BMI SIGMA': [250, 500, 1000, 2000],
  'BMI GMM': [5000, 10000, 15000, 20000],
}

// Planes de Confiamed que permiten elegir Red 1 o Red 2. El texto que sale en la
// fila "Red Medica" del PDF depende de la red elegida.
// - 30 / 60 / 110: Red 1 => "Red 1 Top y libre elección"
// - 10K: Red 1 => "Red 1" (sin "Top y libre elección")
const CONFIAMED_RED_PLANS: Record<string, { red1: string; red2: string }> = {
  'CONFIAMED 30': { red1: 'Red 1 Top y libre elección', red2: 'Red 2' },
  'CONFIAMED 60': { red1: 'Red 1 Top y libre elección', red2: 'Red 2' },
  'CONFIAMED 110': { red1: 'Red 1 Top y libre elección', red2: 'Red 2' },
  'CONFIAMED 10': { red1: 'Red 1', red2: 'Red 2' },
}

// Una prima extra asociada a un deducible específico (para BMI Sigma / GMM)
interface PrimaExtra {
  deducible: number
  valor: string
}

function isNegativeValue(v: string | null | undefined) {
  if (!v) return true
  return NEGATIVE_VALUES.has(v.trim().toLowerCase())
}

export function ComparativosPage() {
  const { data: session } = useSession()
  const advisorName = (session?.user as { name?: string } | undefined)?.name ?? ''

  const [tab, setTab] = useState<CatalogKey>('salud')
  const [clientName, setClientName] = useState('')
  const [selected, setSelected] = useState<Record<CatalogKey, string[]>>({
    salud: [], internacional: [], vehiculos: [],
  })
  const [primas, setPrimas] = useState<Record<string, string>>({})
  // Primas adicionales por deducible, solo para BMI Sigma / GMM. Clave = id del plan.
  const [primasExtra, setPrimasExtra] = useState<Record<string, PrimaExtra[]>>({})
  // Red elegida por plan de Confiamed ('red1' | 'red2'). Clave = id del plan. Default red1.
  const [confiamedRed, setConfiamedRed] = useState<Record<string, 'red1' | 'red2'>>({})
  const [preview, setPreview] = useState(false)
  const [recommended, setRecommended] = useState<Record<CatalogKey, string | null>>({
    salud: null, internacional: null, vehiculos: null,
  })
  // Con/Sin Maternidad, solo aplica (y solo se muestra el selector) en la categoría Salud
  const [maternidad, setMaternidad] = useState(true)

  const catalog = CATALOGS[tab]
  const selectedIds = selected[tab]

  const insurers = useMemo(() => {
    const groups: Record<string, typeof catalog.plans> = {}
    for (const p of catalog.plans) {
      groups[p.insurer] = groups[p.insurer] ?? []
      groups[p.insurer].push(p)
    }
    // Reordenar: Saludsa primero (solo afecta el orden visual del paso 1, no el PDF)
    const entries = Object.entries(groups)
    entries.sort((a, b) => (INSURER_PRIORITY[a[0]] ?? 99) - (INSURER_PRIORITY[b[0]] ?? 99))
    return Object.fromEntries(entries)
  }, [catalog])

  const selectedPlans = catalog.plans.filter((p) => selectedIds.includes(p.id))
  const limitReached = selectedIds.length >= MAX_PLANS

  const toggle = (id: string) => {
    setSelected((prev) => {
      const cur = prev[tab]
      const isSelected = cur.includes(id)
      if (!isSelected && cur.length >= MAX_PLANS) {
        // Ya hay 3 planes seleccionados en esta categoría: no se permite un cuarto
        return prev
      }
      const next = isSelected ? cur.filter((x) => x !== id) : [...cur, id]
      return { ...prev, [tab]: next }
    })
    setRecommended((prev) => (prev[tab] === id ? { ...prev, [tab]: null } : prev))
  }

  const toggleRecommended = (id: string) => {
    setRecommended((prev) => ({ ...prev, [tab]: prev[tab] === id ? null : id }))
  }

  // ---- Primas extra por deducible (BMI Sigma / GMM) ----
  // Deducibles de un plan que aún no han sido agregados como prima extra.
  const availableDeducibles = (planName: string, planId: string): number[] => {
    const all = BMI_DEDUCIBLE_PLANS[planName]
    if (!all) return []
    const used = new Set((primasExtra[planId] ?? []).map((e) => e.deducible))
    return all.filter((d) => !used.has(d))
  }

  const addPrimaExtra = (planId: string, deducible: number) => {
    setPrimasExtra((prev) => ({
      ...prev,
      [planId]: [...(prev[planId] ?? []), { deducible, valor: '' }],
    }))
  }

  const updatePrimaExtra = (planId: string, deducible: number, valor: string) => {
    setPrimasExtra((prev) => ({
      ...prev,
      [planId]: (prev[planId] ?? []).map((e) => (e.deducible === deducible ? { ...e, valor } : e)),
    }))
  }

  const removePrimaExtra = (planId: string, deducible: number) => {
    setPrimasExtra((prev) => ({
      ...prev,
      [planId]: (prev[planId] ?? []).filter((e) => e.deducible !== deducible),
    }))
  }

  // Planes ordenados de menor a mayor por prima, solo para el documento/PDF final.
  // Los que no tienen prima ingresada quedan al final.
  const documentPlans = useMemo(() => {
    const toNum = (raw: string) => {
      const n = parseFloat(raw.replace(/[^0-9.,]/g, '').replace(',', '.'))
      return Number.isFinite(n) ? n : Infinity
    }
    const parsePrima = (plan: (typeof selectedPlans)[number]) => {
      // BMI Sigma/GMM: usar la prima más baja entre los deducibles ingresados
      if (BMI_DEDUCIBLE_PLANS[plan.name]) {
        const vals = (primasExtra[plan.id] ?? [])
          .map((e) => toNum(e.valor))
          .filter((n) => Number.isFinite(n))
        return vals.length ? Math.min(...vals) : Infinity
      }
      return toNum(primas[plan.id] ?? '')
    }
    return [...selectedPlans].sort((a, b) => parsePrima(a) - parsePrima(b))
  }, [selectedPlans, primas, primasExtra])

  // Filas con al menos un valor en los planes seleccionados, aplicando las reglas de
  // Maternidad (ocultar si "Sin Maternidad") y Vitality (ocultar si nadie la tiene).
  const rows = useMemo(() => {
    if (!documentPlans.length) return []
    return catalog.benefits
      .filter((b) => {
        if (tab === 'salud' && !maternidad && MATERNIDAD_LABELS.includes(b.label)) return false
        return true
      })
      .map((b) => ({
        label: b.label,
        values: documentPlans.map((p) => b.values[catalog.plans.indexOf(p)] ?? '—'),
      }))
      .filter((r) => r.values.some((v) => v && v !== '—'))
      .filter((r) => {
        if (r.label === 'Saludsa Vitality') {
          return r.values.some((v) => !isNegativeValue(v))
        }
        return true
      })
  }, [catalog, documentPlans, tab, maternidad])

  const today = new Date().toLocaleDateString('es-EC', { day: 'numeric', month: 'long', year: 'numeric' })

  const handlePrint = () => {
    setPreview(true)
    setTimeout(() => window.print(), 150)
  }

  return (
    <div className="flex h-full flex-col gap-4">
      {/* ── Controles (ocultos al imprimir) ─────────────────────────────── */}
      <div className="print:hidden">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Comparativos</h1>
            <p className="text-sm text-muted-foreground">
              Selecciona los planes, ingresa las primas y genera la cotización en PDF
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setPreview((v) => !v)}>
              {preview ? <EyeOff className="mr-2 h-4 w-4" /> : <Eye className="mr-2 h-4 w-4" />}
              {preview ? 'Ocultar vista previa' : 'Vista previa'}
            </Button>
            <Button
              onClick={handlePrint}
              disabled={!selectedPlans.length}
              style={{ backgroundColor: GOLD, color: NAVY }}
            >
              <Printer className="mr-2 h-4 w-4" /> Generar PDF
            </Button>
          </div>
        </div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as CatalogKey)} className="mt-4">
          <TabsList>
            {TAB_LABELS.map((t) => (
              <TabsTrigger key={t.key} value={t.key}>{t.label}</TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Nombre del cliente
            </label>
            <Input
              placeholder="Ej. María Fernanda Torres"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              className="h-12 text-base"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Asesor
            </label>
            <Input value={advisorName} readOnly className="h-12 bg-muted/40 text-base font-medium" />
          </div>
        </div>

        {tab === 'salud' && (
          <div className="mt-4">
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Maternidad
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setMaternidad(true)}
                className={cn(
                  'rounded-xl border-2 px-4 py-2 text-sm font-semibold transition-all',
                  maternidad ? 'border-[#DBAA59] bg-[#fdf8ef] shadow-sm' : 'border-border bg-card hover:border-[#DBAA59]/50',
                )}
                style={{ color: NAVY }}
              >
                {maternidad ? '✓ ' : ''}Con Maternidad
              </button>
              <button
                type="button"
                onClick={() => setMaternidad(false)}
                className={cn(
                  'rounded-xl border-2 px-4 py-2 text-sm font-semibold transition-all',
                  !maternidad ? 'border-[#DBAA59] bg-[#fdf8ef] shadow-sm' : 'border-border bg-card hover:border-[#DBAA59]/50',
                )}
                style={{ color: NAVY }}
              >
                {!maternidad ? '✓ ' : ''}Sin Maternidad
              </button>
            </div>
          </div>
        )}

        <div className="mt-5">
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
            1 · Selecciona los planes a comparar ({selectedPlans.length}/{MAX_PLANS} seleccionados)
          </p>
          <div className="space-y-3">
            {Object.entries(insurers).map(([insurer, plans]) => (
              <div key={insurer}>
                <p className="mb-1.5 text-sm font-bold" style={{ color: NAVY }}>{insurer}</p>
                <div className="flex flex-wrap gap-2">
                  {plans.map((p) => {
                    const sel = selectedIds.includes(p.id)
                    const disabled = !sel && limitReached
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => toggle(p.id)}
                        disabled={disabled}
                        title={disabled ? `Máximo ${MAX_PLANS} planes por categoría` : undefined}
                        className={cn(
                          'rounded-xl border-2 px-4 py-2 text-sm font-semibold transition-all',
                          sel
                            ? 'border-[#DBAA59] bg-[#fdf8ef] shadow-sm'
                            : disabled
                              ? 'cursor-not-allowed border-border bg-muted/30 opacity-50'
                              : 'border-border bg-card hover:border-[#DBAA59]/50',
                        )}
                        style={{ color: NAVY }}
                      >
                        {sel ? '✓ ' : ''}{p.name}
                        {p.network && (
                          <span className="ml-1.5 text-[10px] font-normal text-muted-foreground">
                            · {NETWORK_LABEL[p.network]}
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
          {limitReached && (
            <p className="mt-2 text-xs font-medium" style={{ color: GOLD }}>
              Máximo {MAX_PLANS} planes por comparativo. Deselecciona uno para elegir otro.
            </p>
          )}
        </div>

        {selectedPlans.length > 0 && (
          <div className="mt-5">
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
              2 · {PRIMA_LABEL[tab]} de cada plan seleccionado · marca el recomendado
            </p>
            <div className="flex flex-wrap gap-3">
              {selectedPlans.map((p) => {
                const isRec = recommended[tab] === p.id
                return (
                <div
                  key={p.id}
                  className={cn('min-w-[220px] flex-1 rounded-xl border bg-card p-3', isRec && 'ring-2 ring-offset-1')}
                  style={{
                    borderTopWidth: 3,
                    borderTopColor: GOLD,
                    ...(isRec ? { boxShadow: `0 0 0 2px ${GOLD}` } : {}),
                  }}
                >
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-bold" style={{ color: NAVY }}>{p.name}</p>
                    <button
                      type="button"
                      onClick={() => toggleRecommended(p.id)}
                      className={cn(
                        'flex shrink-0 items-center gap-1.5 rounded-full border-2 px-3 py-1.5 text-xs font-bold transition-colors',
                        isRec ? 'text-white' : 'text-[#DBAA59]',
                      )}
                      style={{
                        backgroundColor: isRec ? GOLD : '#fff',
                        borderColor: GOLD,
                      }}
                    >
                      {isRec ? '★ Recomendado' : '☆ Recomendar'}
                    </button>
                  </div>
                  {BMI_DEDUCIBLE_PLANS[p.name] ? (
                    /* BMI Sigma / GMM: todas las primas van con su deducible (sin prima "suelta") */
                    <div className="space-y-2">
                      {(primasExtra[p.id] ?? []).map((extra) => (
                        <div key={extra.deducible} className="flex items-center gap-1">
                          <span className="text-sm text-muted-foreground">$</span>
                          <Input
                            placeholder="0,00"
                            value={extra.valor}
                            onChange={(e) => updatePrimaExtra(p.id, extra.deducible, e.target.value)}
                            className="h-9"
                          />
                          <span className="whitespace-nowrap text-[11px] text-muted-foreground">
                            /mes · Ded. {extra.deducible.toLocaleString('es-EC')}
                          </span>
                          <button
                            type="button"
                            onClick={() => removePrimaExtra(p.id, extra.deducible)}
                            className="ml-auto shrink-0 rounded px-1.5 text-sm text-muted-foreground hover:text-red-600"
                            aria-label="Quitar deducible"
                          >
                            ×
                          </button>
                        </div>
                      ))}

                      {availableDeducibles(p.name, p.id).length > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-[11px] font-medium text-muted-foreground">
                            {(primasExtra[p.id] ?? []).length === 0 ? 'Elige un deducible:' : '+ Deducible:'}
                          </span>
                          {availableDeducibles(p.name, p.id).map((d) => (
                            <button
                              key={d}
                              type="button"
                              onClick={() => addPrimaExtra(p.id, d)}
                              className="rounded-full border px-2 py-0.5 text-[11px] font-medium transition-colors hover:bg-[#DBAA59] hover:text-white"
                              style={{ borderColor: GOLD, color: NAVY }}
                            >
                              {d.toLocaleString('es-EC')}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    /* Resto de planes: prima simple como siempre */
                    <div className="flex items-center gap-1">
                      <span className="text-sm text-muted-foreground">$</span>
                      <Input
                        placeholder="0,00"
                        value={primas[p.id] ?? ''}
                        onChange={(e) => setPrimas((prev) => ({ ...prev, [p.id]: e.target.value }))}
                        className="h-9"
                      />
                      <span className="text-xs text-muted-foreground">/mes</span>
                    </div>
                  )}

                  {/* Confiamed: elegir Red 1 o Red 2 (cambia la fila Red Medica en el PDF) */}
                  {CONFIAMED_RED_PLANS[p.name] && (
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <span className="text-[11px] font-medium text-muted-foreground">Red médica:</span>
                      {(['red1', 'red2'] as const).map((red) => {
                        const active = (confiamedRed[p.id] ?? 'red1') === red
                        return (
                          <button
                            key={red}
                            type="button"
                            onClick={() => setConfiamedRed((prev) => ({ ...prev, [p.id]: red }))}
                            className="rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors"
                            style={{
                              borderColor: GOLD,
                              backgroundColor: active ? GOLD : '#fff',
                              color: active ? '#fff' : NAVY,
                            }}
                          >
                            {red === 'red1' ? 'Red 1' : 'Red 2'}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── Documento (vista previa + impresión) ────────────────────────── */}
      {documentPlans.length > 0 && (
        <div className={cn('comparativo-doc', preview ? 'block' : 'hidden print:block')}>
          <div className="relative overflow-hidden rounded-xl border bg-white shadow-sm print:rounded-none print:border-0 print:shadow-none">
            {/* Marca de agua: un solo logo de Priority, centrado, mediano-grande, repetido en cada página al imprimir */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 z-0 flex select-none items-center justify-center print:fixed print:inset-0"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={PRIORITY_LOGO_DATA_URI}
                alt=""
                style={{ width: '460px', height: 'auto', opacity: 0.22 }}
              />
            </div>
            {/* Header */}
            <div className="relative z-10 flex items-center justify-between px-10 py-6 print:px-8" style={{ backgroundColor: NAVY }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={PRIORITY_LOGO_DATA_URI} alt="Priority Asesores de Seguros" className="h-14 w-auto" />
              <div className="text-right text-[12.5px] font-medium leading-relaxed text-white">
                Cotización preparada para
                <br />
                <span className="text-[19px] font-bold text-white">{clientName || '—'}</span>
                <br />
                {today}{advisorName ? ` · Asesor: ${advisorName}` : ''}
              </div>
            </div>
            <div className="relative z-10 h-1" style={{ background: `linear-gradient(90deg, ${GOLD}, #f0d9ad)` }} />

            {/* Body */}
            <div className="relative z-10 px-10 py-7 print:px-8">
              <h2 className="text-lg font-bold" style={{ color: NAVY }}>Comparativo de Planes</h2>
              <p className="mb-3 text-xs text-muted-foreground">
                {SUBTITLES[tab]} · Los {documentPlans.length} planes que mejor se ajustan a tu perfil
              </p>

              <p className="mb-5 rounded-lg border-l-4 bg-[#f7f8fc] px-4 py-3 text-[12px] leading-relaxed text-[#2a3350]" style={{ borderColor: GOLD }}>
                Estimado{clientName ? ` ${clientName.split(' ')[0]}` : ''}, hemos hecho un análisis exhaustivo de los planes del mercado, los cuales te presentamos a continuación. Recuerda que todos los planes incluyen la experiencia de Servicio Priority.
              </p>

              <table className="w-full border-collapse text-[11px]">
                <thead>
                  <tr>
                    <th className="rounded-tl-lg px-3 py-2.5 text-left text-white" style={{ backgroundColor: NAVY, width: '22%' }}>
                      Beneficio
                    </th>
                    {documentPlans.map((p, i) => {
                      const isRec = recommended[tab] === p.id
                      return (
                      <th
                        key={p.id}
                        className={cn('px-3 py-2.5 text-left text-white', i === documentPlans.length - 1 && 'rounded-tr-lg')}
                        style={{ backgroundColor: isRec ? '#8a6620' : NAVY }}
                      >
                        {isRec && (
                          <div className="mb-0.5 inline-block rounded px-1.5 py-0.5 text-[8.5px] font-bold tracking-wide" style={{ backgroundColor: GOLD, color: NAVY }}>
                            ★ RECOMENDADO
                          </div>
                        )}
                        <div>{p.name}</div>
                      </th>
                      )
                    })}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, ri) => (
                    <tr key={r.label} style={ri % 2 === 1 ? { backgroundColor: 'rgba(248,249,252,0.55)' } : undefined}>
                      <td
                        className="px-3 py-2 align-top font-semibold"
                        style={{ color: NAVY, borderBottom: '1px solid #c7d0e8' }}
                      >
                        {r.label}
                      </td>
                      {documentPlans.map((p, vi) => (
                        <td
                          key={vi}
                          className="px-3 py-2 align-top text-[#333]"
                          style={{
                            borderBottom: '1px solid #c7d0e8',
                            backgroundColor: recommended[tab] === p.id ? 'rgba(219,170,89,.10)' : undefined,
                          }}
                        >
                          {r.label === 'Deducible' && BMI_DEDUCIBLE_PLANS[p.name]
                            ? 'A Elección'
                            : r.label === 'Red Medica' && CONFIAMED_RED_PLANS[p.name]
                            ? CONFIAMED_RED_PLANS[p.name][confiamedRed[p.id] ?? 'red1']
                            : r.values[vi] ?? '—'}
                        </td>
                      ))}
                    </tr>
                  ))}
                  <tr style={{ backgroundColor: 'rgba(253,248,239,0.7)' }}>
                    <td className="px-3 py-3 font-bold" style={{ color: NAVY, borderTop: `2px solid ${GOLD}` }}>
                      {PRIMA_LABEL[tab].toUpperCase()}
                    </td>
                    {documentPlans.map((p) => (
                      <td
                        key={p.id}
                        className="px-3 py-3"
                        style={{
                          borderTop: `2px solid ${GOLD}`,
                          backgroundColor: recommended[tab] === p.id ? 'rgba(219,170,89,.22)' : undefined,
                        }}
                      >
                        {BMI_DEDUCIBLE_PLANS[p.name] ? (
                          (() => {
                            const items = (primasExtra[p.id] ?? []).filter((e) => e.valor.trim() !== '')
                            if (items.length === 0) {
                              return <span className="text-[15px] font-bold" style={{ color: NAVY }}>—</span>
                            }
                            return items.map((e) => (
                              <div key={e.deducible} className="leading-tight [&:not(:first-child)]:mt-1">
                                <span className="text-[15px] font-bold" style={{ color: NAVY }}>
                                  ${e.valor}
                                </span>
                                <span className="ml-1 text-[9px] text-muted-foreground">
                                  /mes · Deducible {e.deducible.toLocaleString('es-EC')}
                                </span>
                              </div>
                            ))
                          })()
                        ) : (
                          <>
                            <span className="text-[15px] font-bold" style={{ color: NAVY }}>
                              {primas[p.id] ? `$${primas[p.id]}` : '—'}
                            </span>
                            {primas[p.id] && <span className="ml-1 text-[9px] text-muted-foreground">/mes</span>}
                          </>
                        )}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>

              <div className="mt-6 flex justify-between border-t pt-3 text-[9.5px] text-muted-foreground">
                <span className="font-semibold" style={{ color: NAVY }}>Priority Asesores de Seguros · www.priority.ec · WhatsApp 099 591 5761</span>
                <span>Información detallada de coberturas y beneficios, revisar en la ilustración adjunta de cada Plan Médico</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Estilos de impresión: solo el documento sale en el PDF */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
        @media print {
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
          }
          body * { visibility: hidden; }
          .comparativo-doc, .comparativo-doc * { visibility: visible; }
          .comparativo-doc { position: absolute; left: 0; top: 0; width: 100%; }
          @page { size: A4 landscape; margin: 8mm; }
        }
      `,
        }}
      />
    </div>
  )
}
