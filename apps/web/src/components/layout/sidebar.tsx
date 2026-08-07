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
  UserCheck,
  UsersRound,
  BarChart3,
  Kanban,
  TrendingUp,
  Activity,
  CalendarDays,
  DollarSign,
  PlayCircle,
  FileSpreadsheet,
  Calculator,
  ClipboardList,
  FileText,
  X,
  LogOut,
  Trophy,
  ShieldCheck,
  ClipboardCheck,
  CalendarClock,
} from 'lucide-react'

const ELEVATED = ['SUPER_ADMIN', 'OWNER', 'MANAGER']
const ALL_ROLES = ['SUPER_ADMIN', 'OWNER', 'MANAGER', 'SALES_REP']
// Perfiles del area de Operaciones. No ven Pipeline ni Leads (eso es comercial),
// pero si la base de Clientes, el cotizador y las herramientas comunes.
const OPS = ['OPERACIONES', 'JEFE_OPERACIONES']
// Quien administra el area operativa. Incluye a OWNER porque Pablo es el dueño
// pero tambien trabaja en operaciones; sin esto no veia Clientes ni Reembolsos.
const OPS_ADMIN = [...OPS, 'SUPER_ADMIN', 'OWNER']
const COMUNES = [...ALL_ROLES, ...OPS]


const NAV_ITEMS = [
  { href: '/clientes',         label: 'Clientes',           icon: ClipboardList,   roles: OPS_ADMIN },
  { href: '/reclamos',         label: 'Reembolsos',         icon: FileText,        roles: OPS_ADMIN },
  { href: '/requerimientos',   label: 'Requerimientos',      icon: ClipboardCheck,  roles: OPS_ADMIN },
  { href: '/renovaciones',     label: 'Renovaciones',        icon: CalendarClock,   roles: OPS_ADMIN },
  { href: '/reportes-operaciones', label: 'Reportes Operaciones', icon: FileSpreadsheet, roles: OPS_ADMIN },
  { href: '/overview',         label: 'Overview',           icon: BarChart3,       roles: ELEVATED },
  { href: '/reports',          label: 'Reportes',           icon: TrendingUp,      roles: ELEVATED },
  { href: '/registro-acceso',  label: 'Registro de acceso', icon: ShieldCheck,     roles: ['SUPER_ADMIN', 'OWNER'] },
  { href: '/ranking',          label: 'Ranking',            icon: Trophy,          roles: ALL_ROLES },
  { href: '/commissions',      label: 'Comisiones',         icon: DollarSign,      roles: ['SUPER_ADMIN'] },
  { href: '/pipeline',         label: 'Pipeline',           icon: LayoutDashboard, roles: ALL_ROLES },
  { href: '/my-pipeline',      label: 'Mi Pipeline',        icon: Kanban,          roles: ['SUPER_ADMIN', 'OWNER', 'SALES_REP'] },
  { href: '/my-performance',   label: 'Mi Rendimiento',     icon: Activity,        roles: ['SALES_REP', 'OWNER', 'SUPER_ADMIN'] },
  { href: '/leads',            label: 'Leads sin asignar',  icon: UserCheck,       roles: ELEVATED },
  { href: '/contacts',         label: 'Contactos',          icon: Users,           roles: COMUNES },
  { href: '/calendar',         label: 'Calendario',         icon: CalendarDays,    roles: COMUNES },
  { href: '/communications',   label: 'Comunicaciones',     icon: MessageSquare,   roles: COMUNES },
  { href: '/comparativos',     label: 'Comparativos',       icon: FileSpreadsheet, roles: [...COMUNES, 'SUPER_ADMIN'] },
  { href: '/cotizador',        label: 'Cotizador',          icon: Calculator,      roles: [...COMUNES, 'SUPER_ADMIN'] },
  { href: '/training',         label: 'Capacitaciones',     icon: PlayCircle,      roles: COMUNES },
  { href: '/automations',      label: 'Automatizaciones',   icon: Zap,             roles: ELEVATED },
  { href: '/settings/users',   label: 'Usuarios',           icon: UsersRound,      roles: ELEVATED },
]

