'use client'

import { useState } from 'react'
import { ReporteVentas } from './reporte-ventas'
import { ReporteEmbudo, ReporteTiempos } from './reporte-embudo'
import { ReportsPage } from './reports-page'
import { BarChart3, Clock, Filter, TrendingUp } from 'lucide-react'

const NAVY = '#0C2057'

/**
 * Contenedor de los reportes.
 *
 * Con pestañas desde el principio porque vienen dos reportes más —embudo por
 * etapa y tiempo de cierre— y meterlos todos en una pantalla los volvería
 * ilegibles. Cada uno responde una pregunta distinta.
 */
const PESTANAS = [
  { id: 'ventas', label: 'Ventas ganadas', icono: TrendingUp },
  { id: 'embudo', label: 'Embudo', icono: Filter },
  { id: 'tiempos', label: 'Tiempo de cierre', icono: Clock },
  { id: 'general', label: 'Panel general', icono: BarChart3 },
] as const

export function ReportesHub() {
  const [activa, setActiva] = useState<(typeof PESTANAS)[number]['id']>('ventas')

  return (
    <div className="w-full space-y-4 p-1 xl:p-4">
      <div>
        <h1 className="text-2xl font-bold md:text-3xl" style={{ color: NAVY }}>
          Reportes
        </h1>
        <p className="text-sm text-muted-foreground">
          Ventas cerradas, primas y desempeño del equipo
        </p>
      </div>

      <div className="flex gap-1 border-b">
        {PESTANAS.map((p) => {
          const Icono = p.icono
          const on = activa === p.id
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => setActiva(p.id)}
              className="flex items-center gap-1.5 border-b-2 px-3.5 py-2.5 text-sm transition-colors"
              style={{
                borderColor: on ? NAVY : 'transparent',
                color: on ? NAVY : '#64748b',
                fontWeight: on ? 600 : 400,
              }}
            >
              <Icono className="h-4 w-4" />
              {p.label}
            </button>
          )
        })}
      </div>

      {activa === 'ventas' && <ReporteVentas />}
      {activa === 'embudo' && <ReporteEmbudo />}
      {activa === 'tiempos' && <ReporteTiempos />}
      {activa === 'general' && <ReportsPage />}
    </div>
  )
}
