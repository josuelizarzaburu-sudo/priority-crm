'use client'

import { useState } from 'react'
import * as XLSX from 'xlsx'
import { Download, FileSpreadsheet, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { api } from '@/lib/api'

const NAVY = '#0C2057'
const GOLD = '#DBAA59'

type ReporteId = 'reclamos' | 'clientes' | 'produccion'

const hoy = () => new Date().toISOString().slice(0, 10)

/**
 * Trae TODAS las páginas de un endpoint paginado.
 *
 * Los listados topan en 100 por página, así que para un reporte hay que ir
 * pidiendo hasta que se acaben. Se usan los mismos endpoints que la pantalla
 * normal a propósito: así el reporte respeta solo los permisos del servidor
 * (una ejecutiva exporta lo suyo, el jefe exporta todo) sin duplicar reglas.
 */
async function traerTodo(
  url: string,
  params: Record<string, string | number>,
  onProgreso?: (n: number) => void,
): Promise<any[]> {
  const filas: any[] = []
  let page = 1
  // Tope de seguridad: 100 páginas = 10.000 registros. Evita un bucle infinito
  // si el backend devolviera siempre la misma página.
  for (let i = 0; i < 100; i++) {
    const r = await api.get(url, { params: { ...params, page, limit: 100 } })
    const lote: any[] = r.data?.data ?? []
    filas.push(...lote)
    onProgreso?.(filas.length)
    const totalPages = r.data?.totalPages ?? 1
    if (page >= totalPages || lote.length === 0) break
    page++
  }
  return filas
}

const fecha = (v: string | null) => (v ? String(v).slice(0, 10) : '')
const num = (v: string | number | null) => (v == null || v === '' ? '' : Number(v))

export function ReportesOperacionesPage() {
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [generando, setGenerando] = useState<ReporteId | null>(null)
  const [progreso, setProgreso] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const descargar = (filas: any[], hoja: string, archivo: string) => {
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(filas), hoja)
    XLSX.writeFile(wb, `${archivo}-${hoy()}.xlsx`)
  }

  const generar = async (id: ReporteId) => {
    setGenerando(id)
    setProgreso(0)
    setError(null)
    try {
      if (id === 'reclamos') {
        // OJO: el backend valida con forbidNonWhitelisted, así que mandarle
        // parámetros que no declara (desde/hasta) devuelve 400. El rango se
        // aplica acá sobre la fecha de recepción.
        const datos = await traerTodo('/reclamos', {}, setProgreso)
        const enRango = datos.filter((r) => {
          const f = fecha(r.fechaRecepcion)
          if (!f) return !desde && !hasta // sin fecha solo entra si no hay filtro
          if (desde && f < desde) return false
          if (hasta && f > hasta) return false
          return true
        })
        const filas = enRango.map((r) => ({
          Cliente: r.clienteNombre ?? '',
          Paciente: r.pacienteNombre ?? '',
          Aseguradora: r.aseguradora ?? '',
          Contrato: r.contrato ?? '',
          Liquidación: r.liquidacion ?? '',
          Diagnóstico: r.diagnostico ?? '',
          Estado: r.estado ?? '',
          Valor: num(r.valor),
          'Fecha recepción': fecha(r.fechaRecepcion),
          'Fecha envío aseguradora': fecha(r.fechaEnvioAseguradora),
          'Fecha liquidación': fecha(r.fechaLiquidacion),
          'Fecha envío cliente': fecha(r.fechaEnvioCliente),
          'Días liquidación': r.diasLiquidacion ?? '',
          'Días envío cliente': r.diasEnvioCliente ?? '',
          Ejecutiva: r.ejecutivo?.name ?? r.ejecutivoNombre ?? '',
          Medio: r.medioComunicacion ?? '',
          Observaciones: r.observaciones ?? '',
        }))
        if (filas.length === 0) throw new Error('No hay reclamos en ese rango de fechas.')
        // Fila de totales al final: suma del valor y conteo, para no tener que
        // sumar a mano en Excel.
        const totalValor = enRango.reduce((s, r) => s + (Number(r.valor) || 0), 0)
        filas.push({} as any)
        filas.push({
          Cliente: `TOTAL (${enRango.length} reclamos)`,
          Valor: Math.round(totalValor * 100) / 100,
        } as any)
        descargar(filas, 'Reclamos', 'reclamos')
        return
      }

      // Clientes y Producción salen del mismo listado, cambia cómo se agrupa.
      const datos = await traerTodo('/clientes', {}, setProgreso)
      if (datos.length === 0) throw new Error('No hay clientes para exportar.')

      if (id === 'clientes') {
        const filas = datos.map((c) => ({
          Nombres: c.nombres ?? '',
          Apellidos: c.apellidos ?? '',
          Identificación: c.identificacion ?? '',
          Celular: c.celular ?? '',
          Teléfono: c.telefono ?? '',
          Email: c.email ?? '',
          Ejecutiva: c.ejecutivo?.name ?? c.ejecutivoNombre ?? 'Sin asignar',
          Pólizas: c._count?.polizas ?? 0,
          'Prima total': Number(c.primaTotal) || 0,
          'Por revisar': c.revisar ? 'Sí' : 'No',
        }))
        filas.push({} as any)
        filas.push({
          Nombres: `TOTAL (${datos.length} clientes)`,
          Pólizas: datos.reduce((s, c) => s + (c._count?.polizas ?? 0), 0),
          'Prima total':
            Math.round(datos.reduce((s, c) => s + (Number(c.primaTotal) || 0), 0) * 100) / 100,
        } as any)
        descargar(filas, 'Clientes', 'clientes-y-polizas')
        return
      }

      // Producción por ejecutiva: cuántos clientes y pólizas lleva cada una.
      const porEjecutiva = new Map<string, { clientes: number; polizas: number; revisar: number; prima: number }>()
      for (const c of datos) {
        const nombre = c.ejecutivo?.name ?? c.ejecutivoNombre ?? 'Sin asignar'
        const acc = porEjecutiva.get(nombre) ?? { clientes: 0, polizas: 0, revisar: 0, prima: 0 }
        acc.clientes += 1
        acc.polizas += c._count?.polizas ?? 0
        acc.prima += Number(c.primaTotal) || 0
        if (c.revisar) acc.revisar += 1
        porEjecutiva.set(nombre, acc)
      }
      const filas = [...porEjecutiva.entries()]
        .map(([Ejecutiva, v]) => ({
          Ejecutiva,
          Clientes: v.clientes,
          Pólizas: v.polizas,
          'Prima total': Math.round(v.prima * 100) / 100,
          'Pólizas por cliente': v.clientes ? +(v.polizas / v.clientes).toFixed(2) : 0,
          'Fichas por revisar': v.revisar,
        }))
        .sort((a, b) => b['Prima total'] - a['Prima total'])
      const totClientes = filas.reduce((s, f) => s + f.Clientes, 0)
      const totPolizas = filas.reduce((s, f) => s + f.Pólizas, 0)
      filas.push({} as any)
      filas.push({
        Ejecutiva: 'TOTAL',
        Clientes: totClientes,
        Pólizas: totPolizas,
        'Prima total':
          Math.round(filas.reduce((s, f) => s + (f['Prima total'] || 0), 0) * 100) / 100,
        'Pólizas por cliente': totClientes ? +(totPolizas / totClientes).toFixed(2) : 0,
        'Fichas por revisar': filas.reduce((s, f) => s + (f['Fichas por revisar'] || 0), 0),
      } as any)
      descargar(filas, 'Producción', 'produccion-por-ejecutiva')
    } catch (e: any) {
      setError(e?.message ?? 'No se pudo generar el reporte.')
    } finally {
      setGenerando(null)
      setProgreso(0)
    }
  }

  const REPORTES: { id: ReporteId; titulo: string; detalle: string; fechas: boolean }[] = [
    {
      id: 'reclamos',
      titulo: 'Reclamos',
      detalle:
        'Un reclamo por fila, con estado, valor, número de liquidación, fechas y días de trámite.',
      fechas: true,
    },
    {
      id: 'clientes',
      titulo: 'Clientes y pólizas',
      detalle:
        'Base de clientes con contacto, ejecutiva asignada y cuántas pólizas tiene cada uno.',
      fechas: false,
    },
    {
      id: 'produccion',
      titulo: 'Producción por ejecutiva',
      detalle:
        'Resumen por ejecutiva: clientes, pólizas, promedio de pólizas por cliente y fichas por revisar.',
      fechas: false,
    },
  ]

  return (
    <div className="space-y-5">
      {/* Rango de fechas: por ahora solo lo usa el reporte de reclamos */}
      <div className="rounded-xl border bg-card p-4">
        <h2 className="mb-3 text-sm font-bold" style={{ color: NAVY }}>
          Rango de fechas
        </h2>
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Desde</Label>
            <Input
              type="date"
              value={desde}
              onChange={(e) => setDesde(e.target.value)}
              className="w-40"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Hasta</Label>
            <Input
              type="date"
              value={hasta}
              onChange={(e) => setHasta(e.target.value)}
              className="w-40"
            />
          </div>
          {(desde || hasta) && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setDesde('')
                setHasta('')
              }}
            >
              Limpiar
            </Button>
          )}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Si lo dejas vacío se exporta todo. Solo aplica al reporte de reclamos.
        </p>
      </div>

      {error && (
        <p className="rounded-md bg-red-50 p-3 text-sm text-red-600">{error}</p>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        {REPORTES.map((r) => {
          const ocupado = generando === r.id
          return (
            <div key={r.id} className="flex flex-col rounded-xl border bg-card p-4">
              <FileSpreadsheet className="mb-2 h-6 w-6" style={{ color: GOLD }} />
              <h3 className="text-sm font-bold" style={{ color: NAVY }}>
                {r.titulo}
              </h3>
              <p className="mt-1 flex-1 text-xs text-muted-foreground">{r.detalle}</p>
              <Button
                type="button"
                size="sm"
                className="mt-3 w-full"
                disabled={generando !== null}
                onClick={() => generar(r.id)}
                style={{ backgroundColor: GOLD, color: '#fff' }}
              >
                {ocupado ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {progreso > 0 ? `${progreso} registros…` : 'Generando…'}
                  </>
                ) : (
                  <>
                    <Download className="mr-2 h-4 w-4" />
                    Exportar a Excel
                  </>
                )}
              </Button>
            </div>
          )
        })}
      </div>

      <p className="text-xs text-muted-foreground">
        Cada reporte respeta tus permisos: una ejecutiva exporta solo sus clientes y
        reclamos; el jefe de operaciones y el administrador exportan todo.
      </p>
    </div>
  )
}
