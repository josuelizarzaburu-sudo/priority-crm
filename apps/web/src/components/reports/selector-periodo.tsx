'use client'

import { useMemo, useState } from 'react'
import { Input } from '@/components/ui/input'

/**
 * Selector de período compartido por los reportes.
 *
 * Cubre lo que pidió Josue: mes a mes, históricos de 3, 6 y 12 meses, y un rango
 * personalizado. Vive aparte porque los tres reportes lo usan igual, y tenerlo
 * repetido garantizaría que se desincronicen.
 */
export interface Periodo {
  desde: string
  hasta: string
  etiqueta: string
}

/** Hoy en Ecuador como YYYY-MM-DD. */
function hoyISO(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Guayaquil',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

function mesesAtras(n: number): Periodo {
  const hoy = new Date()
  const desde = new Date(hoy.getFullYear(), hoy.getMonth() - n + 1, 1)
  return {
    desde: `${desde.getFullYear()}-${String(desde.getMonth() + 1).padStart(2, '0')}-01`,
    hasta: hoyISO(),
    etiqueta: `Últimos ${n} meses`,
  }
}

function mesConcreto(mes: string): Periodo {
  const [a, m] = mes.split('-').map(Number)
  const ultimo = new Date(a, m, 0).getDate()
  const etiqueta = new Date(a, m - 1, 1).toLocaleDateString('es-EC', {
    month: 'long',
    year: 'numeric',
  })
  return {
    desde: `${mes}-01`,
    hasta: `${mes}-${String(ultimo).padStart(2, '0')}`,
    etiqueta: etiqueta.charAt(0).toUpperCase() + etiqueta.slice(1),
  }
}

export function useMeses() {
  return useMemo(() => {
    const hoy = new Date()
    return Array.from({ length: 12 }, (_, i) => {
      const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1)
      const valor = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const e = d.toLocaleDateString('es-EC', { month: 'long', year: 'numeric' })
      return { valor, etiqueta: e.charAt(0).toUpperCase() + e.slice(1) }
    })
  }, [])
}

export function SelectorPeriodo({
  valor,
  onCambio,
}: {
  valor: Periodo
  onCambio: (p: Periodo) => void
}) {
  const meses = useMeses()
  const [modo, setModo] = useState<'mes' | 'historico' | 'rango'>('mes')
  const [mes, setMes] = useState(meses[0].valor)
  const [rango, setRango] = useState({ desde: valor.desde, hasta: valor.hasta })

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div>
        <label className="mb-1 block text-xs text-muted-foreground">Período</label>
        <select
          value={modo}
          onChange={(e) => {
            const m = e.target.value as typeof modo
            setModo(m)
            // Al cambiar de modo se aplica de una vez un valor razonable, en vez
            // de dejar el reporte mostrando el período anterior hasta que se
            // elija algo más.
            if (m === 'mes') onCambio(mesConcreto(mes))
            else if (m === 'historico') onCambio(mesesAtras(3))
          }}
          className="h-10 rounded-md border bg-background px-3 text-sm"
        >
          <option value="mes">Mes específico</option>
          <option value="historico">Histórico</option>
          <option value="rango">Rango personalizado</option>
        </select>
      </div>

      {modo === 'mes' && (
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Mes</label>
          <select
            value={mes}
            onChange={(e) => {
              setMes(e.target.value)
              onCambio(mesConcreto(e.target.value))
            }}
            className="h-10 rounded-md border bg-background px-3 text-sm"
          >
            {meses.map((m) => (
              <option key={m.valor} value={m.valor}>
                {m.etiqueta}
              </option>
            ))}
          </select>
        </div>
      )}

      {modo === 'historico' && (
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Rango</label>
          <select
            defaultValue="3"
            onChange={(e) => {
              const v = e.target.value
              // "Todo" arranca en 2020: es anterior a cualquier dato del CRM, asi
              // que trae el historico completo sin tener que consultar cual es el
              // registro mas antiguo.
              if (v === 'todo') {
                onCambio({ desde: '2020-01-01', hasta: hoyISO(), etiqueta: 'Todo el histórico' })
              } else {
                onCambio(mesesAtras(Number(v)))
              }
            }}
            className="h-10 rounded-md border bg-background px-3 text-sm"
          >
            <option value="3">Últimos 3 meses</option>
            <option value="6">Últimos 6 meses</option>
            <option value="12">Último año</option>
            <option value="todo">Todo el histórico</option>
          </select>
        </div>
      )}

      {modo === 'rango' && (
        <>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Desde</label>
            <Input
              type="date"
              value={rango.desde}
              max={rango.hasta}
              onChange={(e) => {
                const r = { ...rango, desde: e.target.value }
                setRango(r)
                onCambio({ ...r, etiqueta: `${r.desde} al ${r.hasta}` })
              }}
              className="h-10 w-[160px] text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Hasta</label>
            <Input
              type="date"
              value={rango.hasta}
              min={rango.desde}
              onChange={(e) => {
                const r = { ...rango, hasta: e.target.value }
                setRango(r)
                onCambio({ ...r, etiqueta: `${r.desde} al ${r.hasta}` })
              }}
              className="h-10 w-[160px] text-sm"
            />
          </div>
        </>
      )}
    </div>
  )
}

export { mesConcreto, mesesAtras, hoyISO }
