'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Plus, X } from 'lucide-react'
import {
  RAMOS,
  ASEGURADORAS_POR_RAMO,
  pideDatosVehiculo,
  pideSumaAsegurada,
  type RamoId,
} from '@/lib/ramos-seguros'
import { revisarIdentificacion } from '@/components/clientes/nuevo-cliente'

export interface WonInsuranceData {
  netPremium: number
  plan: string
  paymentFrequency: string
  issueDate?: string
  holderName?: string
  // Cedula o RUC del titular. Es la llave para no duplicar clientes en el CRM
  // operativo: si ya existe una ficha con esta identificacion, las polizas se
  // suman a esa en vez de crear un cliente nuevo.
  identificacion?: string
  aseguradora?: string
  // Ramo: mismo valor que el enum TipoPoliza del CRM operativo, para que la
  // poliza se cree alla sin traducir nada.
  ramo?: RamoId
  // Solo si el ramo es AUTO
  marca?: string
  modelo?: string
  anio?: string
  placa?: string
  // Solo si el ramo es VIDA u HOGAR
  sumaAsegurada?: number
  // Nota del comercial para la ejecutiva que reciba el cliente en el operativo.
  notaOperaciones?: string
}

interface EntryDraft {
  id: string
  ramo: RamoId
  holderName: string
  identificacion: string
  plan: string
  paymentFrequency: string
  aseguradora: string
  issueDate: string
  netPremium: string
  marca: string
  modelo: string
  anio: string
  placa: string
  sumaAsegurada: string
}

function emptyEntry(): EntryDraft {
  return {
    id: `${Date.now()}-${Math.random()}`,
    ramo: 'SALUD',
    holderName: '',
    identificacion: '',
    plan: '',
    paymentFrequency: 'debito-mensual',
    aseguradora: '',
    issueDate: '',
    netPremium: '',
    marca: '',
    modelo: '',
    anio: '',
    placa: '',
    sumaAsegurada: '',
  }
}

interface WonDealModalProps {
  open: boolean
  onConfirm: (entries: WonInsuranceData[]) => void
  onCancel: () => void
  loading?: boolean
  /**
   * 'cerrar' es el cierre del deal; 'editar' es capturar o corregir los datos del
   * seguro en cualquier momento, sin mover el deal de etapa. Se usa el mismo
   * formulario a proposito: si se duplicara, los dos se irian separando.
   */
  modo?: 'cerrar' | 'editar'
  /** Datos ya capturados, para poder corregirlos en vez de empezar de cero. */
  datosIniciales?: WonInsuranceData[]
}

