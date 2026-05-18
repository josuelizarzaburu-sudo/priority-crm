'use client'

import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { MoreHorizontal, Mail, Phone } from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useRouter } from 'next/navigation'
import { useContactsStore } from '@/store'
import { api } from '@/lib/api'
import { formatDate, getInitials } from '@/lib/utils'
import type { Contact } from '@priority-crm/shared'
import { ContactStatus } from '@priority-crm/shared'

const STATUS_VARIANT: Record<ContactStatus, 'default' | 'secondary' | 'destructive' | 'outline'> =
  {
    [ContactStatus.LEAD]: 'outline',
    [ContactStatus.ACTIVE]: 'default',
    [ContactStatus.CUSTOMER]: 'default',
    [ContactStatus.INACTIVE]: 'secondary',
    [ContactStatus.CHURNED]: 'destructive',
  }

export function ContactsTable() {
  const { contacts, searchQuery, setContacts } = useContactsStore()

  const { data } = useQuery({
    queryKey: ['contacts'],
    queryFn: () => api.get('/contacts').then((r) => Array.isArray(r.data) ? r.data : r.data?.data ?? []),
  })

  useEffect(() => {
    if (data) setContacts(data)
  }, [data, setContacts])

  const list = Array.isArray(contacts) ? contacts : []
  const filtered = searchQuery
    ? list.filter(
        (c) =>
          `${c.firstName} ${c.lastName}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
          c.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          c.company?.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    : list

  const empty = filtered.length === 0

  return (
    <>
      {/* ── Desktop table ─────────────────────────────────────────────── */}
      <div className="hidden rounded-lg border bg-card md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Company</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {empty ? (
              <TableRow>
                <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                  {searchQuery ? 'No contacts found.' : 'No contacts yet. Create your first one.'}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((contact) => (
                <ContactRow key={contact.id} contact={contact} />
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* ── Mobile card list ──────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 md:hidden">
        {empty ? (
          <div className="rounded-xl border-2 border-dashed px-4 py-12 text-center text-sm text-muted-foreground">
            {searchQuery ? 'Sin resultados.' : 'Aún no hay contactos.'}
          </div>
        ) : (
          filtered.map((contact) => (
            <ContactCard key={contact.id} contact={contact} />
          ))
        )}
      </div>
    </>
  )
}

/* ── Desktop row ───────────────────────────────────────────────────────────── */
function ContactRow({ contact }: { contact: Contact }) {
  const router = useRouter()
  const fullName = `${contact.firstName}${contact.lastName ? ` ${contact.lastName}` : ''}`

  return (
    <TableRow
      className="cursor-pointer hover:bg-muted/50"
      onClick={() => router.push(`/contacts/${contact.id}`)}
    >
      <TableCell>
        <div className="flex items-center gap-3">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="text-xs">{getInitials(fullName)}</AvatarFallback>
          </Avatar>
          <span className="text-sm font-medium">{fullName}</span>
        </div>
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">{contact.email ?? '—'}</TableCell>
      <TableCell className="text-sm text-muted-foreground">{contact.phone ?? '—'}</TableCell>
      <TableCell className="text-sm text-muted-foreground">{contact.company ?? '—'}</TableCell>
      <TableCell>
        <Badge variant={STATUS_VARIANT[contact.status]} className="capitalize text-xs">
          {contact.status.toLowerCase()}
        </Badge>
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">{formatDate(contact.createdAt)}</TableCell>
      <TableCell onClick={(e) => e.stopPropagation()}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); router.push(`/contacts/${contact.id}`) }}>
              Ver detalle
            </DropdownMenuItem>
            <DropdownMenuItem className="text-destructive" onClick={(e) => e.stopPropagation()}>
              Eliminar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  )
}

/* ── Mobile card ───────────────────────────────────────────────────────────── */
function ContactCard({ contact }: { contact: Contact }) {
  const router = useRouter()
  const fullName = `${contact.firstName}${contact.lastName ? ` ${contact.lastName}` : ''}`

  const STATUS_LABEL: Record<ContactStatus, string> = {
    [ContactStatus.LEAD]: 'Lead',
    [ContactStatus.ACTIVE]: 'Activo',
    [ContactStatus.CUSTOMER]: 'Cliente',
    [ContactStatus.INACTIVE]: 'Inactivo',
    [ContactStatus.CHURNED]: 'Perdido',
  }

  return (
    <button
      className="w-full rounded-2xl border bg-card px-5 py-4 text-left shadow-sm transition-all active:scale-[0.98] active:bg-muted/40"
      style={{ touchAction: 'manipulation' }}
      onClick={() => router.push(`/contacts/${contact.id}`)}
    >
      {/* Top row: avatar + name + status badge */}
      <div className="flex items-center gap-4">
        <Avatar className="h-14 w-14 shrink-0">
          <AvatarFallback className="bg-[#25324b]/10 text-base font-bold text-[#25324b]">
            {getInitials(fullName)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-semibold leading-tight">{fullName}</p>
          {contact.company && (
            <p className="mt-0.5 truncate text-sm text-muted-foreground">{contact.company}</p>
          )}
        </div>
        <Badge variant={STATUS_VARIANT[contact.status]} className="ml-auto shrink-0 text-xs">
          {STATUS_LABEL[contact.status]}
        </Badge>
      </div>

      {/* Contact info */}
      {(contact.phone || contact.email) && (
        <div className="mt-4 flex flex-col gap-3 border-t pt-4">
          {contact.phone && (
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-50">
                <Phone className="h-4 w-4 text-blue-600" />
              </div>
              <span className="text-sm font-medium">{contact.phone}</span>
            </div>
          )}
          {contact.email && (
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#d3ac76]/10">
                <Mail className="h-4 w-4 text-[#d3ac76]" />
              </div>
              <span className="truncate text-sm font-medium">{contact.email}</span>
            </div>
          )}
        </div>
      )}
    </button>
  )
}
