'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { LayoutDashboard, Users, BarChart3, MoreHorizontal, Kanban } from 'lucide-react'
import { useUIStore } from '@/store'
import { cn } from '@/lib/utils'

export function BottomNav() {
  const pathname = usePathname()
  const { data: session } = useSession()
  const { toggleMobileMenu } = useUIStore()
  const role = (session?.user as any)?.role ?? 'MEMBER'

  const isAdmin = role === 'ADMIN' || role === 'MANAGER'

  // Pipeline href and icon differ by role
  const pipelineHref  = isAdmin ? '/pipeline'     : '/my-pipeline'
  const pipelineLabel = isAdmin ? 'Pipeline'       : 'Mi Pipeline'
  const PipelineIcon  = isAdmin ? LayoutDashboard  : Kanban

  type Tab = {
    href: string
    label: string
    icon: React.ElementType
    match: string   // prefix used for active detection
    hidden?: boolean
  }

  const tabs: Tab[] = [
    {
      href: pipelineHref,
      label: pipelineLabel,
      icon: PipelineIcon,
      match: isAdmin ? '/pipeline' : '/my-pipeline',
    },
    {
      href: '/contacts',
      label: 'Contactos',
      icon: Users,
      match: '/contacts',
    },
    {
      href: '/overview',
      label: 'Overview',
      icon: BarChart3,
      match: '/overview',
      hidden: !isAdmin,
    },
  ]

  const visibleTabs = tabs.filter((t) => !t.hidden)

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-30 border-t bg-card md:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="flex h-16">
        {/* Nav tabs */}
        {visibleTabs.map(({ href, label, icon: Icon, match }) => {
          const active = pathname.startsWith(match)
          return (
            <Link
              key={href}
              href={href}
              className="flex flex-1 flex-col items-center justify-center gap-1 transition-colors"
            >
              <div
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-xl transition-all',
                  active ? 'bg-primary/12' : '',
                )}
              >
                <Icon
                  className={cn(
                    'h-5 w-5 transition-colors',
                    active ? 'text-primary' : 'text-muted-foreground',
                  )}
                />
              </div>
              <span
                className={cn(
                  'text-[10px] font-semibold leading-none',
                  active ? 'text-primary' : 'text-muted-foreground',
                )}
              >
                {label}
              </span>
            </Link>
          )
        })}

        {/* More button — opens sidebar drawer */}
        <button
          onClick={toggleMobileMenu}
          className="flex flex-1 flex-col items-center justify-center gap-1 transition-colors"
          aria-label="Menú"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-xl">
            <MoreHorizontal className="h-5 w-5 text-muted-foreground" />
          </div>
          <span className="text-[10px] font-semibold leading-none text-muted-foreground">Más</span>
        </button>
      </div>
    </nav>
  )
}
