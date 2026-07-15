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

const TAB_LABELS: { key: CatalogKey; label: string }[] = [
  { key: 'abierta', label: 'Médicos · Red Abierta' },
  { key: 'cerrada', label: 'Médicos · Red Cerrada' },
  { key: 'internacional', label: 'Internacionales' },
  { key: 'vehiculos', label: 'Vehículos' },
]

const SUBTITLES: Record<CatalogKey, string> = {
  abierta: 'Planes Médicos Locales · Red Médica Abierta',
  cerrada: 'Planes Médicos Locales · Red Médica Cerrada',
  internacional: 'Planes Médicos Internacionales',
  vehiculos: 'Seguro de Vehículos · Livianos',
}

const PRIMA_LABEL: Record<CatalogKey, string> = {
  abierta: 'Prima mensual',
  cerrada: 'Prima mensual',
  internacional: 'Prima mensual',
  vehiculos: 'Prima mensual (12 meses)',
}

export function ComparativosPage() {
  const { data: session } = useSession()
  const advisorName = (session?.user as { name?: string } | undefined)?.name ?? ''

  const [tab, setTab] = useState<CatalogKey>('abierta')
  const [clientName, setClientName] = useState('')
  const [selected, setSelected] = useState<Record<CatalogKey, string[]>>({
    abierta: [], cerrada: [], internacional: [], vehiculos: [],
  })
  const [primas, setPrimas] = useState<Record<string, string>>({})
  const [preview, setPreview] = useState(false)
  const [recommended, setRecommended] = useState<Record<CatalogKey, string | null>>({
    abierta: null, cerrada: null, internacional: null, vehiculos: null,
  })

  const catalog = CATALOGS[tab]
  const selectedIds = selected[tab]

  const insurers = useMemo(() => {
    const groups: Record<string, typeof catalog.plans> = {}
    for (const p of catalog.plans) {
      groups[p.insurer] = groups[p.insurer] ?? []
      groups[p.insurer].push(p)
    }
    return groups
  }, [catalog])

  const selectedPlans = catalog.plans.filter((p) => selectedIds.includes(p.id))

  const toggle = (id: string) => {
    setSelected((prev) => {
      const cur = prev[tab]
      const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]
      return { ...prev, [tab]: next }
    })
    setRecommended((prev) => (prev[tab] === id ? { ...prev, [tab]: null } : prev))
  }

  const toggleRecommended = (id: string) => {
    setRecommended((prev) => ({ ...prev, [tab]: prev[tab] === id ? null : id }))
  }

  // Filas con al menos un valor en los planes seleccionados
  const rows = useMemo(() => {
    if (!selectedPlans.length) return []
    return catalog.benefits
      .map((b) => ({
        label: b.label,
        values: selectedPlans.map((p) => b.values[catalog.plans.indexOf(p)] ?? '—'),
      }))
      .filter((r) => r.values.some((v) => v && v !== '—'))
  }, [catalog, selectedPlans])

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
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Asesor
            </label>
            <Input value={advisorName} readOnly className="bg-muted/40" />
          </div>
        </div>

        <div className="mt-5">
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
            1 · Selecciona los planes a comparar ({selectedPlans.length} seleccionados)
          </p>
          <div className="space-y-3">
            {Object.entries(insurers).map(([insurer, plans]) => (
              <div key={insurer}>
                <p className="mb-1.5 text-sm font-bold" style={{ color: NAVY }}>{insurer}</p>
                <div className="flex flex-wrap gap-2">
                  {plans.map((p) => {
                    const sel = selectedIds.includes(p.id)
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => toggle(p.id)}
                        className={cn(
                          'rounded-xl border-2 px-4 py-2 text-sm font-semibold transition-all',
                          sel
                            ? 'border-[#DBAA59] bg-[#fdf8ef] shadow-sm'
                            : 'border-border bg-card hover:border-[#DBAA59]/50',
                        )}
                        style={{ color: NAVY }}
                      >
                        {sel ? '✓ ' : ''}{p.name}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
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
                  className={cn('min-w-[180px] flex-1 rounded-xl border bg-card p-3', isRec && 'ring-2 ring-offset-1')}
                  style={{
                    borderTopWidth: 3,
                    borderTopColor: GOLD,
                    ...(isRec ? { boxShadow: `0 0 0 2px ${GOLD}` } : {}),
                  }}
                >
                  <div className="mb-1.5 flex items-center justify-between gap-2">
                    <p className="text-xs font-bold" style={{ color: NAVY }}>{p.name}</p>
                    <button
                      type="button"
                      onClick={() => toggleRecommended(p.id)}
                      className={cn(
                        'flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold transition-colors',
                        isRec ? 'border-transparent text-white' : 'border-border text-muted-foreground hover:border-[#DBAA59]',
                      )}
                      style={isRec ? { backgroundColor: GOLD } : undefined}
                    >
                      {isRec ? '★ Recomendado' : '☆ Recomendar'}
                    </button>
                  </div>
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
                </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── Documento (vista previa + impresión) ────────────────────────── */}
      {selectedPlans.length > 0 && (
        <div className={cn('comparativo-doc', preview ? 'block' : 'hidden print:block')}>
          <div className="overflow-hidden rounded-xl border bg-white shadow-sm print:rounded-none print:border-0 print:shadow-none">
            {/* Header */}
            <div className="flex items-center justify-between px-10 py-6 print:px-8" style={{ backgroundColor: NAVY }}>
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
            <div className="h-1" style={{ background: `linear-gradient(90deg, ${GOLD}, #f0d9ad)` }} />

            {/* Body */}
            <div className="px-10 py-7 print:px-8">
              <h2 className="text-lg font-bold" style={{ color: NAVY }}>Comparativo de Planes</h2>
              <p className="mb-3 text-xs text-muted-foreground">
                {SUBTITLES[tab]} · Los {selectedPlans.length} planes que mejor se ajustan a tu perfil
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
                    {selectedPlans.map((p, i) => {
                      const isRec = recommended[tab] === p.id
                      return (
                      <th
                        key={p.id}
                        className={cn('px-3 py-2.5 text-left text-white', i === selectedPlans.length - 1 && 'rounded-tr-lg')}
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
                    <tr key={r.label} className={ri % 2 === 1 ? 'bg-[#f8f9fc]' : ''}>
                      <td
                        className="px-3 py-2 align-top font-semibold"
                        style={{ color: NAVY, borderBottom: '1px solid #c7d0e8' }}
                      >
                        {r.label}
                      </td>
                      {selectedPlans.map((p, vi) => (
                        <td
                          key={vi}
                          className="px-3 py-2 align-top text-[#333]"
                          style={{
                            borderBottom: '1px solid #c7d0e8',
                            backgroundColor: recommended[tab] === p.id ? 'rgba(219,170,89,.10)' : undefined,
                          }}
                        >
                          {r.values[vi] ?? '—'}
                        </td>
                      ))}
                    </tr>
                  ))}
                  <tr style={{ backgroundColor: '#fdf8ef' }}>
                    <td className="px-3 py-3 font-bold" style={{ color: NAVY, borderTop: `2px solid ${GOLD}` }}>
                      {PRIMA_LABEL[tab].toUpperCase()}
                    </td>
                    {selectedPlans.map((p) => (
                      <td
                        key={p.id}
                        className="px-3 py-3"
                        style={{
                          borderTop: `2px solid ${GOLD}`,
                          backgroundColor: recommended[tab] === p.id ? 'rgba(219,170,89,.22)' : undefined,
                        }}
                      >
                        <span className="text-[15px] font-bold" style={{ color: NAVY }}>
                          {primas[p.id] ? `$${primas[p.id]}` : '—'}
                        </span>
                        {primas[p.id] && <span className="ml-1 text-[9px] text-muted-foreground">/mes</span>}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>

              <div className="mt-6 flex justify-between border-t pt-3 text-[9.5px] text-muted-foreground">
                <span>Priority Asesores de Seguros · info@priority.ec · WhatsApp 099 591 5761</span>
                <span>Información detallada de coberturas y beneficios en la ilustración adjunta de cada plan</span>
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
