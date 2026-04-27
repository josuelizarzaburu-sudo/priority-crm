'use client'

import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { MoreHorizontal } from 'lucide-react'
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

  return (
    <div className="rounded-lg border bg-card">
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
          {filtered.length === 0 ? (
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
  )
}

function ContactRow({ contact }: { contact: Contact }) {
  const fullName = `${contact.firstName}${contact.lastName ? ` ${contact.lastName}` : ''}`

  return (
    <TableRow className="cursor-pointer hover:bg-muted/50">
      <TableCell>
        <div className="flex items-center gap-3">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="text-xs">{getInitials(fullName)}</AvatarFallback>
          </Avatar>
          <span className="font-medium text-sm">{fullName}</span>
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
      <TableCell>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem>View details</DropdownMenuItem>
            <DropdownMenuItem>Edit</DropdownMenuItem>
            <DropdownMenuItem className="text-destructive">Delete</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  )
}
