'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { AutomationTrigger } from '@priority-crm/shared'
import { api } from '@/lib/api'
import { useQueryClient } from '@tanstack/react-query'

const TRIGGER_LABELS: Record<string, string> = {
  [AutomationTrigger.DEAL_STAGE_CHANGED]: 'Deal stage changed',
  [AutomationTrigger.DEAL_CREATED]: 'Deal created',
  [AutomationTrigger.DEAL_WON]: 'Deal won',
  [AutomationTrigger.DEAL_LOST]: 'Deal lost',
  [AutomationTrigger.CONTACT_CREATED]: 'Contact created',
  [AutomationTrigger.MESSAGE_RECEIVED]: 'Message received',
  [AutomationTrigger.TASK_OVERDUE]: 'Task overdue',
}

export function AutomationsHeader() {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [trigger, setTrigger] = useState('')
  const [saving, setSaving] = useState(false)
  const queryClient = useQueryClient()

  async function handleCreate() {
    if (!name.trim() || !trigger) return
    setSaving(true)
    try {
      await api.post('/automations', { name, trigger, actions: [] })
      queryClient.invalidateQueries({ queryKey: ['automations'] })
      setOpen(false)
      setName('')
      setTrigger('')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-2xl font-bold">Automations</h1>
        <p className="text-sm text-muted-foreground">Automate repetitive tasks and workflows</p>
      </div>

      <Button onClick={() => setOpen(true)}>
        <Plus className="mr-2 h-4 w-4" />
        New Automation
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create Automation</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input
                placeholder="e.g. Welcome new leads"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Trigger</Label>
              <Select value={trigger} onValueChange={setTrigger}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a trigger..." />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(TRIGGER_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={saving || !name.trim() || !trigger}>
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
