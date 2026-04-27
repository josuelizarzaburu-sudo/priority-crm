'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { cn } from '@/lib/utils'
import { useUIStore } from '@/store'
import {
  LayoutDashboard,
  Users,
  MessageSquare,
  Zap,
  Settings,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Phone,
  UserCheck,
  UsersRound,
  BarChart3,
  Kanban,
} from 'lucide-react'

const NAV_ITEMS = [
  { href: '/overview',         label: 'Overview',           icon: BarChart3,       roles: ['ADMIN', 'MANAGER'] },
  { href: '/pipeline',         label: 'Pipeline',           icon: LayoutDashboard, roles: ['ADMIN', 'MANAGER'] },
  { href: '/my-pipeline',      label: 'Mi Pipeline',        icon: Kanban,          roles: ['ADMIN', 'MANAGER', 'MEMBER'] },
  { href: '/leads',            label: 'Leads sin asignar',  icon: UserCheck,       roles: ['ADMIN', 'MANAGER'] },
  { href: '/contacts',         label: 'Contactos',          icon: Users,           roles: ['ADMIN', 'MANAGER', 'MEMBER'] },
  { href: '/communications',   label: 'Comunicaciones',     icon: MessageSquare,   roles: ['ADMIN', 'MANAGER', 'MEMBER'] },
  { href: '/automations',      label: 'Automatizaciones',   icon: Zap,             roles: ['ADMIN', 'MANAGER'] },
  { href: '/calls',            label: 'Llamadas',           icon: Phone,           roles: ['ADMIN', 'MANAGER', 'MEMBER'] },
  { href: '/ai-assistant',     label: 'Asistente IA',       icon: Sparkles,        roles: ['ADMIN', 'MANAGER', 'MEMBER'] },
  { href: '/settings/users',   label: 'Usuarios',           icon: UsersRound,      roles: ['ADMIN', 'MANAGER'] },
]

export function Sidebar() {
  const pathname = usePathname()
  const { sidebarCollapsed, toggleSidebar } = useUIStore()
  const { data: session } = useSession()
  const role = (session?.user as any)?.role ?? 'MEMBER'

  const visibleItems = NAV_ITEMS.filter((item) => item.roles.includes(role))

  return (
    <aside
      className={cn(
        'relative flex flex-col border-r bg-card transition-all duration-300',
        sidebarCollapsed ? 'w-16' : 'w-64',
      )}
    >
      <div className="flex h-16 items-center border-b px-4">
        {!sidebarCollapsed && (
          <span className="text-lg font-bold text-primary">Priority CRM</span>
        )}
      </div>

      <nav className="flex-1 space-y-1 p-3">
        {visibleItems.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              'hover:bg-accent hover:text-accent-foreground',
              pathname.startsWith(href)
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground',
            )}
          >
            <Icon className="h-5 w-5 shrink-0" />
            {!sidebarCollapsed && <span>{label}</span>}
          </Link>
        ))}
      </nav>

      <div className="border-t p-3">
        <Link
          href="/settings"
          className={cn(
            'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
            'hover:bg-accent hover:text-accent-foreground text-muted-foreground',
            pathname.startsWith('/settings') && 'bg-primary text-primary-foreground',
          )}
        >
          <Settings className="h-5 w-5 shrink-0" />
          {!sidebarCollapsed && <span>Ajustes</span>}
        </Link>
      </div>

      <button
        onClick={toggleSidebar}
        className="absolute -right-3 top-20 flex h-6 w-6 items-center justify-center rounded-full border bg-background shadow-sm hover:bg-accent"
      >
        {sidebarCollapsed ? (
          <ChevronRight className="h-3 w-3" />
        ) : (
          <ChevronLeft className="h-3 w-3" />
        )}
      </button>
    </aside>
  )
}