export function Sidebar() {
  const pathname = usePathname()
  const { sidebarCollapsed, toggleSidebar, mobileMenuOpen, toggleMobileMenu, closeMobileMenu } = useUIStore()
  const { data: session } = useSession()
  const role = (session?.user as any)?.role ?? 'SALES_REP'

  const visibleItems = NAV_ITEMS.filter((item) => item.roles.includes(role))
  // Ajustes queda solo para administracion. Un vendedor o una ejecutiva no debe
  // poder cambiar su propia clave ni tocar su perfil: eso lo maneja el admin.
  const puedeVerAjustes = ['SUPER_ADMIN', 'OWNER'].includes(role)

  const navItemClass = (href: string) =>
    cn(
      'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150',
      pathname.startsWith(href)
        ? 'bg-white/12 text-[#d3ac76] border-l-2 border-[#d3ac76]'
        : 'text-white/65 hover:bg-white/8 hover:text-white border-l-2 border-transparent',
    )

  return (
    <>
      {/* Mobile backdrop */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
          onClick={closeMobileMenu}
          aria-hidden
        />
      )}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex flex-col transition-all duration-300',
          'bg-[#25324b]',
          'w-[280px]',
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full',
          'md:relative md:inset-auto md:z-auto md:translate-x-0',
          sidebarCollapsed ? 'md:w-16' : 'md:w-64',
        )}
      >
        {/* Brand header */}
        <div
          className={cn(
            'flex h-14 shrink-0 items-center border-b border-white/8 md:h-16',
            sidebarCollapsed ? 'md:justify-center md:px-0' : 'px-5',
          )}
        >
          {/* Mobile: logo + close */}
          <div className="flex flex-1 items-center gap-2 md:hidden">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[#d3ac76]">
              <span className="text-xs font-black text-[#25324b]">P</span>
            </div>
            <span className="text-base font-semibold tracking-wide text-[#d3ac76]">Priority CRM</span>
          </div>

          {/* Desktop expanded */}
          {!sidebarCollapsed && (
            <div className="hidden flex-1 items-center gap-2.5 md:flex">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[#d3ac76]">
                <span className="text-xs font-black text-[#25324b]">P</span>
              </div>
              <div className="leading-tight">
                <p className="text-sm font-semibold tracking-wide text-[#d3ac76]">Priority</p>
                <p className="text-[10px] font-medium uppercase tracking-widest text-white/40">CRM</p>
              </div>
            </div>
          )}

          {/* Desktop collapsed: just the P badge */}
          {sidebarCollapsed && (
            <div className="hidden md:flex md:items-center md:justify-center">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[#d3ac76]">
                <span className="text-xs font-black text-[#25324b]">P</span>
              </div>
            </div>
          )}

          {/* Mobile close */}
          <button
            onClick={toggleMobileMenu}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-white/60 hover:bg-white/10 hover:text-white md:hidden"
            aria-label="Cerrar menú"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Mobile: user info */}
        <div className="border-b border-white/8 px-4 py-3 md:hidden">
          <p className="text-sm font-semibold leading-tight text-white">
            {session?.user?.name ?? 'Usuario'}
          </p>
          <p className="mt-0.5 text-xs text-white/45">
            {session?.user?.email ?? ''}
          </p>
        </div>

        {/* Nav items */}
        <nav className="sidebar-scroll flex-1 space-y-0.5 overflow-y-auto px-3 py-3">
          {visibleItems.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              onClick={closeMobileMenu}
              className={navItemClass(href)}
              title={sidebarCollapsed ? label : undefined}
            >
              <Icon className="h-[18px] w-[18px] shrink-0" />
              <span className={cn(sidebarCollapsed ? 'md:hidden' : '', 'block')}>
                {label}
              </span>
            </Link>
          ))}
        </nav>

        {/* Divider */}
        {puedeVerAjustes && <div className="mx-3 h-px bg-white/8" />}

        {/* Settings — solo administracion */}
        {puedeVerAjustes && (
          <div className="px-3 py-3">
            <Link
              href="/settings"
              onClick={closeMobileMenu}
              className={navItemClass('/settings')}
              title={sidebarCollapsed ? 'Ajustes' : undefined}
            >
              <Settings className="h-[18px] w-[18px] shrink-0" />
              <span className={cn(sidebarCollapsed ? 'md:hidden' : '', 'block')}>
                Ajustes
              </span>
            </Link>
          </div>
        )}

        {/* Mobile: sign-out */}
        <div className="border-t border-white/8 px-3 py-3 md:hidden">
          <button
            onClick={() => signOut()}
            className="flex w-full items-center gap-3 rounded-lg border-l-2 border-transparent px-3 py-2.5 text-sm font-medium text-red-400 transition-all hover:bg-white/8 hover:text-red-300"
          >
            <LogOut className="h-[18px] w-[18px] shrink-0" />
            <span>Cerrar sesión</span>
          </button>
        </div>

        {/* Desktop collapse toggle */}
        <button
          onClick={toggleSidebar}
          className="absolute -right-3 top-20 hidden h-6 w-6 items-center justify-center rounded-full border border-[#25324b]/20 bg-white shadow-sm hover:bg-[#f0f2f7] md:flex"
          aria-label={sidebarCollapsed ? 'Expandir sidebar' : 'Colapsar sidebar'}
        >
          {sidebarCollapsed ? (
            <ChevronRight className="h-3 w-3 text-[#25324b]" />
          ) : (
            <ChevronLeft className="h-3 w-3 text-[#25324b]" />
          )}
        </button>
      </aside>
    </>
  )
}
