'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { Search, User, DollarSign, Loader2 } from 'lucide-react'
import { api } from '@/lib/api'

interface SearchContact {
  id: string
  firstName: string
  lastName?: string
  email?: string
  phone?: string
  company?: string
}

interface SearchDeal {
  id: string
  title: string
  contactId?: string
  stage?: { name: string; color: string }
  contact?: { id: string; firstName: string; lastName?: string }
}

interface SearchResults {
  contacts: SearchContact[]
  deals: SearchDeal[]
}

export function GlobalSearch() {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Debounce
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 300)
    return () => clearTimeout(t)
  }, [query])

  useEffect(() => {
    setOpen(debouncedQuery.length >= 2)
  }, [debouncedQuery])

  // Close on outside click
  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [])

  const { data, isFetching } = useQuery<SearchResults>({
    queryKey: ['search', debouncedQuery],
    queryFn: () =>
      api.get(`/contacts/search?q=${encodeURIComponent(debouncedQuery)}`).then((r) => r.data),
    enabled: debouncedQuery.length >= 2,
    staleTime: 30_000,
  })

  const contacts = data?.contacts ?? []
  const deals = data?.deals ?? []
  const hasResults = contacts.length > 0 || deals.length > 0
  const showDropdown = open && debouncedQuery.length >= 2

  function navigate(path: string) {
    setOpen(false)
    setQuery('')
    setDebouncedQuery('')
    router.push(path)
  }

  function dealTarget(deal: SearchDeal) {
    if (deal.contact?.id) return `/contacts/${deal.contact.id}`
    return `/pipeline`
  }

  return (
    <div ref={containerRef} className="relative w-72">
      {/* Input */}
      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        {isFetching && debouncedQuery.length >= 2 && (
          <Loader2 className="absolute right-2.5 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />
        )}
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => debouncedQuery.length >= 2 && setOpen(true)}
          placeholder="Buscar contactos y deals..."
          className="h-9 w-full rounded-md border border-input bg-background pl-9 pr-9 text-sm outline-none ring-offset-background placeholder:text-muted-foreground focus:ring-2 focus:ring-ring focus:ring-offset-2"
        />
      </div>

      {/* Dropdown */}
      {showDropdown && (
        <div className="absolute left-0 top-full z-50 mt-1.5 w-full overflow-hidden rounded-lg border bg-popover shadow-lg">
          {isFetching && !hasResults ? (
            <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Buscando…
            </div>
          ) : !hasResults ? (
            <div className="py-6 text-center text-sm text-muted-foreground">Sin resultados.</div>
          ) : (
            <div className="max-h-80 overflow-y-auto py-1">
              {/* Contacts */}
              {contacts.length > 0 && (
                <>
                  <div className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Contactos
                  </div>
                  {contacts.map((c) => (
                    <button
                      key={c.id}
                      className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-accent"
                      onClick={() => navigate(`/contacts/${c.id}`)}
                    >
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10">
                        <User className="h-3.5 w-3.5 text-primary" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {c.firstName} {c.lastName ?? ''}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {[c.email, c.phone, c.company].filter(Boolean).join(' · ')}
                        </p>
                      </div>
                    </button>
                  ))}
                </>
              )}

              {/* Deals */}
              {deals.length > 0 && (
                <>
                  <div className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Deals
                  </div>
                  {deals.map((d) => (
                    <button
                      key={d.id}
                      className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-accent"
                      onClick={() => navigate(dealTarget(d))}
                    >
                      <div
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
                        style={{ backgroundColor: `${d.stage?.color ?? '#6366f1'}20` }}
                      >
                        <DollarSign
                          className="h-3.5 w-3.5"
                          style={{ color: d.stage?.color ?? '#6366f1' }}
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{d.title}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {d.stage?.name ?? ''}
                          {d.contact
                            ? ` · ${d.contact.firstName} ${d.contact.lastName ?? ''}`
                            : ''}
                        </p>
                      </div>
                    </button>
                  ))}
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
