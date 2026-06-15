'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import {
  LayoutDashboard, Inbox, KanbanSquare, CalendarDays,
  Package, MessageSquare, Zap, Settings,
  ShieldCheck, LogOut, Bot, Menu, X, Send
} from 'lucide-react'
import { useState } from 'react'

type NavItem = {
  href: string
  label: string
  icon: React.ComponentType<{ size?: number; className?: string }>
  roles: string[]
  badge?: number
}

const NAV_SECTIONS: NavItem[][] = [
  // Core — acciones diarias
  [
    { href: '/dashboard',          label: 'Dashboard',    icon: LayoutDashboard, roles: ['super_admin','owner','manager','supervisor','agent'] },
    { href: '/dashboard/inbox',    label: 'Inbox WA/IG',  icon: Inbox,           roles: ['super_admin','owner','manager','supervisor','agent'] },
    { href: '/dashboard/pipeline', label: 'Pipeline',     icon: KanbanSquare,    roles: ['super_admin','owner','manager','supervisor','agent'] },
    { href: '/dashboard/calendar', label: 'Calendario',   icon: CalendarDays,    roles: ['super_admin','owner','manager','supervisor','agent'] },
  ],
  // Ventas
  [
    { href: '/dashboard/catalog',   label: 'Catálogo',   icon: Package, roles: ['super_admin','owner','manager','supervisor','agent'] },
    { href: '/dashboard/broadcast', label: 'Broadcasts', icon: Send,    roles: ['super_admin','owner','manager'] },
  ],
  // Equipo
  [
    { href: '/dashboard/nexo', label: 'Nexo Connect', icon: MessageSquare, roles: ['super_admin','owner','manager','supervisor','agent'] },
  ],
  // Configuración
  [
    { href: '/dashboard/marketplace', label: 'Blueprints',  icon: Zap,        roles: ['super_admin','owner'] },
    { href: '/dashboard/settings',    label: 'Ajustes',     icon: Settings,   roles: ['super_admin','owner'] },
    { href: '/admin',                 label: 'Super Admin', icon: ShieldCheck, roles: ['super_admin'] },
  ],
]

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <Link
      href={item.href}
      className={`relative w-full flex justify-center p-3 rounded-xl transition-all duration-200 group mb-1 ${
        active
          ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
          : 'text-slate-400 hover:bg-slate-800 hover:text-white'
      }`}
    >
      <item.icon size={20} />
      {item.badge !== undefined && (
        <span className="absolute top-1.5 right-1.5 flex h-4 w-4">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-4 w-4 bg-red-500 text-[9px] font-bold text-white items-center justify-center">
            {item.badge}
          </span>
        </span>
      )}
      <span className="absolute left-[4.5rem] bg-slate-800 text-white text-xs px-2.5 py-1.5 rounded-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 shadow-lg border border-slate-700">
        {item.label}
      </span>
    </Link>
  )
}

export default function Sidebar() {
  const pathname = usePathname()
  const { profile, signOut } = useAuth()
  const [mobileOpen, setMobileOpen] = useState(false)

  const initials = profile?.displayName
    ? profile.displayName.split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase()
    : 'U'

  const isActive = (href: string) =>
    pathname === href || (href !== '/dashboard' && pathname.startsWith(href))

  const SidebarBody = ({ onNavigate }: { onNavigate?: () => void }) => (
    <>
      {/* Logo */}
      <div className="flex justify-center items-center h-16 border-b border-slate-800 flex-shrink-0">
        <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white font-black text-sm shadow-lg shadow-blue-500/20 select-none">
          NX
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 flex flex-col items-center gap-0 px-3">
        {NAV_SECTIONS.map((section, si) => {
          const visible = section.filter(item => profile?.role && item.roles.includes(profile.role))
          if (!visible.length) return null
          return (
            <div key={si} className="w-full">
              {si > 0 && <div className="w-8 h-px bg-slate-800 my-2 mx-auto" />}
              {visible.map(item => (
                <div key={item.href} onClick={onNavigate}>
                  <NavLink item={item} active={isActive(item.href)} />
                </div>
              ))}
            </div>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-slate-800 py-3 flex flex-col items-center gap-1 px-3">
        <div className="relative group w-full flex justify-center p-3 rounded-xl text-blue-400 cursor-default">
          <Bot size={18} />
          <span className="absolute left-[4.5rem] bg-slate-800 text-white text-xs px-2.5 py-1.5 rounded-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 shadow-lg border border-slate-700">
            Alex IA: Activo
          </span>
        </div>
        <button
          onClick={signOut}
          className="relative group w-full flex justify-center p-3 rounded-xl text-slate-400 hover:bg-red-900/30 hover:text-red-400 transition-colors"
        >
          <LogOut size={18} />
          <span className="absolute left-[4.5rem] bg-slate-800 text-white text-xs px-2.5 py-1.5 rounded-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 shadow-lg border border-slate-700">
            Cerrar sesión
          </span>
        </button>
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-black text-xs shadow-md cursor-pointer hover:scale-105 transition-transform select-none">
          {initials}
        </div>
      </div>
    </>
  )

  return (
    <>
      {/* Mobile hamburger */}
      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-300 shadow-lg"
      >
        {mobileOpen ? <X size={18} /> : <Menu size={18} />}
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile drawer */}
      <aside className={`lg:hidden fixed inset-y-0 left-0 z-40 w-20 bg-slate-900 flex flex-col shadow-2xl transform transition-transform duration-300 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <SidebarBody onNavigate={() => setMobileOpen(false)} />
      </aside>

      {/* Desktop fixed sidebar */}
      <aside className="hidden lg:flex flex-col w-20 bg-slate-900 fixed inset-y-0 left-0 z-30 shadow-2xl">
        <SidebarBody />
      </aside>
    </>
  )
}
