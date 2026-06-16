'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { useAlexChat } from '@/context/AlexChatContext'
import {
  LayoutDashboard, Inbox, KanbanSquare, CalendarDays,
  Package, MessageSquare, Zap, Settings,
  ShieldCheck, LogOut, Bot, Menu, X
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
  [
    { href: '/dashboard',          label: 'Dashboard',    icon: LayoutDashboard, roles: ['super_admin','owner','manager','supervisor','agent'] },
    { href: '/dashboard/inbox',    label: 'Inbox WA/IG',  icon: Inbox,           roles: ['super_admin','owner','manager','supervisor','agent'] },
    { href: '/dashboard/pipeline', label: 'Pipeline',     icon: KanbanSquare,    roles: ['super_admin','owner','manager','supervisor','agent'] },
    { href: '/dashboard/calendar', label: 'Calendario',   icon: CalendarDays,    roles: ['super_admin','owner','manager','supervisor','agent'] },
  ],
  [
    { href: '/dashboard/catalog', label: 'Catálogo', icon: Package, roles: ['super_admin','owner','manager','supervisor','agent'] },
  ],
  [
    { href: '/dashboard/nexo', label: 'Nexo Connect', icon: MessageSquare, roles: ['super_admin','owner','manager','supervisor','agent'] },
  ],
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
      className={`relative w-full flex justify-center py-3 transition-colors duration-150 group mb-0.5 ${
        active
          ? 'text-white'
          : 'text-white/35 hover:text-white/70 hover:bg-white/[0.04]'
      }`}
    >
      {active && (
        <>
          <span className="absolute left-0 inset-y-1.5 w-[3px] bg-[#0D7A65] rounded-r-full" />
          <span className="absolute inset-0 bg-white/[0.06]" />
        </>
      )}
      {item.badge !== undefined && (
        <span className="absolute top-2 right-2 flex h-4 w-4">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-4 w-4 bg-red-500 text-[9px] font-bold text-white items-center justify-center">
            {item.badge}
          </span>
        </span>
      )}
      <item.icon size={18} className="relative z-10" />
      <span className="absolute left-full ml-3 bg-[#1B2B4B] text-white text-xs px-2.5 py-1.5 rounded opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 shadow-lg border border-white/10">
        {item.label}
      </span>
    </Link>
  )
}

export default function Sidebar() {
  const pathname = usePathname()
  const { profile, signOut } = useAuth()
  const { toggle: toggleAlex } = useAlexChat()
  const [mobileOpen, setMobileOpen] = useState(false)

  const initials = profile?.displayName
    ? profile.displayName.split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase()
    : 'U'

  const isActive = (href: string) =>
    pathname === href || (href !== '/dashboard' && pathname.startsWith(href))

  const SidebarBody = ({ onNavigate }: { onNavigate?: () => void }) => (
    <>
      {/* Logo */}
      <div className="flex justify-center items-center h-14 border-b border-white/[0.06] flex-shrink-0">
        <span className="text-white font-bold text-sm tracking-[0.2em] select-none">NX</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 flex flex-col items-center px-0">
        {NAV_SECTIONS.map((section, si) => {
          const visible = section.filter(item => profile?.role && item.roles.includes(profile.role))
          if (!visible.length) return null
          return (
            <div key={si} className="w-full">
              {si > 0 && <div className="w-6 h-px bg-white/[0.07] my-2 mx-auto" />}
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
      <div className="border-t border-white/[0.06] py-3 flex flex-col items-center gap-1">
        <button
          onClick={() => { toggleAlex(); onNavigate?.() }}
          className="relative group w-full flex justify-center py-3 text-[#0D7A65] hover:bg-white/[0.04] hover:text-[#0fad8e] transition-colors"
        >
          <Bot size={17} />
          <span className="absolute left-full ml-3 bg-[#1B2B4B] text-white text-xs px-2.5 py-1.5 rounded opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 shadow-lg border border-white/10">
            Alex IA
          </span>
        </button>
        <button
          onClick={signOut}
          className="relative group w-full flex justify-center py-3 text-white/30 hover:bg-red-900/20 hover:text-red-400 transition-colors"
        >
          <LogOut size={17} />
          <span className="absolute left-full ml-3 bg-[#1B2B4B] text-white text-xs px-2.5 py-1.5 rounded opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 shadow-lg border border-white/10">
            Cerrar sesión
          </span>
        </button>
        <div className="w-8 h-8 rounded-md bg-[#0D7A65] flex items-center justify-center text-white font-semibold text-xs cursor-pointer hover:bg-[#0B6B57] transition-colors select-none mt-1">
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
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-[#0C1224] border border-white/10 rounded text-white/60 shadow-lg"
      >
        {mobileOpen ? <X size={16} /> : <Menu size={16} />}
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile drawer */}
      <aside className={`lg:hidden fixed inset-y-0 left-0 z-40 w-16 bg-[#0C1224] flex flex-col shadow-2xl transform transition-transform duration-300 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <SidebarBody onNavigate={() => setMobileOpen(false)} />
      </aside>

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-16 bg-[#0C1224] fixed inset-y-0 left-0 z-30">
        <SidebarBody />
      </aside>
    </>
  )
}
