'use client'

import { useMemo } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { Bell, Sparkles } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useUIStore } from '@/store'
import { useNotifications } from '@/hooks/use-notifications'
import { GlobalSearch } from './global-search'
import { Button } from '@/components/ui/button'
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
  const { toggleAIAssistant } = useUIStore()
  useNotifications()

  const initials = session?.user?.name
    ?.split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()

  // Fetch deals to count overdue follow-ups
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
    <header className="flex h-16 items-center justify-between border-b px-6">
      <GlobalSearch />

      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={toggleAIAssistant}>
          <Sparkles className="h-5 w-5 text-primary" />
        </Button>

        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {overdueCount > 0 ? (
            <span className="absolute right-1 top-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-white">
              {overdueCount}
            </span>
          ) : (
            <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-muted-foreground/30" />
          )}
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-9 w-9 rounded-full p-0">
              <Avatar className="h-9 w-9">
                <AvatarImage src={session?.user?.image ?? ''} />
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <div className="px-2 py-1.5 text-sm font-medium">{session?.user?.name}</div>
            <div className="px-2 pb-1.5 text-xs text-muted-foreground">{session?.user?.email}</div>
            <DropdownMenuSeparator />
            <DropdownMenuItem>Profile</DropdownMenuItem>
            <DropdownMenuItem>Settings</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive" onClick={() => signOut()}>
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
