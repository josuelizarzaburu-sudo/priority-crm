'use client'

import { useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import * as XLSX from 'xlsx'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { AlertTriangle, Check, FileSpreadsheet, Trash2, Upload } from 'lucide-react'

const NAVY = '#0C2057'
const VERDE = '#15803d'

/**
 * Columnas del Excel de operaciones.
 *
 * Se comparan sin tildes ni espacios de más, porque la misma columna aparece
 * escrita distinto entre archivos: "CEDULA" y "CÉDULA", o con un espacio al
 * final que no se ve.
 */
const COLUMNAS: Record<string, string> = {
  COMPANIA: 'compania',
  'N DE CONTRATO': 'numeroContrato',
  'TIPO DE SEGURO': 'tipoSeguro',
  'NOMBRE Y APELLIDO DEL TITULAR': 'nombreCompleto',
  'TIPO DE CLIENTE (INDIVIDUAL - CORPORATIVO)': 'tipoCliente',
  'NOMBRE PREFERIDO': 'nombrePreferido',
  'TITULAR - DEPENDIENTE': 'rol',
  'PERSONA DE CONTACTO': 'personaContacto',
  ESTADO: 'estado',
  EMPRESA: 'empresa',
  'REFERIDO DE': 'referidoDe',
  AGENTE: 'agente',
  EJECUTIVA: 'ejecutiva',
  CEDULA: 'cedula',
  'FECHA DE NACIMIENTO (DD-MM-AA)': 'fechaNacimiento',
  GENERO: 'genero',
  'FECHA DE EMISION': 'fechaEmision',
  'PRIMA ANUAL': 'primaAnual',
  PLAN: 'plan',
  DEDUCIBLE: 'deducible',
  CIUDAD: 'ciudad',
  DIRECCION: 'direccion',
  TELEFONO: 'telefono',
  CELULAR: 'celular',
  'CORREO ELECTRONICO': 'correo',
  'FORMA DE PAGO': 'formaPago',
  'FRECUENCIA DE PAGO': 'frecuenciaPago',
  'ORIGEN - AGENTE PROPIO - PRIORITY - PRIORITY HEALTH': 'origen',
}

const normalizar = (s: string) =>
  String(s ?? '')
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')

/**
 * Cuántas filas se mandan por petición.
 *
 * 1.500 en una sola llamada rebotarían: el servidor limita el tamaño de la
 * petición, y ya nos pasó con los adjuntos de los correos. Además, en lotes se
 * puede mostrar el avance y un fallo a la mitad no tira todo el trabajo.
 */
const TAMANO_LOTE = 150

interface Resultado {
  resumen: {
    filas: number
    contratos: number
    clientes: number
    dependientes: number
    polizas: number
    yaExistian: number
    polizasSumadas: number
    fallidos: number
    sinCedula: number
    cedulaInvalida: number
    agentesSinUsuario: string[]
    ejecutivasSinUsuario: string[]
  }
  avisos: { fila: number; nivel: 'error' | 'aviso'; texto: string }[]
  detalle: any[]
}

export function ImportarClientes() {
  const qc = useQueryClient()
  const archivoRef = useRef<HTMLInputElement>(null)

  const [filas, setFilas] = useState<any[] | null>(null)
  const [nombreArchivo, setNombreArchivo] = useState('')
  const [previa, setPrevia] = useState<Resultado | null>(null)
  const [importado, setImportado] = useState<Resultado['resumen'] | null>(null)
  const [progreso, setProgreso] = useState<{ hechas: number; total: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(false)

  const [confirmacionBorrado, setConfirmacionBorrado] = useState('')
  const [borrando, setBorrando] = useState(false)
  const [resultadoBorrado, setResultadoBorrado] = useState<any>(null)

  async function leerArchivo(f: File) {
    setError(null)
    setPrevia(null)
    setImportado(null)
    try {
      const buffer = await f.arrayBuffer()
      const wb = XLSX.read(buffer, { cellDates: true })
      const hoja = wb.Sheets[wb.SheetNames[0]]
      const crudas = XLSX.utils.sheet_to_json<Record<string, unknown>>(hoja, { defval: '' })

      // Se mapean las columnas por nombre normalizado: un espacio al final o una
      // tilde de más no deberían impedir reconocer la columna.
      const mapa = new Map(Object.entries(COLUMNAS).map(([k, v]) => [normalizar(k), v]))
      const mapeadas = crudas.map((fila) => {
        const r: Record<string, unknown> = {}
        for (const [col, valor] of Object.entries(fila)) {
          const campo = mapa.get(normalizar(col))
          if (campo) r[campo] = valor instanceof Date ? valor.toISOString() : valor
        }
        return r
      })

      const noReconocidas = Object.keys(crudas[0] ?? {}).filter(
        (c) => !mapa.has(normalizar(c)) && normalizar(c),
      )

      setFilas(mapeadas)
      setNombreArchivo(f.name)
      if (noReconocidas.length) {
        setError(
          `Estas columnas no se reconocieron y se ignorarán: ${noReconocidas.join(', ')}`,
        )
      }
    } catch (e: any) {
      setError(`No se pudo leer el archivo: ${e?.message ?? 'formato no válido'}`)
    }
  }

  /** Une los resultados de varios lotes en uno solo. */
  function unir(partes: Resultado[]): Resultado {
    const base: Resultado = {
      resumen: {
        filas: 0, contratos: 0, clientes: 0, dependientes: 0, polizas: 0,
        yaExistian: 0, polizasSumadas: 0, fallidos: 0, sinCedula: 0, cedulaInvalida: 0,
        agentesSinUsuario: [], ejecutivasSinUsuario: [],
      },
      avisos: [],
      detalle: [],
    }
    const agentes = new Set<string>()
    const ejecutivas = new Set<string>()
    for (const p of partes) {
      for (const k of Object.keys(base.resumen) as (keyof Resultado['resumen'])[]) {
        if (typeof base.resumen[k] === 'number') {
          ;(base.resumen[k] as number) += (p.resumen[k] as number) ?? 0
        }
      }
      p.resumen.agentesSinUsuario?.forEach((a) => agentes.add(a))
      p.resumen.ejecutivasSinUsuario?.forEach((a) => ejecutivas.add(a))
      base.avisos.push(...p.avisos)
      base.detalle.push(...p.detalle)
    }
    base.resumen.agentesSinUsuario = [...agentes]
    base.resumen.ejecutivasSinUsuario = [...ejecutivas]
    return base
  }

  /**
   * Manda el archivo por lotes.
   *
   * Los lotes se parten por CONTRATO, no por fila: si un contrato quedara
   * partido entre dos peticiones, el titular iría en una y sus dependientes en
   * otra, y se cargarían como dos clientes distintos.
   */
  async function enviar(ruta: string) {
    if (!filas?.length) return
    setCargando(true)
    setError(null)
    setProgreso({ hechas: 0, total: filas.length })

    try {
      const lotes: any[][] = []
      let actual: any[] = []
      let contratoActual: string | null = null

      for (const f of filas) {
        const contrato = String(f.numeroContrato ?? '')
        // Solo se corta el lote entre contratos distintos.
        if (actual.length >= TAMANO_LOTE && contrato !== contratoActual) {
          lotes.push(actual)
          actual = []
        }
        actual.push(f)
        contratoActual = contrato
      }
      if (actual.length) lotes.push(actual)

      const partes: Resultado[] = []
      let hechas = 0
      for (const lote of lotes) {
        const { data } = await api.post(ruta, { filas: lote })
        partes.push(data)
        hechas += lote.length
        setProgreso({ hechas, total: filas.length })
      }

      const total = unir(partes)
      if (ruta.endsWith('previsualizar')) {
        setPrevia(total)
      } else {
        setImportado(total.resumen)
        setPrevia(null)
        qc.invalidateQueries({ queryKey: ['clientes'] })
      }
    } catch (e: any) {
      const m = e?.response?.data?.message
      setError(Array.isArray(m) ? m.join(', ') : (m ?? 'No se pudo procesar el archivo'))
    } finally {
      setCargando(false)
      setProgreso(null)
    }
  }

  async function vaciar() {
    setBorrando(true)
    setError(null)
    try {
      const { data } = await api.post('/importacion/clientes/vaciar', {
        confirmacion: confirmacionBorrado,
      })
      setResultadoBorrado(data)
      setConfirmacionBorrado('')
      qc.invalidateQueries({ queryKey: ['clientes'] })
    } catch (e: any) {
      const m = e?.response?.data?.message
      setError(Array.isArray(m) ? m.join(', ') : (m ?? 'No se pudo vaciar'))
    } finally {
      setBorrando(false)
    }
  }

  const r = previa?.resumen

  return (
    <div className="mx-auto max-w-4xl space-y-5 p-1">
      <div>
        <h1 className="text-2xl font-bold md:text-3xl" style={{ color: NAVY }}>
          Importar clientes
        </h1>
        <p className="text-sm text-muted-foreground">
          Carga la base histórica desde el Excel de operaciones
        </p>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* ── Archivo ── */}
      <div className="rounded-xl border p-4">
        <p className="mb-3 text-sm font-semibold" style={{ color: NAVY }}>
          1 · Elige el archivo
        </p>
        <input
          ref={archivoRef}
          type="file"
          accept=".xlsx,.xls"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) leerArchivo(f)
            e.target.value = ''
          }}
        />
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="outline" onClick={() => archivoRef.current?.click()}>
            <FileSpreadsheet className="mr-1.5 h-4 w-4" /> Elegir Excel
          </Button>
          {filas && (
            <span className="text-sm text-muted-foreground">
              <strong style={{ color: NAVY }}>{nombreArchivo}</strong> · {filas.length} filas
            </span>
          )}
        </div>
      </div>

      {/* ── Previsualización ── */}
      {filas && !importado && (
        <div className="rounded-xl border p-4">
          <p className="mb-1 text-sm font-semibold" style={{ color: NAVY }}>
            2 · Revisa qué se va a cargar
          </p>
          <p className="mb-3 text-xs text-muted-foreground">
            No escribe nada en la base: solo dice qué pasaría.
          </p>
          <Button
            onClick={() => enviar('/importacion/clientes/previsualizar')}
            disabled={cargando}
            style={{ backgroundColor: NAVY, color: '#fff' }}
          >
            {cargando && progreso
              ? `Revisando… ${progreso.hechas} de ${progreso.total}`
              : 'Revisar archivo'}
          </Button>

          {r && (
            <div className="mt-4 space-y-3">
              <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-5">
                {[
                  { t: 'Clientes nuevos', v: r.clientes, color: VERDE },
                  { t: 'Pólizas', v: r.polizas },
                  { t: 'Dependientes', v: r.dependientes },
                  { t: 'Se suman a existentes', v: r.polizasSumadas },
                  { t: 'Se omiten', v: r.yaExistian },
                ].map((c) => (
                  <div key={c.t} className="rounded-lg border p-3">
                    <p className="text-[11px] text-muted-foreground">{c.t}</p>
                    <p className="text-xl font-bold" style={{ color: c.color ?? NAVY }}>
                      {c.v}
                    </p>
                  </div>
                ))}
              </div>

              {(r.sinCedula > 0 || r.cedulaInvalida > 0) && (
                <p className="text-xs text-amber-800">
                  {r.sinCedula > 0 && `${r.sinCedula} sin cédula. `}
                  {r.cedulaInvalida > 0 && `${r.cedulaInvalida} con cédula que no valida. `}
                  Se cargan igual y quedan marcados como &quot;datos por revisar&quot;.
                </p>
              )}

              {r.agentesSinUsuario.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  <strong>Agentes sin usuario en el CRM:</strong>{' '}
                  {r.agentesSinUsuario.join(', ')}. Se guarda su nombre en la ficha, así que la
                  venta no se pierde.
                </p>
              )}

              {previa!.avisos.length > 0 && (
                <details className="rounded-lg border p-3">
                  <summary className="cursor-pointer text-xs font-medium">
                    Ver los {previa!.avisos.length} avisos
                  </summary>
                  <ul className="mt-2 max-h-52 space-y-1 overflow-y-auto text-[11px]">
                    {previa!.avisos.map((a, i) => (
                      <li
                        key={i}
                        style={{ color: a.nivel === 'error' ? '#b91c1c' : '#78716c' }}
                      >
                        Fila {a.fila}: {a.texto}
                      </li>
                    ))}
                  </ul>
                </details>
              )}

              <details className="rounded-lg border p-3">
                <summary className="cursor-pointer text-xs font-medium">
                  Ver los {previa!.detalle.length} clientes
                </summary>
                <div className="mt-2 max-h-72 overflow-auto">
                  <table className="w-full text-[11px]">
                    <thead className="sticky top-0 bg-muted">
                      <tr className="text-left">
                        <th className="p-1.5">Cliente</th>
                        <th className="p-1.5">Cédula</th>
                        <th className="p-1.5">Aseguradora</th>
                        <th className="p-1.5 text-right">Prima</th>
                        <th className="p-1.5">Agente</th>
                        <th className="p-1.5 text-right">Deps.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {previa!.detalle.map((d, i) => (
                        <tr key={i} className="border-t">
                          <td className="p-1.5">{d.cliente}</td>
                          <td className="p-1.5">{d.identificacion}</td>
                          <td className="p-1.5">{d.aseguradora ?? '—'}</td>
                          <td className="p-1.5 text-right">
                            {d.prima ? `$${Number(d.prima).toFixed(2)}` : '—'}
                          </td>
                          <td
                            className="p-1.5"
                            style={{ color: d.agenteEnCrm ? undefined : '#b45309' }}
                          >
                            {d.agente ?? '—'}
                          </td>
                          <td className="p-1.5 text-right">{d.dependientes}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>

              <div className="border-t pt-3">
                <p className="mb-2 text-sm font-semibold" style={{ color: NAVY }}>
                  3 · Importar
                </p>
                <Button
                  onClick={() => enviar('/importacion/clientes')}
                  disabled={cargando}
                  style={{ backgroundColor: VERDE, color: '#fff' }}
                >
                  <Upload className="mr-1.5 h-4 w-4" />
                  {cargando && progreso
                    ? `Importando… ${progreso.hechas} de ${progreso.total}`
                    : `Importar ${r.clientes} clientes`}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Terminado ── */}
      {importado && (
        <div className="rounded-xl border-2 p-5" style={{ borderColor: VERDE }}>
          <div className="flex items-center gap-2">
            <Check className="h-5 w-5" style={{ color: VERDE }} strokeWidth={3} />
            <p className="font-bold" style={{ color: NAVY }}>
              Importación terminada
            </p>
          </div>
          <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
            <p>
              <strong>{importado.clientes}</strong> clientes creados
            </p>
            <p>
              <strong>{importado.polizas}</strong> pólizas
            </p>
            <p>
              <strong>{importado.dependientes}</strong> dependientes
            </p>
            <p>
              <strong>{importado.polizasSumadas}</strong> pólizas sumadas a clientes que ya
              existían
            </p>
          </div>
          {importado.yaExistian > 0 && (
            <p className="mt-2 text-xs text-muted-foreground">
              {importado.yaExistian} contratos ya estaban cargados y se omitieron.
            </p>
          )}
          {/* Los que fallaron se muestran con su motivo: con 1.500 filas hay que
              poder ver cuales quedaron fuera y por que, no solo el total. */}
          {importado.fallidos > 0 && (
            <p className="mt-2 text-xs font-medium text-red-700">
              {importado.fallidos} no se pudieron cargar. Mira los avisos para ver el motivo de
              cada uno.
            </p>
          )}
        </div>
      )}

      {/* ── Vaciar ── */}
      <div className="rounded-xl border-2 border-red-200 bg-red-50/40 p-4">
        <p className="text-sm font-semibold text-red-800">Vaciar la base de clientes</p>
        <p className="mt-1 text-xs text-red-900/80">
          Borra <strong>clientes, pólizas, renovaciones, dependientes, requerimientos y
          reembolsos</strong>. No toca los leads ni el pipeline. Es irreversible.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Input
            value={confirmacionBorrado}
            onChange={(e) => setConfirmacionBorrado(e.target.value)}
            placeholder="Escribe: BORRAR TODOS LOS CLIENTES"
            className="h-9 max-w-[320px] bg-white text-sm"
          />
          <Button
            variant="outline"
            className="border-red-300 text-red-700 hover:bg-red-100"
            disabled={confirmacionBorrado !== 'BORRAR TODOS LOS CLIENTES' || borrando}
            onClick={vaciar}
          >
            <Trash2 className="mr-1.5 h-4 w-4" />
            {borrando ? 'Borrando…' : 'Vaciar'}
          </Button>
        </div>
        {resultadoBorrado && (
          <p className="mt-2 text-xs text-red-900">
            Se borraron {resultadoBorrado.clientesBorrados} clientes,{' '}
            {resultadoBorrado.polizasBorradas} pólizas,{' '}
            {resultadoBorrado.renovacionesBorradas} renovaciones,{' '}
            {resultadoBorrado.requerimientosBorrados} requerimientos y{' '}
            {resultadoBorrado.reembolsosBorrados} reembolsos.
          </p>
        )}
      </div>
    </div>
  )
}
