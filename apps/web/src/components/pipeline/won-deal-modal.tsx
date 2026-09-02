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
  /**
   * Deducible de la poliza. Sale en la carta de bienvenida al cliente.
   * Opcional porque en auto y hogar no se maneja igual; en salud se exige antes
   * de dejar cerrar el deal.
   */
  deducible?: string
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
  /** Deducible de la poliza. Sale en la carta de bienvenida al cliente. */
  deducible: string
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
    deducible: '',
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
  /**
   * Datos del contacto que tambien viajan a la ficha del cliente.
   *
   * Se piden AQUI y no en el panel del lead para no obligar a salir del modal,
   * llenarlos y volver. El comercial completa todo de una vez.
   */
  contacto?: { email?: string; direccion?: string; fechaNacimiento?: string }
  /** Se llama al confirmar, con los datos del contacto ya completos. */
  onGuardarContacto?: (datos: {
    email: string
    direccion: string
    fechaNacimiento: string
  }) => void
}

export function WonDealModal({
  open,
  onConfirm,
  onCancel,
  loading,
  modo = 'cerrar',
  datosIniciales,
  contacto,
  onGuardarContacto,
}: WonDealModalProps) {
  // Datos del contacto que hacen falta para que operaciones pueda trabajar.
  const [email, setEmail] = useState('')
  const [direccion, setDireccion] = useState('')
  const [fechaNacimiento, setFechaNacimiento] = useState('')
  const [entries, setEntries] = useState<EntryDraft[]>([emptyEntry()])
  // Nota unica del cierre: viaja a la ficha del cliente en el CRM operativo.
  const [notaOperaciones, setNotaOperaciones] = useState('')

  useEffect(() => {
    if (!open) return
    // Se precargan los datos que ya tenga el contacto: si el correo ya estaba,
    // no hay que volver a escribirlo.
    setEmail(contacto?.email ?? '')
    setDireccion(contacto?.direccion ?? '')
    setFechaNacimiento(contacto?.fechaNacimiento?.slice(0, 10) ?? '')

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
    } else {
      setEntries([emptyEntry()])
      setNotaOperaciones('')
    }
    // Se recarga solo al abrir, para no pisar lo que el usuario esta escribiendo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // La cedula es obligatoria a proposito: es lo unico que evita que se dupliquen
  // clientes en el operativo. El comercial ya la tiene, porque sin ella no emite.
  /**
   * Que falta en una entrada para poder cerrar.
   *
   * Se exige TODO lo que despues necesita operaciones, y por una razon concreta:
   * cada dato que falta aqui es una llamada de la ejecutiva al comercial dias
   * despues, o una carta de bienvenida que no se puede enviar.
   *
   * Devuelve la lista de faltantes, no un true/false, para poder decir en
   * pantalla QUE falta en vez de dejar el boton apagado sin explicacion.
   */
  function faltantesDe(e: EntryDraft): string[] {
    const faltan: string[] = []
    if (!e.holderName.trim()) faltan.push('titular')
    if (!e.identificacion.trim()) faltan.push('cédula')
    else if (revisarIdentificacion(e.identificacion)) faltan.push('cédula válida')
    if (!e.aseguradora.trim()) faltan.push('aseguradora')
    if (!e.plan.trim()) faltan.push('plan')
    // El deducible solo aplica en salud: en auto y hogar no se maneja igual.
    if (e.ramo === 'SALUD' && !e.deducible.trim()) faltan.push('deducible')
    // Es la VIGENCIA que sale en la carta: "vigente desde el 01 de agosto".
    if (!e.issueDate) faltan.push('fecha de vigencia')
    if (!e.paymentFrequency) faltan.push('forma de pago')
    if (!e.netPremium.trim() || !(parseFloat(e.netPremium) > 0)) faltan.push('prima anual')
    return faltan
  }

  const faltantesPorEntrada = entries.map(faltantesDe)

  /**
   * Lo que falta del CONTACTO.
   *
   * Sin correo no se puede enviar la bienvenida, y sin fecha de nacimiento no
   * entra al saludo de cumpleanos. La direccion la necesita operaciones para el
   * retiro de documentos.
   */
  const faltantesContacto: string[] = []
  if (modo === 'cerrar') {
    if (!email.trim()) faltantesContacto.push('correo')
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim()))
      faltantesContacto.push('correo válido')
    if (!direccion.trim()) faltantesContacto.push('dirección')
    if (!fechaNacimiento) faltantesContacto.push('fecha de nacimiento')
  }
  const canConfirm =
    entries.length > 0 &&
    faltantesPorEntrada.every((f) => f.length === 0) &&
    faltantesContacto.length === 0

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
    // Los datos del contacto se guardan junto con el cierre: si se guardaran
    // aparte, un fallo dejaria la venta cerrada y el contacto a medias.
    onGuardarContacto?.({
      email: email.trim(),
      direccion: direccion.trim(),
      fechaNacimiento,
    })
    onConfirm(
      entries.map((e) => ({
        netPremium: parseFloat(e.netPremium),
        plan: e.plan.trim(),
        ...(e.deducible.trim() ? { deducible: e.deducible.trim() } : {}),
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
                  <Label className="text-xs">Titular del plan <span className="text-red-500">*</span></Label>
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
                  <Label className="text-xs">Aseguradora <span className="text-red-500">*</span></Label>
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

              {/* Obligatorio en salud: es el dato que sale en la carta de
                  bienvenida. Si no se captura aqui, la ejecutiva no puede
                  enviarla y termina persiguiendo al comercial para pedirselo. */}
              <div className="space-y-1.5">
                <Label className="text-xs">
                  Deducible {entry.ramo === 'SALUD' && <span className="text-red-500">*</span>}
                </Label>
                <Input
                  placeholder="ej. 500"
                  value={entry.deducible}
                  onChange={(e) => updateEntry(idx, 'deducible', e.target.value)}
                  className="h-8 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Forma de pago <span className="text-red-500">*</span></Label>
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
                  <Label className="text-xs">Fecha de vigencia <span className="text-red-500">*</span></Label>
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
                  Prima anual (USD) <span className="text-red-500">*</span>
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

        {/* Datos del contacto que viajan a la ficha del cliente. Se piden aqui
            para no obligar a salir del modal, llenarlos en el panel y volver. */}
        {modo === 'cerrar' && (
          <div className="space-y-2.5 rounded-lg border p-3">
            <p className="text-xs font-semibold" style={{ color: '#DBAA59' }}>
              Datos del cliente
            </p>

            <div className="space-y-1.5">
              <Label className="text-xs">
                Correo <span className="text-red-500">*</span>
              </Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="cliente@correo.com"
                className="h-8 text-sm"
              />
              <p className="text-[11px] text-muted-foreground">
                Sin correo no se le puede enviar la bienvenida.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">
                Dirección <span className="text-red-500">*</span>
              </Label>
              <Input
                value={direccion}
                onChange={(e) => setDireccion(e.target.value)}
                placeholder="Calle, número, sector, ciudad"
                className="h-8 text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">
                Fecha de nacimiento <span className="text-red-500">*</span>
              </Label>
              <Input
                type="date"
                value={fechaNacimiento}
                onChange={(e) => setFechaNacimiento(e.target.value)}
                className="h-8 max-w-[180px] text-sm"
              />
              <p className="text-[11px] text-muted-foreground">
                Se usa para el saludo de cumpleaños.
              </p>
            </div>
          </div>
        )}

        {/* Se dice QUE falta, no solo que el boton esta apagado. Con varios
            clientes en la lista, un boton deshabilitado sin explicacion obliga a
            revisar campo por campo hasta dar con el vacio. */}
        {!canConfirm && (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            <p className="font-medium">Falta completar antes de cerrar la venta:</p>
            <ul className="mt-1 space-y-0.5">
              {faltantesPorEntrada.map((faltan, i) =>
                faltan.length === 0 ? null : (
                  <li key={i}>
                    <strong>
                      {entries[i].holderName.trim() || `Cliente ${i + 1}`}:
                    </strong>{' '}
                    {faltan.join(', ')}
                  </li>
                ),
              )}
            </ul>
            {faltantesContacto.length > 0 && (
              <p className="mt-1">
                <strong>Datos del cliente:</strong> {faltantesContacto.join(', ')}
              </p>
            )}
            <p className="mt-1.5 text-[11px] opacity-80">
              Con estos datos, operaciones puede enviar la bienvenida sin tener que pedírtelos
              después.
            </p>
          </div>
        )}

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
