'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import {
  Users, FolderKanban, LayoutDashboard, Tag,
  CheckSquare, Settings, LogOut, ShieldCheck, Menu, X, UserCircle,
  Send, BarChart3, CalendarDays, Instagram, ShoppingBag, Building2,
  MessageSquare
} from 'lucide-react'
import { useState, useEffect } from 'react'

type NavItem = {
  href: string
  label: string
  icon: React.ComponentType<{ size?: number; className?: string }>
  roles: string[]
  badge?: string
}

function WIcon({ size = 18 }: { size?: number }) {
  return (
    <MessageSquare size={size} />
  )
}

const NAV_SECTIONS = [
  {
    label: 'Gestión Central',
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['super_admin', 'owner', 'manager', 'supervisor', 'agent'] },
      { href: '/dashboard/clients', label: 'Clientes', icon: WIcon, roles: ['super_admin', 'owner', 'manager', 'supervisor', 'agent'] },
      { href: '/dashboard/pipeline', label: 'Pipeline Ventas', icon: FolderKanban, roles: ['super_admin', 'owner', 'manager', 'supervisor', 'agent'] },
      { href: '/dashboard/tasks', label: 'Tareas', icon: CheckSquare, roles: ['super_admin', 'owner', 'manager', 'supervisor', 'agent'] },
      { href: '/dashboard/calendar', label: 'Calendario', icon: CalendarDays, roles: ['super_admin', 'owner', 'manager', 'supervisor', 'agent'] },
      { href: '/dashboard/catalog', label: 'Catálogo', icon: ShoppingBag, roles: ['super_admin', 'owner', 'manager', 'supervisor', 'agent'] },
    ] as NavItem[],
  },
  {
    label: 'Comunicación',
    items: [
      { href: '/dashboard/inbox', label: 'Bandeja Central', icon: MessageSquare, roles: ['super_admin', 'owner', 'manager', 'supervisor', 'agent'], badge: '12' },
      { href: '/dashboard/instagram', label: 'Campañas IG', icon: Instagram, roles: ['super_admin', 'owner', 'manager', 'supervisor', 'agent'] },
      { href: '/dashboard/broadcast', label: 'Difusión', icon: Send, roles: ['super_admin', 'owner', 'manager'] },
    ] as NavItem[],
  },
  {
    label: 'Análisis',
    items: [
      { href: '/dashboard/reports', label: 'Reportes', icon: BarChart3, roles: ['super_admin', 'owner', 'manager', 'supervisor'] },
      { href: '/dashboard/categories', label: 'Categorías', icon: Tag, roles: ['super_admin', 'owner', 'manager', 'supervisor'] },
    ] as NavItem[],
  },
  {
    label: 'Admin',
    items: [
      { href: '/dashboard/team', label: 'Equipo', icon: Users, roles: ['super_admin', 'owner', 'manager', 'supervisor'] },
      { href: '/dashboard/users', label: 'Usuarios', icon: Users, roles: ['super_admin', 'owner'] },
      { href: '/dashboard/settings', label: 'Configuración', icon: Settings, roles: ['super_admin', 'owner'] },
      { href: '/dashboard/profile', label: 'Mi perfil', icon: UserCircle, roles: ['super_admin', 'owner', 'manager', 'supervisor', 'agent'] },
      { href: '/admin', label: 'Super Admin', icon: ShieldCheck, roles: ['super_admin'] },
    ] as NavItem[],
  },
]

