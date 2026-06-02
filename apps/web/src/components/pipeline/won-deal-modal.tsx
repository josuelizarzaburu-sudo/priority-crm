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

export interface WonInsuranceData {
  netPremium: number
  plan: string
  paymentFrequency: string
  issueDate?: string
  holderName?: string
}

interface WonDealModalProps {
  open: boolean
  onConfirm: (data: WonInsuranceData) => void
  onCancel: () => void
  loading?: boolean
}

export function WonDealModal({ open, onConfirm, onCancel, loading }: WonDealModalProps) {
  const [netPremium, setNetPremium] = useState('')
  const [plan, setPlan] = useState('')
  const [paymentFrequency, setPaymentFrequency] = useState('mensual')
  const [issueDate, setIssueDate] = useState('')
  const [holderName, setHolderName] = useState('')

  // Reset every time the modal opens
  useEffect(() => {
    if (open) {
      setNetPremium('')
      setPlan('')
      setPaymentFrequency('mensual')
      setIssueDate('')
      setHolderName('')
    }
  }, [open])

  const canConfirm = netPremium.trim() !== '' && parseFloat(netPremium) > 0 && plan.trim() !== ''

  function handleConfirm() {
    if (!canConfirm || loading) return
    onConfirm({
      netPremium: parseFloat(netPremium),
      plan: plan.trim(),
      paymentFrequency,
      ...(issueDate ? { issueDate } : {}),
      ...(holderName.trim() ? { holderName: holderName.trim() } : {}),
    })
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v && !loading) onCancel() }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>🏆 Datos para cerrar deal</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground -mt-1 pb-1">
          Completa los datos antes de mover a <strong>Ganado</strong>.
        </p>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>
                Prima neta (USD) <span className="text-red-500">*</span>
              </Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={netPremium}
                onChange={(e) => setNetPremium(e.target.value)}
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label>Forma de pago</Label>
              <Select value={paymentFrequency} onValueChange={setPaymentFrequency}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mensual">Mensual</SelectItem>
                  <SelectItem value="trimestral">Trimestral</SelectItem>
                  <SelectItem value="semestral">Semestral</SelectItem>
                  <SelectItem value="anual">Anual</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>
              Plan contratado <span className="text-red-500">*</span>
            </Label>
            <Input
              placeholder="ej. Plan Premium Plus"
              value={plan}
              onChange={(e) => setPlan(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Titular del plan</Label>
              <Input
                placeholder="Nombre completo"
                value={holderName}
                onChange={(e) => setHolderName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Fecha de emisión</Label>
              <Input
                type="date"
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
              />
            </div>
          </div>
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