export function WonDealModal({
  open,
  onConfirm,
  onCancel,
  loading,
  modo = 'cerrar',
  datosIniciales,
}: WonDealModalProps) {
  const [entries, setEntries] = useState<EntryDraft[]>([emptyEntry()])
  // Nota unica del cierre: viaja a la ficha del cliente en el CRM operativo.
  const [notaOperaciones, setNotaOperaciones] = useState('')
  // Datos que hoy no se piden y que operaciones termina persiguiendo despues.
  const [direccion, setDireccion] = useState('')
  const [vieneDeOtroSeguro, setVieneDeOtroSeguro] = useState('')
  const [aseguradoraAnterior, setAseguradoraAnterior] = useState('')

  useEffect(() => {
    if (!open) return
    const previos = datosIniciales ?? []
    if (previos.length > 0) {
      setEntries(
        previos.map((d) => ({
          ...emptyEntry(),
          ramo: (d.ramo ?? 'SALUD') as RamoId,
          holderName: d.holderName ?? '',
          identificacion: d.identificacion ?? '',
          plan: d.plan ?? '',
          paymentFrequency: d.paymentFrequency ?? 'debito-mensual',
          aseguradora: d.aseguradora ?? '',
          issueDate: d.issueDate ?? '',
          netPremium: d.netPremium != null ? String(d.netPremium) : '',
          marca: d.marca ?? '',
          modelo: d.modelo ?? '',
          anio: d.anio ?? '',
          placa: d.placa ?? '',
          sumaAsegurada: d.sumaAsegurada != null ? String(d.sumaAsegurada) : '',
        })),
      )
      setNotaOperaciones(previos.map((d) => d.notaOperaciones).find(Boolean) ?? '')
      setDireccion(previos.map((d: any) => d.direccion).find(Boolean) ?? '')
      setVieneDeOtroSeguro(previos.map((d: any) => d.vieneDeOtroSeguro).find(Boolean) ?? '')
      setAseguradoraAnterior(previos.map((d: any) => d.aseguradoraAnterior).find(Boolean) ?? '')
    } else {
      setEntries([emptyEntry()])
      setNotaOperaciones('')
    }
    // Se recarga solo al abrir, para no pisar lo que el usuario esta escribiendo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // La cedula es obligatoria a proposito: es lo unico que evita que se dupliquen
  // clientes en el operativo. El comercial ya la tiene, porque sin ella no emite.
  const canConfirm = entries.length > 0 && entries.every(
    (e) =>
      e.plan.trim() !== '' &&
      e.netPremium.trim() !== '' &&
      parseFloat(e.netPremium) > 0 &&
      e.identificacion.trim() !== '' &&
      revisarIdentificacion(e.identificacion) === null,
  )

  function updateEntry(idx: number, field: keyof EntryDraft, value: string) {
    setEntries((prev) => prev.map((e, i) => (i === idx ? { ...e, [field]: value } : e)))
  }

  function addEntry() {
    setEntries((prev) => [...prev, emptyEntry()])
  }

  function removeEntry(idx: number) {
    setEntries((prev) => prev.filter((_, i) => i !== idx))
  }

  function handleConfirm() {
    if (!canConfirm || loading) return
    onConfirm(
      entries.map((e) => ({
        netPremium: parseFloat(e.netPremium),
        plan: e.plan.trim(),
        paymentFrequency: e.paymentFrequency,
        ...(e.issueDate ? { issueDate: e.issueDate } : {}),
        ...(e.holderName.trim() ? { holderName: e.holderName.trim() } : {}),
        identificacion: e.identificacion.trim(),
        ...(e.aseguradora ? { aseguradora: e.aseguradora } : {}),
        ramo: e.ramo,
        ...(pideDatosVehiculo(e.ramo)
          ? {
              ...(e.marca.trim() ? { marca: e.marca.trim() } : {}),
              ...(e.modelo.trim() ? { modelo: e.modelo.trim() } : {}),
              ...(e.anio.trim() ? { anio: e.anio.trim() } : {}),
              ...(e.placa.trim() ? { placa: e.placa.trim().toUpperCase() } : {}),
            }
          : {}),
        ...(pideSumaAsegurada(e.ramo) && e.sumaAsegurada.trim()
          ? { sumaAsegurada: parseFloat(e.sumaAsegurada) }
          : {}),
        // La nota es del cierre completo; se adjunta a cada entrada para que
        // llegue igual sin importar cual poliza procese primero el operativo.
        ...(notaOperaciones.trim() ? { notaOperaciones: notaOperaciones.trim() } : {}),
        ...(direccion.trim() ? { direccion: direccion.trim() } : {}),
        ...(vieneDeOtroSeguro
          ? {
              vieneDeOtroSeguro:
                vieneDeOtroSeguro === 'SI' && aseguradoraAnterior.trim()
                  ? `Sí — ${aseguradoraAnterior.trim()}`
                  : vieneDeOtroSeguro === 'SI'
                    ? 'Sí'
                    : 'No',
            }
          : {}),
      })),
    )
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v && !loading) onCancel() }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{modo === 'editar' ? 'Datos del seguro' : '🏆 Datos para cerrar deal'}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground -mt-1 pb-1">
          Completa los datos antes de mover a <strong>Ganado</strong>.
        </p>

        <div className="max-h-[60vh] overflow-y-auto space-y-3 pr-1">
          {entries.map((entry, idx) => (
            <div key={entry.id} className="rounded-md border p-3 space-y-3">
              {entries.length > 1 && (
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-muted-foreground">Cliente {idx + 1}</span>
                  <button
                    onClick={() => removeEntry(idx)}
                    className="flex h-5 w-5 items-center justify-center rounded hover:bg-muted text-muted-foreground hover:text-red-500"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Titular del plan</Label>
                  <Input
                    placeholder="Nombre completo"
                    value={entry.holderName}
                    onChange={(e) => updateEntry(idx, 'holderName', e.target.value)}
                    className="h-8 text-sm"
                    autoFocus={idx === 0}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Cédula o RUC del titular *</Label>
                  <Input
                    placeholder="1712345678"
                    value={entry.identificacion}
                    onChange={(e) => updateEntry(idx, 'identificacion', e.target.value)}
                    inputMode="numeric"
                    className="h-8 text-sm"
                  />
                  {entry.identificacion.trim() !== '' &&
                    revisarIdentificacion(entry.identificacion) && (
                      <p className="text-[11px] text-red-600">
                        {revisarIdentificacion(entry.identificacion)}
                      </p>
                    )}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Aseguradora</Label>
                  {/* Lista con sugerencias pero de texto libre: el catalogo aun no
                      cubre vida ni hogar, y no queremos bloquear el cierre por eso. */}
                  <Input
                    list={`aseguradoras-${entry.id}`}
                    value={entry.aseguradora}
                    onChange={(e) => updateEntry(idx, 'aseguradora', e.target.value)}
                    placeholder="Escribe o elige..."
                    className="h-8 text-sm"
                  />
                  <datalist id={`aseguradoras-${entry.id}`}>
                    {ASEGURADORAS_POR_RAMO[entry.ramo].map((a) => (
                      <option key={a} value={a} />
                    ))}
                  </datalist>
                </div>
              </div>

              {/* Ramo: define que campos se piden abajo y que aseguradoras se sugieren */}
              <div className="space-y-1.5">
                <Label className="text-xs">Ramo</Label>
                <Select
                  value={entry.ramo}
                  onValueChange={(v) => updateEntry(idx, 'ramo', v as RamoId)}
                >
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {RAMOS.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {pideDatosVehiculo(entry.ramo) && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Marca</Label>
                    <Input
                      value={entry.marca}
                      onChange={(e) => updateEntry(idx, 'marca', e.target.value)}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Modelo</Label>
                    <Input
                      value={entry.modelo}
                      onChange={(e) => updateEntry(idx, 'modelo', e.target.value)}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Año</Label>
                    <Input
                      value={entry.anio}
                      onChange={(e) => updateEntry(idx, 'anio', e.target.value)}
                      inputMode="numeric"
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Placa</Label>
                    <Input
                      value={entry.placa}
                      onChange={(e) => updateEntry(idx, 'placa', e.target.value)}
                      className="h-8 text-sm uppercase"
                    />
                  </div>
                </div>
              )}

              {pideSumaAsegurada(entry.ramo) && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Suma asegurada</Label>
                  <Input
                    value={entry.sumaAsegurada}
                    onChange={(e) => updateEntry(idx, 'sumaAsegurada', e.target.value)}
                    inputMode="decimal"
                    placeholder="0.00"
                    className="h-8 text-sm"
                  />
                </div>
              )}

              <div className="space-y-1.5">
                <Label className="text-xs">
                  Plan contratado <span className="text-red-500">*</span>
                </Label>
                <Input
                  placeholder="ej. Plan Premium Plus"
                  value={entry.plan}
                  onChange={(e) => updateEntry(idx, 'plan', e.target.value)}
                  className="h-8 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Forma de pago</Label>
                  <Select value={entry.paymentFrequency} onValueChange={(v) => updateEntry(idx, 'paymentFrequency', v)}>
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pago-contado">Pago contado</SelectItem>
                      <SelectItem value="debito-mensual">Débito mensual</SelectItem>
                      <SelectItem value="diferido-especial">Diferido especial</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Fecha de vigencia</Label>
                  <Input
                    type="date"
                    value={entry.issueDate}
                    onChange={(e) => updateEntry(idx, 'issueDate', e.target.value)}
                    className="h-8 text-sm"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">
                  Prima neta (USD) <span className="text-red-500">*</span>
                </Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={entry.netPremium}
                  onChange={(e) => updateEntry(idx, 'netPremium', e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
            </div>
          ))}

          <button
            onClick={addEntry}
            className="flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed py-2 text-xs text-muted-foreground hover:border-primary hover:text-primary"
          >
            <Plus className="h-3.5 w-3.5" /> Agregar cliente
          </button>
        </div>

        {/* Datos que operaciones necesita y que hoy termina persiguiendo despues.
            Se piden aqui, al cerrar, porque es cuando el comercial todavia tiene
            al cliente en la conversacion. */}
        <div className="space-y-1.5">
          <Label className="text-xs">Dirección</Label>
          <Input
            value={direccion}
            onChange={(e) => setDireccion(e.target.value)}
            placeholder="Calle, número, sector, ciudad"
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">¿Viene de otro seguro?</Label>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={vieneDeOtroSeguro}
              onChange={(e) => setVieneDeOtroSeguro(e.target.value)}
              className="h-10 rounded-md border bg-background px-3 text-sm"
            >
              <option value="">Sin especificar</option>
              <option value="SI">Sí</option>
              <option value="NO">No</option>
            </select>
            {/* Saber de que aseguradora venia es mas util que un si a secas:
                ayuda a entender la cartera y a preparar la conversacion. */}
            {vieneDeOtroSeguro === 'SI' && (
              <Input
                value={aseguradoraAnterior}
                onChange={(e) => setAseguradoraAnterior(e.target.value)}
                placeholder="¿De cuál aseguradora?"
                className="max-w-[220px]"
              />
            )}
          </div>
        </div>

        {/* Nota del comercial. Viaja hasta la ficha del cliente en el CRM
            operativo, para que la ejecutiva reciba el contexto de la venta
            (persistencia, acuerdos, pendientes) y no tenga que preguntarlo. */}
        <div className="space-y-1.5">
          <Label className="text-xs">Nota para operaciones</Label>
          <textarea
            value={notaOperaciones}
            onChange={(e) => setNotaOperaciones(e.target.value)}
            rows={3}
            placeholder="Ej: persistencia 12 meses, cliente pidió débito los 5 de cada mes."
            className="w-full rounded-md border bg-background p-2 text-sm"
          />
          <p className="text-[11px] text-muted-foreground">
            La verá la ejecutiva que reciba este cliente en el CRM operativo.
          </p>
        </div>

        <DialogFooter className="mt-2">
          <Button variant="outline" onClick={onCancel} disabled={loading}>
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!canConfirm || loading}
            className={
              modo === 'editar' ? '' : 'bg-green-600 hover:bg-green-700 text-white'
            }
          >
            {loading
              ? 'Guardando...'
              : modo === 'editar'
                ? 'Guardar datos'
                : '🏆 Confirmar Ganado'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
