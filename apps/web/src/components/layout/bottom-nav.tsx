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

  const pipelineHref  = isAdmin ? '/pipeline'    : '/my-pipeline'
  const pipelineLabel = isAdmin ? 'Pipeline'      : 'Mi Pipeline'
  const PipelineIcon  = isAdmin ? LayoutDashboard : Kanban

  type Tab = {
    href: string
    label: string
    icon: React.ElementType
    match: string
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
      className="fixed bottom-0 left-0 right-0 z-30 border-t border-[#e8eaef] bg-white shadow-[0_-1px_8px_rgba(37,50,75,0.08)] md:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="flex h-16">
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
                  active ? 'bg-[#25324b]' : 'bg-transparent',
                )}
              >
                <Icon
                  className={cn(
                    'h-[18px] w-[18px] transition-colors',
                    active ? 'text-[#d3ac76]' : 'text-[#25324b]/45',
                  )}
                />
              </div>
              <span
                className={cn(
                  'text-[10px] font-semibold leading-none',
                  active ? 'text-[#25324b]' : 'text-[#25324b]/45',
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
            <MoreHorizontal className="h-[18px] w-[18px] text-[#25324b]/45" />
          </div>
          <span className="text-[10px] font-semibold leading-none text-[#25324b]/45">Más</span>
        </button>
      </div>
    </nav>
  )
}
