'use client'

import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'

const NAVY = '#0C2057'

const VERDE = '#5FD38B'
const AMBAR = '#F0A52E'
const ROJO = '#E56B6B'

interface FilaEficiencia {
  id: string
  nombre: string
  total: number
  gestionados: number
  sinGestion: number
  enPlazo: number
  porcentajeGestion: number | null
  horasPromedio: number | null
}

/**
 * Comparativa de gestion entre vendedores.
 *
 * "Sin gestion" es un lead asignado al que no se le hizo nada dentro del plazo,
 * contado en horas laborables. La idea es poder sentarse con el vendedor con un
 * dato concreto, no con una impresion.
 */
export function EficienciaVendedores() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['pipeline', 'eficiencia'],
    queryFn: async () => (await api.get('/pipeline/eficiencia')).data as FilaEficiencia[],
  })

  const filas = data ?? []

  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-bold" style={{ color: NAVY }}>
          Eficiencia de gestión
        </h3>
        <div className="flex flex-wrap gap-3 text-[11px] text-muted-foreground">
          <Leyenda color={VERDE} texto="Gestionado a tiempo" />
          <Leyenda color={AMBAR} texto="Aún en plazo" />
          <Leyenda color={ROJO} texto="Sin gestión" />
        </div>
      </div>
      <p className="mb-3 text-xs text-muted-foreground">
        Leads atendidos dentro de las 24 horas laborables desde que se asignaron.
      </p>

      {isLoading ? (
        <p className="py-8 text-center text-xs text-muted-foreground">Cargando…</p>
      ) : isError ? (
        <p className="py-8 text-center text-xs text-muted-foreground">
          No se pudo cargar la eficiencia.
        </p>
      ) : filas.length === 0 ? (
        <p className="py-8 text-center text-xs text-muted-foreground">
          Todavía no hay leads asignados.
        </p>
      ) : (
        <div className="space-y-3">
          {filas.map((f) => {
            const seg = (n: number) => (f.total > 0 ? (n / f.total) * 100 : 0)
            return (
              <div key={f.id}>
                <div className="mb-1 flex items-baseline justify-between gap-2">
                  <span className="truncate text-sm font-medium" style={{ color: NAVY }}>
                    {f.nombre}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {f.porcentajeGestion !== null ? (
                      <span
                        className="font-bold"
                        style={{
                          color:
                            f.porcentajeGestion >= 80
                              ? '#2E9E63'
                              : f.porcentajeGestion >= 50
                                ? '#B87A15'
                                : '#C24444',
                        }}
                      >
                        {f.porcentajeGestion}%
                      </span>
                    ) : (
                      <span className="italic">sin datos aún</span>
                    )}
                    {f.horasPromedio !== null && (
                      <span> · responde en {f.horasPromedio} h</span>
                    )}
                  </span>
                </div>

                {/* Barra horizontal: de un vistazo se comparan los vendedores */}
                <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted">
                  <Segmento ancho={seg(f.gestionados)} color={VERDE} titulo={`${f.gestionados} gestionados a tiempo`} />
                  <Segmento ancho={seg(f.enPlazo)} color={AMBAR} titulo={`${f.enPlazo} aún en plazo`} />
                  <Segmento ancho={seg(f.sinGestion)} color={ROJO} titulo={`${f.sinGestion} sin gestión`} />
                </div>

                <div className="mt-1 flex flex-wrap gap-x-3 text-[11px] text-muted-foreground">
                  <span>{f.total} leads</span>
                  <span style={{ color: '#2E9E63' }}>{f.gestionados} a tiempo</span>
                  {f.enPlazo > 0 && <span style={{ color: '#B87A15' }}>{f.enPlazo} en plazo</span>}
                  {f.sinGestion > 0 && (
                    <span style={{ color: '#C24444' }}>{f.sinGestion} sin gestión</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <p className="mt-3 text-[11px] text-muted-foreground">
        El porcentaje se calcula solo sobre los leads cuyo plazo ya venció, para no
        castigar a quien acaba de recibirlos. El reloj se pausa fuera del horario
        laboral y los domingos.
      </p>
    </div>
  )
}

function Segmento({ ancho, color, titulo }: { ancho: number; color: string; titulo: string }) {
  if (ancho <= 0) return null
  return <div style={{ width: `${ancho}%`, backgroundColor: color }} title={titulo} />
}

function Leyenda({ color, texto }: { color: string; texto: string }) {
  return (
    <span className="flex items-center gap-1">
      <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
      {texto}
    </span>
  )
}
