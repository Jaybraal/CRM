'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import {
  Users, FolderKanban, LayoutDashboard, Tag,
  CheckSquare, Settings, LogOut, ShieldCheck, Menu, X,
  Send, BarChart3, CalendarDays, Instagram, ShoppingBag, Building2
} from 'lucide-react'
import { useState } from 'react'

type NavItem = {
  href: string
  label: string
  icon: React.ComponentType<{ size?: number; className?: string }>
  roles: string[]
  badge?: string
}

const NAV_GROUPS: NavItem[][] = [
  [
    { href: '/dashboard',            label: 'Dashboard',   icon: LayoutDashboard, roles: ['super_admin', 'owner', 'manager', 'supervisor', 'agent'] },
    { href: '/dashboard/clients',    label: 'Clientes',    icon: Users,           roles: ['super_admin', 'owner', 'manager', 'supervisor', 'agent'] },
    { href: '/dashboard/pipeline',   label: 'Pipeline',    icon: FolderKanban,    roles: ['super_admin', 'owner', 'manager', 'supervisor', 'agent'] },
    { href: '/dashboard/tasks',      label: 'Tareas',      icon: CheckSquare,     roles: ['super_admin', 'owner', 'manager', 'supervisor', 'agent'] },
    { href: '/dashboard/calendar',   label: 'Calendario',  icon: CalendarDays,    roles: ['super_admin', 'owner', 'manager', 'supervisor', 'agent'] },
  ],
  [
    { href: '/dashboard/catalog',    label: 'Catálogo',    icon: ShoppingBag,     roles: ['super_admin', 'owner', 'manager', 'supervisor', 'agent'] },
    { href: '/dashboard/broadcast',  label: 'Difusión',    icon: Send,            roles: ['super_admin', 'owner', 'manager'] },
    { href: '/dashboard/instagram',  label: 'Instagram',   icon: Instagram,       roles: ['super_admin', 'owner', 'manager', 'supervisor', 'agent'] },
  ],
  [
    { href: '/dashboard/reports',    label: 'Reportes',    icon: BarChart3,       roles: ['super_admin', 'owner', 'manager', 'supervisor'] },
    { href: '/dashboard/categories', label: 'Categorías',  icon: Tag,             roles: ['super_admin', 'owner', 'manager', 'supervisor'] },
    { href: '/dashboard/team',       label: 'Equipo',      icon: Users,           roles: ['super_admin', 'owner', 'manager', 'supervisor'] },
    { href: '/dashboard/settings',   label: 'Ajustes',     icon: Settings,        roles: ['super_admin', 'owner'] },
    { href: '/admin',                label: 'Super Admin', icon: ShieldCheck,     roles: ['super_admin'] },
  ],
]

export default function Sidebar() {
  const pathname = usePathname()
  const { profile, signOut } = useAuth()
  const [open, setOpen] = useState(false)

  const initials = profile?.displayName
    ? profile.displayName.split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase()
    : 'U'

  const SidebarContent = () => (
    <div className="flex flex-col h-full bg-white dark:bg-slate-900">

      {/* Logo */}
      <div className="flex items-center justify-between px-5 h-16 border-b border-slate-100 dark:border-slate-800 flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white shadow shadow-blue-500/30 flex-shrink-0">
            <Building2 size={16} />
          </div>
          <span className="text-base font-black text-slate-900 dark:text-white tracking-tight">NEXO</span>
        </div>
        <button className="lg:hidden text-slate-400 hover:text-slate-600 p-1" onClick={() => setOpen(false)}>
          <X size={18} />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
        {NAV_GROUPS.map((group, gi) => {
          const visible = group.filter(item => profile?.role && item.roles.includes(profile.role))
          if (visible.length === 0) return null
          return (
            <div key={gi}>
              {gi > 0 && <div className="my-3 border-t border-slate-100 dark:border-slate-800" />}
              {visible.map(item => {
                const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      active
                        ? 'bg-blue-600 text-white'
                        : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <item.icon size={16} className={active ? 'text-white' : 'text-slate-400 dark:text-slate-500'} />
                      {item.label}
                    </div>
                    {item.badge && (
                      <span className={`text-[10px] py-0.5 px-1.5 rounded-full font-bold ${active ? 'bg-white/20 text-white' : 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400'}`}>
                        {item.badge}
                      </span>
                    )}
                  </Link>
                )
              })}
            </div>
          )
        })}
      </nav>

      {/* Footer: user + logout */}
      <div className="px-3 pb-4 pt-2 border-t border-slate-100 dark:border-slate-800 flex-shrink-0">
        <Link
          href="/dashboard/profile"
          onClick={() => setOpen(false)}
          className={`flex items-center gap-3 px-3 py-2.5 rounded-lg mb-1 transition-colors ${
            pathname === '/dashboard/profile'
              ? 'bg-blue-600 text-white'
              : 'hover:bg-slate-50 dark:hover:bg-slate-800'
          }`}
        >
          <div className="w-7 h-7 rounded-md bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-slate-700 dark:text-slate-200 truncate leading-tight">{profile?.displayName}</p>
            <p className="text-[10px] text-slate-400 capitalize leading-tight">{profile?.role?.replace('_', ' ')}</p>
          </div>
        </Link>
        <button
          onClick={signOut}
          className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm text-slate-400 dark:text-slate-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
        >
          <LogOut size={15} />
          <span className="text-sm">Cerrar sesión</span>
        </button>
      </div>
    </div>
  )

  return (
    <>
      <button
        onClick={() => setOpen(!open)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-600 shadow-sm"
      >
        {open ? <X size={18} /> : <Menu size={18} />}
      </button>

      {open && (
        <div className="lg:hidden fixed inset-0 z-40 bg-black/30 backdrop-blur-sm" onClick={() => setOpen(false)} />
      )}

      <aside className={`lg:hidden fixed inset-y-0 left-0 z-40 w-64 border-r border-slate-200 dark:border-slate-800 transform transition-transform ${open ? 'translate-x-0' : '-translate-x-full'}`}>
        <SidebarContent />
      </aside>

      <aside className="hidden lg:flex flex-col w-64 border-r border-slate-200 dark:border-slate-800 fixed inset-y-0 left-0">
        <SidebarContent />
      </aside>
    </>
  )
}
