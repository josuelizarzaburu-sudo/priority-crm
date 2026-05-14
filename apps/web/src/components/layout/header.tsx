'use client'

import { useMemo } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { Bell, Sparkles, Menu } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useUIStore } from '@/store'
import { useNotifications } from '@/hooks/use-notifications'
import { GlobalSearch } from './global-search'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { api } from '@/lib/api'

export function Header() {
  const { data: session } = useSession()
  const { toggleAIAssistant, toggleMobileMenu } = useUIStore()
  useNotifications()

  const initials = session?.user?.name
    ?.split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()

  const { data: deals } = useQuery<any[]>({
    queryKey: ['pipeline', 'deals-all'],
    queryFn: () => api.get('/pipeline/deals').then((r) => r.data),
    staleTime: 60_000,
  })

  const overdueCount = useMemo(() => {
    if (!deals) return 0
    const now = new Date()
    return deals.filter((d) => {
      const followUpAt = d.customFields?.followUpAt as string | undefined
      return followUpAt && new Date(followUpAt) < now && d.status === 'OPEN'
    }).length
  }, [deals])

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-[#e8eaef] bg-white px-3 shadow-[0_1px_3px_rgba(37,50,75,0.06)] md:h-16 md:justify-between md:px-6">

      {/* ── Mobile: hamburger + logo ──────────────────────────────────── */}
      <button
        onClick={toggleMobileMenu}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[#25324b]/60 hover:bg-[#f0f2f7] hover:text-[#25324b] md:hidden"
        aria-label="Abrir menú"
      >
        <Menu className="h-5 w-5" />
      </button>

      <div className="flex flex-1 md:hidden">
        <GlobalSearch className="w-full" />
      </div>

      {/* ── Desktop: search (left) ────────────────────────────────────── */}
      <div className="hidden md:block">
        <GlobalSearch />
      </div>

      {/* ── Desktop: action icons (right) ────────────────────────────── */}
      <div className="hidden items-center gap-2 md:flex">
        {/* AI Assistant */}
        <button
          onClick={toggleAIAssistant}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-[#25324b]/60 transition-all hover:bg-[#25324b] hover:text-[#d3ac76]"
          title="Asistente IA"
        >
          <Sparkles className="h-[18px] w-[18px]" />
        </button>

        {/* Notifications */}
        <button className="relative flex h-9 w-9 items-center justify-center rounded-lg text-[#25324b]/60 transition-all hover:bg-[#f0f2f7] hover:text-[#25324b]">
          <Bell className="h-[18px] w-[18px]" />
          {overdueCount > 0 ? (
            <span className="absolute right-1.5 top-1.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
              {overdueCount}
            </span>
          ) : (
            <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-[#25324b]/15" />
          )}
        </button>

        {/* Divider */}
        <div className="h-6 w-px bg-[#e8eaef]" />

        {/* User avatar + dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition-all hover:bg-[#f0f2f7]">
              <Avatar className="h-8 w-8 ring-2 ring-[#25324b]/10">
                <AvatarImage src={session?.user?.image ?? ''} />
                <AvatarFallback className="bg-[#25324b] text-[11px] font-semibold text-[#d3ac76]">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="hidden text-left lg:block">
                <p className="text-xs font-semibold leading-tight text-[#25324b]">
                  {session?.user?.name?.split(' ')[0]}
                </p>
                <p className="text-[10px] leading-tight text-[#25324b]/50">
                  {(session?.user as any)?.role ?? 'Member'}
                </p>
              </div>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52 border-[#e8eaef] shadow-lg">
            <div className="px-3 py-2">
              <p className="text-sm font-semibold text-[#25324b]">{session?.user?.name}</p>
              <p className="text-xs text-[#25324b]/50">{session?.user?.email}</p>
            </div>
            <DropdownMenuSeparator className="bg-[#e8eaef]" />
            <DropdownMenuItem className="cursor-pointer">Perfil</DropdownMenuItem>
            <DropdownMenuItem className="cursor-pointer">Configuración</DropdownMenuItem>
            <DropdownMenuSeparator className="bg-[#e8eaef]" />
            <DropdownMenuItem
              className="cursor-pointer text-red-500 focus:text-red-600"
              onClick={() => signOut()}
            >
              Cerrar sesión
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
