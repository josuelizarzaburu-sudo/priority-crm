'use client'

import { useMemo, useState } from 'react'
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

const NAVY = '#0C2057'
const GOLD = '#DBAA59'

interface Miembro {
  id: string
  parentesco: string
  edad: string
  sexo: Sexo
}

let nextId = 1
const nuevoMiembro = (parentesco: string, sexo: Sexo = 'M'): Miembro => ({
  id: `m${nextId++}`,
  parentesco,
  edad: '',
  sexo,
})

const money = (n: number) =>
  n.toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const PLAN_ORDER: BmiPlanId[] = ['sigma', 'innova', 'gmm']

export function CotizadorPage() {
  const [region, setRegion] = useState<BmiRegion>('Sierra')
  const [miembros, setMiembros] = useState<Miembro[]>([nuevoMiembro('Titular')])

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
        .map((m) => ({ edad: parseInt(m.edad, 10), sexo: m.sexo }))
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

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: NAVY }}>
          Cotizador
        </h1>
        <p className="text-sm text-muted-foreground">
          Herramienta interna · BMI (Sigma · Innova · GMM) y Humana · Salud individual/familiar
        </p>
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
                {/* Sexo (para Humana) */}
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
                            </tr>
                          ))}
                        </tbody>
                      </table>
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
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr style={{ backgroundColor: NAVY, color: '#fff' }}>
                      <th className="px-3 py-2 text-left font-semibold">Plan</th>
                      <th className="px-3 py-2 text-right font-semibold">Sin descuento</th>
                      <th className="px-3 py-2 text-right font-semibold">Descuento</th>
                      <th className="px-3 py-2 text-right font-semibold">Mensual final</th>
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
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-3 text-[11px] text-muted-foreground">
                Descuento por Nº de personas ({personas.length}). Incluye seguro campesino (0,5%).
                Planes generales (adultos).
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
