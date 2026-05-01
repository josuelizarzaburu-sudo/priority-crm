'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { cn } from '@/lib/utils'
import { useUIStore } from '@/store'
import { signOut } from 'next-auth/react'
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
  TrendingUp,
  X,
  LogOut,
} from 'lucide-react'

const NAV_ITEMS = [
  { href: '/overview',         label: 'Overview',           icon: BarChart3,       roles: ['ADMIN', 'MANAGER'] },
  { href: '/reports',          label: 'Reportes',           icon: TrendingUp,      roles: ['ADMIN', 'MANAGER'] },
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
  const { sidebarCollapsed, toggleSidebar, mobileMenuOpen, toggleMobileMenu, closeMobileMenu } = useUIStore()
  const { data: session } = useSession()
  const role = (session?.user as any)?.role ?? 'MEMBER'

  const visibleItems = NAV_ITEMS.filter((item) => item.roles.includes(role))

  return (
    <>
      {/* Mobile backdrop — click outside to close */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm md:hidden"
          onClick={closeMobileMenu}
          aria-hidden
        />
      )}

      <aside
        className={cn(
          // Base — mobile: fixed full-height drawer
          'fixed inset-y-0 left-0 z-50 flex w-[280px] flex-col border-r bg-card transition-all duration-300',
          // Mobile translate: open or hidden off-screen
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full',
          // Desktop: back in normal flex flow, width based on collapsed state
          'md:relative md:inset-auto md:z-auto md:translate-x-0',
          sidebarCollapsed ? 'md:w-16' : 'md:w-64',
        )}
      >
        {/* Brand header */}
        <div className="flex h-14 items-center border-b px-4 md:h-16">
          {/* Mobile: always show brand + close */}
          <span className="flex-1 text-base font-bold text-primary md:hidden">Priority CRM</span>
          {/* Desktop: show brand only when expanded */}
          {!sidebarCollapsed && (
            <span className="hidden flex-1 text-lg font-bold text-primary md:block">Priority CRM</span>
          )}
          {/* Mobile close button */}
          <button
            onClick={toggleMobileMenu}
            className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted md:hidden"
            aria-label="Cerrar menú"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Mobile: user info strip (replaces header avatar) */}
        <div className="border-b px-4 py-3 md:hidden">
          <p className="text-sm font-semibold leading-tight">
            {session?.user?.name ?? 'Usuario'}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {session?.user?.email ?? ''}
          </p>
        </div>

        {/* Nav items */}
        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {visibleItems.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              onClick={closeMobileMenu}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                'hover:bg-accent hover:text-accent-foreground',
                pathname.startsWith(href)
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground',
              )}
            >
              <Icon className="h-5 w-5 shrink-0" />
              {/* Mobile: always show label. Desktop: hide when collapsed */}
              <span className={cn(sidebarCollapsed ? 'md:hidden' : '', 'block')}>
                {label}
              </span>
            </Link>
          ))}
        </nav>

        {/* Settings link */}
        <div className="border-t p-3">
          <Link
            href="/settings"
            onClick={closeMobileMenu}
            className={cn(
              'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
              'hover:bg-accent hover:text-accent-foreground text-muted-foreground',
              pathname.startsWith('/settings') && 'bg-primary text-primary-foreground',
            )}
          >
            <Settings className="h-5 w-5 shrink-0" />
            <span className={cn(sidebarCollapsed ? 'md:hidden' : '', 'block')}>
              Ajustes
            </span>
          </Link>
        </div>

        {/* Mobile: sign-out button */}
        <div className="border-t p-3 md:hidden">
          <button
            onClick={() => signOut()}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors"
          >
            <LogOut className="h-5 w-5 shrink-0" />
            <span>Cerrar sesión</span>
          </button>
        </div>

        {/* Desktop collapse toggle */}
        <button
          onClick={toggleSidebar}
          className="absolute -right-3 top-20 hidden h-6 w-6 items-center justify-center rounded-full border bg-background shadow-sm hover:bg-accent md:flex"
          aria-label={sidebarCollapsed ? 'Expandir sidebar' : 'Colapsar sidebar'}
        >
          {sidebarCollapsed ? (
            <ChevronRight className="h-3 w-3" />
          ) : (
            <ChevronLeft className="h-3 w-3" />
          )}
        </button>
      </aside>
    </>
  )
}
