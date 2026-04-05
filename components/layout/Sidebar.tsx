'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import {
  Users, FolderKanban, LayoutDashboard, Tag,
  CheckSquare, Settings, LogOut, ShieldCheck, Menu, X, UserCircle,
  Send, BarChart3, CalendarDays
} from 'lucide-react'
import { useState, useEffect } from 'react'
import GlobalSearch from '@/components/ui/GlobalSearch'

type NavItem = {
  href: string
  label: string
  icon: React.ComponentType<{ size?: number; className?: string }>
  roles: string[]
}

function WIcon({ size = 18 }: { size?: number }) {
  return (
    <span style={{ fontSize: size, fontWeight: 900, lineHeight: 1, fontFamily: 'system-ui,-apple-system,sans-serif', display: 'inline-block', width: size, textAlign: 'center' }}>
      W
    </span>
  )
}

const navItems: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['super_admin', 'owner', 'manager', 'supervisor', 'agent'] },
  { href: '/dashboard/clients', label: 'Clientes', icon: WIcon, roles: ['super_admin', 'owner', 'manager', 'supervisor', 'agent'] },
  { href: '/dashboard/categories', label: 'Categorías', icon: Tag, roles: ['super_admin', 'owner', 'manager', 'supervisor'] },
  { href: '/dashboard/pipeline', label: 'Pipeline', icon: FolderKanban, roles: ['super_admin', 'owner', 'manager', 'supervisor', 'agent'] },
  { href: '/dashboard/tasks', label: 'Tareas', icon: CheckSquare, roles: ['super_admin', 'owner', 'manager', 'supervisor', 'agent'] },
  { href: '/dashboard/calendar', label: 'Calendario', icon: CalendarDays, roles: ['super_admin', 'owner', 'manager', 'supervisor', 'agent'] },
  { href: '/dashboard/broadcast', label: 'Difusión', icon: Send, roles: ['super_admin', 'owner', 'manager'] },
  { href: '/dashboard/reports', label: 'Reportes', icon: BarChart3, roles: ['super_admin', 'owner', 'manager', 'supervisor'] },
  { href: '/dashboard/team', label: 'Equipo', icon: Users, roles: ['super_admin', 'owner', 'manager', 'supervisor'] },
  { href: '/dashboard/users', label: 'Usuarios', icon: Users, roles: ['super_admin', 'owner'] },
  { href: '/dashboard/settings', label: 'Configuración', icon: Settings, roles: ['super_admin', 'owner'] },
  { href: '/dashboard/profile', label: 'Mi perfil', icon: UserCircle, roles: ['super_admin', 'owner', 'manager', 'supervisor', 'agent'] },
  { href: '/admin', label: 'Super Admin', icon: ShieldCheck, roles: ['super_admin'] },
]

export default function Sidebar() {
  const pathname = usePathname()
  const { profile, signOut } = useAuth()
  const [open, setOpen] = useState(false)
  const [waConnected, setWaConnected] = useState<boolean | null>(null)

  useEffect(() => {
    if (!profile?.orgId) return
    const check = async () => {
      try {
        const res = await fetch(`/api/whatsapp/sessions/${profile.orgId}?orgId=${profile.orgId}`)
        const data = await res.json()
        setWaConnected(data.status === 'open')
      } catch { setWaConnected(false) }
    }
    check()
    const interval = setInterval(check, 30000)
    return () => clearInterval(interval)
  }, [profile?.orgId])

  const visible = navItems.filter(item =>
    profile?.role && item.roles.includes(profile.role)
  )

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">1CRM</h1>
          {waConnected !== null && (
            <div className="flex items-center gap-1.5" title={waConnected ? 'WhatsApp conectado' : 'WhatsApp desconectado'}>
              <span className={`w-2 h-2 rounded-full ${waConnected ? 'bg-green-500' : 'bg-red-400'}`} />
              <span className="text-[10px] text-gray-400">{waConnected ? 'WA' : 'WA ✗'}</span>
            </div>
          )}
        </div>
        <p className="text-xs text-gray-500 mt-1 truncate">{profile?.displayName}</p>
        <span className="inline-block mt-1 text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 capitalize">
          {profile?.role?.replace('_', ' ')}
        </span>
      </div>

      {/* Search */}
      <div className="px-3 pt-3">
        <GlobalSearch />
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {visible.map(item => {
          const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                active
                  ? 'bg-gray-900 text-white'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              }`}
            >
              <item.icon size={18} />
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* Logout */}
      <div className="p-4 border-t border-gray-200">
        <button
          onClick={signOut}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm text-gray-500 hover:bg-red-50 hover:text-red-600 transition-all"
        >
          <LogOut size={18} />
          Cerrar sesión
        </button>
      </div>
    </div>
  )

  return (
    <>
      {/* Mobile toggle */}
      <button
        onClick={() => setOpen(!open)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-white border border-gray-200 rounded-lg text-gray-600 shadow-sm"
      >
        {open ? <X size={20} /> : <Menu size={20} />}
      </button>

      {/* Mobile overlay */}
      {open && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/30"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Mobile sidebar */}
      <aside className={`lg:hidden fixed inset-y-0 left-0 z-40 w-64 bg-white border-r border-gray-200 transform transition-transform ${open ? 'translate-x-0' : '-translate-x-full'}`}>
        <SidebarContent />
      </aside>

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-64 bg-white border-r border-gray-200 fixed inset-y-0 left-0">
        <SidebarContent />
      </aside>
    </>
  )
}
