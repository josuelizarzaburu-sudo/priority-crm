'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog'
import { Label } from '@/components/ui/label'
import { useContactsStore } from '@/store'
import { api } from '@/lib/api'
import { useQueryClient } from '@tanstack/react-query'

interface DuplicateContact {
  id: string
  firstName: string
  lastName?: string
  email?: string
  phone?: string
  company?: string
}

export function ContactsHeader() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [company, setCompany] = useState('')
  const [saving, setSaving] = useState(false)

  const [duplicate, setDuplicate] = useState<DuplicateContact | null>(null)
  const [duplicateOpen, setDuplicateOpen] = useState(false)

  const { setSearchQuery } = useContactsStore()
  const queryClient = useQueryClient()

  async function doCreate() {
    setSaving(true)
    try {
      await api.post('/contacts', { firstName, lastName, email, phone, company })
      queryClient.invalidateQueries({ queryKey: ['contacts'] })
      setOpen(false)
      resetForm()
    } finally {
      setSaving(false)
    }
  }

  function resetForm() {
    setFirstName('')
    setLastName('')
    setEmail('')
    setPhone('')
    setCompany('')
    setDuplicate(null)
  }

  async function handleCreate() {
    if (!firstName.trim()) return

    // Check for duplicates when email or phone is provided
    if (email.trim() || phone.trim()) {
      setSaving(true)
      try {
        const params = new URLSearchParams()
        if (email.trim()) params.set('email', email.trim())
        if (phone.trim()) params.set('phone', phone.trim())
        const { data } = await api.get(`/contacts/check-duplicate?${params}`)
        if (data.contact) {
          setDuplicate(data.contact)
          setDuplicateOpen(true)
          return
        }
      } finally {
        setSaving(false)
      }
    }

    await doCreate()
  }

  function handleViewExisting() {
    if (!duplicate) return
    setDuplicateOpen(false)
    setOpen(false)
    resetForm()
    router.push(`/contacts/${duplicate.id}`)
  }

  async function handleForceCreate() {
    setDuplicateOpen(false)
    await doCreate()
  }

  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-2xl font-bold">Contacts</h1>
        <p className="text-sm text-muted-foreground">Manage your contacts and leads</p>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search contacts..."
            className="w-56 pl-8"
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New Contact
        </Button>
      </div>

      {/* Create contact dialog */}
      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm() }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create Contact</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>First name *</Label>
                <Input
                  placeholder="John"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Last name</Label>
                <Input
                  placeholder="Doe"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input
                type="email"
                placeholder="john@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Phone</Label>
              <Input
                placeholder="+1 (555) 000-0000"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Company</Label>
              <Input
                placeholder="Acme Corp"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setOpen(false); resetForm() }}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={saving || !firstName.trim()}>
              {saving ? 'Verificando...' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Duplicate warning dialog */}
      <AlertDialog open={duplicateOpen} onOpenChange={setDuplicateOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Contacto duplicado detectado</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>Ya existe un contacto con el mismo {email && duplicate?.email === email ? 'email' : 'teléfono'}:</p>
                <div className="rounded-md border bg-muted/40 p-3 text-sm">
                  <p className="font-semibold">
                    {duplicate?.firstName} {duplicate?.lastName ?? ''}
                  </p>
                  {duplicate?.email && <p className="text-muted-foreground">{duplicate.email}</p>}
                  {duplicate?.phone && <p className="text-muted-foreground">{duplicate.phone}</p>}
                  {duplicate?.company && <p className="text-muted-foreground">{duplicate.company}</p>}
                </div>
                <p>¿Qué deseas hacer?</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col gap-2 sm:flex-row">
            <AlertDialogCancel onClick={() => setDuplicateOpen(false)}>
              Cancelar
            </AlertDialogCancel>
            <Button variant="outline" onClick={handleViewExisting}>
              Ver contacto existente
            </Button>
            <AlertDialogAction onClick={handleForceCreate} disabled={saving}>
              Crear de todas formas
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