export default function Sidebar() {
  const pathname = usePathname()
  const { profile, signOut } = useAuth()
  const [open, setOpen] = useState(false)
  const [waConnected, setWaConnected] = useState<boolean | null>(null)
  const [igConnected, setIgConnected] = useState<boolean | null>(null)

  useEffect(() => {
    if (!profile?.orgId) return

    fetch(`/api/whatsapp/sessions/${profile.orgId}?orgId=${profile.orgId}`)
      .then(r => r.json())
      .then(d => setWaConnected(d.status === 'open'))
      .catch(() => setWaConnected(false))

    fetch(`/api/instagram/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orgId: profile.orgId, check: true }),
    }).then(r => r.json()).then(d => setIgConnected(!d.error || d.error !== 'Instagram no configurado para esta organización')).catch(() => setIgConnected(false))
  }, [profile?.orgId])

  const initials = profile?.displayName
    ? profile.displayName.split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase()
    : 'U'

  const SidebarContent = () => (
    <div className="flex flex-col h-full bg-white dark:bg-slate-900">
      {/* Logo */}
      <div className="p-6 mb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-500/40">
              <Building2 size={22} />
            </div>
            <div>
              <h1 className="text-lg font-black text-slate-900 dark:text-white leading-none">NEXO CRM</h1>
              <p className="text-[10px] text-blue-500 font-bold tracking-tighter uppercase mt-0.5">Multi-Business OS</p>
            </div>
          </div>
          <button className="lg:hidden text-slate-400 hover:text-slate-600" onClick={() => setOpen(false)}>
            <X size={20} />
          </button>
        </div>

        {/* Status indicators */}
        <div className="flex items-center gap-3 mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${waConnected ? 'bg-green-500 animate-pulse' : waConnected === false ? 'bg-red-400' : 'bg-slate-300'}`} />
            <span className="text-[10px] font-bold text-slate-400 uppercase">WhatsApp</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${igConnected ? 'bg-pink-500 animate-pulse' : igConnected === false ? 'bg-slate-300' : 'bg-slate-300'}`} />
            <span className="text-[10px] font-bold text-slate-400 uppercase">Instagram</span>
          </div>
        </div>

        {/* User */}
        <div className="flex items-center gap-3 mt-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white font-black text-xs shadow-md">
            {initials}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate">{profile?.displayName}</p>
            <span className="text-[10px] text-slate-400 capitalize">{profile?.role?.replace('_', ' ')}</span>
          </div>
        </div>
      </div>

      {/* Nav sections */}
      <nav className="flex-1 px-3 space-y-5 overflow-y-auto pb-4">
        {NAV_SECTIONS.map(section => {
          const visible = section.items.filter(item => profile?.role && item.roles.includes(profile.role))
          if (visible.length === 0) return null
          return (
            <div key={section.label}>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-3 mb-2">{section.label}</p>
              <div className="space-y-0.5">
                {visible.map(item => {
                  const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setOpen(false)}
                      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl font-bold text-sm transition-all ${
                        active
                          ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30'
                          : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-800 dark:hover:text-slate-200'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <item.icon size={17} />
                        {item.label}
                      </div>
                      {item.badge && (
                        <span className={`text-[10px] py-0.5 px-2 rounded-full font-black ${active ? 'bg-white text-blue-600' : 'bg-blue-600 text-white'}`}>
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  )
                })}
              </div>
            </div>
          )
        })}
      </nav>

      {/* Logout */}
      <div className="p-4 border-t border-slate-100 dark:border-slate-800">
        <button
          onClick={signOut}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-bold text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all"
        >
          <LogOut size={17} />
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
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-600 shadow-sm"
      >
        {open ? <X size={20} /> : <Menu size={20} />}
      </button>

      {/* Mobile overlay */}
      {open && (
        <div className="lg:hidden fixed inset-0 z-40 bg-black/30 backdrop-blur-sm" onClick={() => setOpen(false)} />
      )}

      {/* Mobile sidebar */}
      <aside className={`lg:hidden fixed inset-y-0 left-0 z-40 w-72 border-r border-slate-200 dark:border-slate-800 transform transition-transform ${open ? 'translate-x-0' : '-translate-x-full'}`}>
        <SidebarContent />
      </aside>

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-72 border-r border-slate-200 dark:border-slate-800 fixed inset-y-0 left-0">
        <SidebarContent />
      </aside>
    </>
  )
}
