'use client'

import { useState, useEffect } from 'react'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Search, AlertTriangle, ChevronLeft, ChevronRight, UserPlus } from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { api } from '@/lib/api'

const NAVY = '#0C2057'

interface ClienteListado {
  id: string
  nombres: string
  apellidos: string
  identificacion: string
  telefono: string | null
  celular: string | null
  email: string | null
  revisar: boolean
  ejecutivo: { id: string; name: string } | null
  _count: { polizas: number }
}

export function ClientesTable() {
  const router = useRouter()
  const { data: session } = useSession()
  const rol = (session?.user as any)?.role ?? ''
  // Asignar ejecutiva es cosa de Yessenia (o admin), igual que en la ficha.
  const puedeAsignar = ['SUPER_ADMIN', 'OWNER', 'JEFE_OPERACIONES'].includes(rol)
  const [search, setSearch] = useState('')
  const [debounced, setDebounced] = useState('')
  const [soloRevisar, setSoloRevisar] = useState(false)
  // Bandeja de entrega comercial: clientes que llegaron de un deal ganado y
  // todavia no tienen ejecutiva. Solo la ve quien puede asignar.
  const [soloSinAsignar, setSoloSinAsignar] = useState(false)
  const [page, setPage] = useState(1)

  // Esperamos a que deje de escribir antes de consultar: con ~1000 clientes
  // no conviene disparar una búsqueda por cada tecla.
  useEffect(() => {
    const t = setTimeout(() => {
      setDebounced(search)
      setPage(1)
    }, 350)
    return () => clearTimeout(t)
  }, [search])

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['clientes', debounced, soloRevisar, soloSinAsignar, page],
    queryFn: async () => {
      const params: Record<string, string | number> = { page, limit: 25 }
      if (debounced.trim()) params.search = debounced.trim()
      if (soloRevisar) params.revisar = 'true'
      if (soloSinAsignar) params.sinAsignar = 'true'
      const r = await api.get('/clientes', { params })
      return r.data as {
        data: ClienteListado[]
        total: number
        page: number
        totalPages: number
      }
    },
    placeholderData: keepPreviousData,
  })

  const lista = data?.data ?? []
  const total = data?.total ?? 0
  const totalPages = data?.totalPages ?? 1

  const abrir = (id: string) => router.push(`/clientes/${id}`)

  return (
    <div className="flex flex-col gap-4">
      {/* ── Buscador y filtros ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre, apellido, cédula o dependiente…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-3">
          {puedeAsignar && (
            <Button
              type="button"
              variant={soloSinAsignar ? 'default' : 'outline'}
              size="sm"
              onClick={() => {
                setSoloSinAsignar((v) => !v)
                setPage(1)
              }}
              title="Clientes que llegaron de un deal ganado y aún no tienen ejecutiva"
            >
              <UserPlus className="mr-2 h-4 w-4" />
              Nuevos por asignar
            </Button>
          )}
          <Button
            type="button"
            variant={soloRevisar ? 'default' : 'outline'}
            size="sm"
            onClick={() => {
              setSoloRevisar((v) => !v)
              setPage(1)
            }}
          >
            <AlertTriangle className="mr-2 h-4 w-4" />
            Por revisar
          </Button>
          <span className="whitespace-nowrap text-sm text-muted-foreground">
            {total} {total === 1 ? 'cliente' : 'clientes'}
          </span>
        </div>
      </div>

      {/* ── Tabla (escritorio) ── */}
      <div className="hidden rounded-lg border bg-card md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Teléfono</TableHead>
              <TableHead>Celular</TableHead>
              <TableHead>Correo</TableHead>
              <TableHead className="text-center">Pólizas</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                  Cargando…
                </TableCell>
              </TableRow>
            ) : isError ? (
              <TableRow>
                <TableCell colSpan={5} className="h-32 text-center text-sm text-muted-foreground">
                  No se pudo cargar la lista.
                  <br />
                  <span className="text-xs">
                    {(error as any)?.response?.status
                      ? `Error ${(error as any).response.status}: ${
                          (error as any).response?.data?.message ?? 'sin detalle'
                        }`
                      : (error as any)?.message ?? 'Sin conexión con el servidor'}
                  </span>
                </TableCell>
              </TableRow>
            ) : lista.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                  {debounced ? 'Ningún cliente coincide con la búsqueda.' : 'Todavía no hay clientes.'}
                </TableCell>
              </TableRow>
            ) : (
              lista.map((c) => (
                <TableRow
                  key={c.id}
                  className="cursor-pointer"
                  onClick={() => abrir(c.id)}
                >
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="font-medium" style={{ color: NAVY }}>
                        {c.apellidos} {c.nombres}
                      </span>
                      {c.revisar && (
                        <Badge variant="outline" className="border-amber-500 text-amber-600">
                          Revisar
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">{c.identificacion}</div>
                  </TableCell>
                  <TableCell>{c.telefono || '—'}</TableCell>
                  <TableCell>{c.celular || '—'}</TableCell>
                  <TableCell>{c.email || '—'}</TableCell>
                  <TableCell className="text-center">{c._count.polizas}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* ── Tarjetas (móvil) ── */}
      <div className="flex flex-col gap-3 md:hidden">
        {isLoading ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Cargando…</p>
        ) : isError ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No se pudo cargar la lista.
            <br />
            <span className="text-xs">
              {(error as any)?.response?.status
                ? `Error ${(error as any).response.status}`
                : 'Sin conexión con el servidor'}
            </span>
          </p>
        ) : lista.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {debounced ? 'Ningún cliente coincide.' : 'Todavía no hay clientes.'}
          </p>
        ) : (
          lista.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => abrir(c.id)}
              className="rounded-lg border bg-card p-4 text-left"
            >
              <div className="mb-2 flex items-start justify-between gap-2">
                <div>
                  <div className="font-semibold" style={{ color: NAVY }}>
                    {c.apellidos} {c.nombres}
                  </div>
                  <div className="text-xs text-muted-foreground">{c.identificacion}</div>
                </div>
                {c.revisar && (
                  <Badge variant="outline" className="border-amber-500 text-amber-600">
                    Revisar
                  </Badge>
                )}
              </div>
              <div className="space-y-1 border-t pt-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Celular</span>
                  <span>{c.celular || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Correo</span>
                  <span className="truncate pl-2">{c.email || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Pólizas</span>
                  <span>{c._count.polizas}</span>
                </div>
              </div>
            </button>
          ))
        )}
      </div>

      {/* ── Paginación ── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground">
            Página {page} de {totalPages}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  )
}
