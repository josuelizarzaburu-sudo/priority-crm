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

export interface WonInsuranceData {
  netPremium: number
  plan: string
  paymentFrequency: string
  issueDate?: string
  holderName?: string
  aseguradora?: string
}

interface EntryDraft {
  id: string
  holderName: string
  plan: string
  paymentFrequency: string
  aseguradora: string
  issueDate: string
  netPremium: string
}

function emptyEntry(): EntryDraft {
  return {
    id: `${Date.now()}-${Math.random()}`,
    holderName: '',
    plan: '',
    paymentFrequency: 'debito-mensual',
    aseguradora: '',
    issueDate: '',
    netPremium: '',
  }
}

interface WonDealModalProps {
  open: boolean
  onConfirm: (entries: WonInsuranceData[]) => void
  onCancel: () => void
  loading?: boolean
}

export function WonDealModal({ open, onConfirm, onCancel, loading }: WonDealModalProps) {
  const [entries, setEntries] = useState<EntryDraft[]>([emptyEntry()])

  useEffect(() => {
    if (open) setEntries([emptyEntry()])
  }, [open])

  const canConfirm = entries.length > 0 && entries.every(
    (e) => e.plan.trim() !== '' && e.netPremium.trim() !== '' && parseFloat(e.netPremium) > 0,
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
        ...(e.aseguradora ? { aseguradora: e.aseguradora } : {}),
      })),
    )
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v && !loading) onCancel() }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>🏆 Datos para cerrar deal</DialogTitle>
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
                  <Label className="text-xs">Aseguradora</Label>
                  <Select value={entry.aseguradora} onValueChange={(v) => updateEntry(idx, 'aseguradora', v)}>
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue placeholder="Seleccionar..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="BMI">BMI</SelectItem>
                      <SelectItem value="Saludsa">Saludsa</SelectItem>
                      <SelectItem value="Cuasanitas">Cuasanitas</SelectItem>
                      <SelectItem value="Humana">Humana</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

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
                  <Label className="text-xs">Fecha de emisión</Label>
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

        <DialogFooter className="mt-2">
          <Button variant="outline" onClick={onCancel} disabled={loading}>
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!canConfirm || loading}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            {loading ? 'Guardando...' : '🏆 Confirmar Ganado'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
