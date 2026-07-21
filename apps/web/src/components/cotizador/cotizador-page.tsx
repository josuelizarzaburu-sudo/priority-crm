'use client'

import { useMemo, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  cotizarSigma,
  SIGMA_DEDUCIBLE_LABEL,
  type SigmaRegion,
} from '@/lib/sigma-tarifas'

const NAVY = '#0C2057'
const GOLD = '#DBAA59'

const REGIONES: SigmaRegion[] = ['Sierra', 'Costa', 'Austro']

interface Miembro {
  id: string
  parentesco: string
  edad: string
}

let nextId = 1
const nuevoMiembro = (parentesco: string): Miembro => ({
  id: `m${nextId++}`,
  parentesco,
  edad: '',
})

const money = (n: number) =>
  n.toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export function CotizadorPage() {
  const [region, setRegion] = useState<SigmaRegion>('Sierra')
  const [conMaternidad, setConMaternidad] = useState(true)
  const [miembros, setMiembros] = useState<Miembro[]>([nuevoMiembro('Titular')])

  const addMiembro = (parentesco: string) =>
    setMiembros((prev) => [...prev, nuevoMiembro(parentesco)])
  const updateEdad = (id: string, edad: string) =>
    setMiembros((prev) => prev.map((m) => (m.id === id ? { ...m, edad } : m)))
  const removeMiembro = (id: string) =>
    setMiembros((prev) => prev.filter((m) => m.id !== id))

  // Personas con edad válida
  const personas = useMemo(
    () =>
      miembros
        .map((m) => ({ edad: parseInt(m.edad, 10) }))
        .filter((p) => Number.isFinite(p.edad) && p.edad >= 0 && p.edad <= 105),
    [miembros],
  )

  const resultados = useMemo(() => {
    if (personas.length === 0) return []
    return cotizarSigma(region, personas, conMaternidad)
  }, [region, personas, conMaternidad])

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: NAVY }}>
          Cotizador BMI Sigma
        </h1>
        <p className="text-sm text-muted-foreground">
          Herramienta interna de validación · Plan Nacional Sigma (modalidad abierta)
        </p>
      </div>

      {/* ── Datos del cliente ─────────────────────────────────── */}
      <div className="rounded-xl border bg-card p-4">
        <h2 className="mb-3 text-sm font-bold" style={{ color: NAVY }}>
          Datos del cliente
        </h2>

        {/* Región */}
        <div className="mb-4">
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Región</label>
          <div className="flex flex-wrap gap-2">
            {REGIONES.map((r) => {
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

        {/* Maternidad */}
        <div className="mb-4">
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
            Beneficio de maternidad
          </label>
          <div className="flex flex-wrap gap-2">
            {[
              { v: true, l: 'Con maternidad' },
              { v: false, l: 'Sin maternidad' },
            ].map((o) => {
              const active = conMaternidad === o.v
              return (
                <button
                  key={o.l}
                  type="button"
                  onClick={() => setConMaternidad(o.v)}
                  className="rounded-full border px-4 py-1.5 text-sm font-medium transition-colors"
                  style={{
                    borderColor: GOLD,
                    backgroundColor: active ? GOLD : '#fff',
                    color: active ? '#fff' : NAVY,
                  }}
                >
                  {o.l}
                </button>
              )
            })}
          </div>
        </div>

        {/* Miembros */}
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
            Integrantes (edad cumplida)
          </label>
          <div className="space-y-2">
            {miembros.map((m) => (
              <div key={m.id} className="flex items-center gap-2">
                <span className="w-28 shrink-0 text-sm" style={{ color: NAVY }}>
                  {m.parentesco}
                </span>
                <Input
                  type="number"
                  min={0}
                  max={105}
                  placeholder="Edad"
                  value={m.edad}
                  onChange={(e) => updateEdad(m.id, e.target.value)}
                  className="h-9 w-24"
                />
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
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => addMiembro('Hijo/a')}
            >
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

      {/* ── Resultados ─────────────────────────────────── */}
      {resultados.length > 0 ? (
        <div className="rounded-xl border bg-card p-4">
          <h2 className="mb-1 text-sm font-bold" style={{ color: NAVY }}>
            Cotización · {region} · {conMaternidad ? 'Con maternidad' : 'Sin maternidad'}
          </h2>
          <p className="mb-3 text-xs text-muted-foreground">
            {personas.length} {personas.length === 1 ? 'persona' : 'personas'} · Precios en USD
          </p>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr style={{ backgroundColor: NAVY, color: '#fff' }}>
                  <th className="px-3 py-2 text-left font-semibold">Deducible</th>
                  <th className="px-3 py-2 text-right font-semibold">Mensual</th>
                  <th className="px-3 py-2 text-right font-semibold">Anual</th>
                  <th className="px-3 py-2 text-right font-semibold">Contado −9%</th>
                  <th className="px-3 py-2 text-right font-semibold">Diferido −5%</th>
                </tr>
              </thead>
              <tbody>
                {resultados.map((r, i) => (
                  <tr
                    key={r.deducible}
                    style={i % 2 === 1 ? { backgroundColor: '#f8f9fc' } : undefined}
                  >
                    <td className="px-3 py-2 font-medium" style={{ color: NAVY }}>
                      {SIGMA_DEDUCIBLE_LABEL[r.deducible]}
                    </td>
                    <td className="px-3 py-2 text-right font-bold" style={{ color: NAVY }}>
                      ${money(r.mensualNormal)}
                    </td>
                    <td className="px-3 py-2 text-right text-[#333]">${money(r.anualNormal)}</td>
                    <td className="px-3 py-2 text-right text-[#333]">${money(r.anualContado)}</td>
                    <td className="px-3 py-2 text-right text-[#333]">${money(r.anualDiferido)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="mt-3 text-[11px] text-muted-foreground">
            Valores calculados según el tarifario oficial BMI 2026. Incluye tarjeta (USD 50),
            gasto administrativo (USD 30) e impuesto (0,5%).
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed bg-muted/30 p-8 text-center text-sm text-muted-foreground">
          Ingresa al menos la edad del titular para ver la cotización.
        </div>
      )}
    </div>
  )
}
