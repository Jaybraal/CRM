'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import {
  Users, FolderKanban, LayoutDashboard, Tag,
  CheckSquare, Settings, LogOut, ShieldCheck, Menu, X, UserCircle,
  Send, BarChart3, CalendarDays, Instagram, ShoppingBag, MessageSquare
} from 'lucide-react'
import { useState, useEffect } from 'react'
import GlobalSearch from '@/components/ui/GlobalSearch'

type NavItem = {
  href: string
  label: string
  icon: React.ComponentType<{ size?: number; className?: string }>
  roles: string[]
  color?: string
}

function WIcon({ size = 18 }: { size?: number }) {
  return (
    <MessageSquare size={size} />
  )
}

const navItems: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['super_admin', 'owner', 'manager', 'supervisor', 'agent'] },
  { href: '/dashboard/clients', label: 'Clientes', icon: WIcon, roles: ['super_admin', 'owner', 'manager', 'supervisor', 'agent'] },
  { href: '/dashboard/instagram', label: 'Instagram', icon: Instagram, roles: ['super_admin', 'owner', 'manager', 'supervisor', 'agent'] },
  { href: '/dashboard/categories', label: 'Categorías', icon: Tag, roles: ['super_admin', 'owner', 'manager', 'supervisor'] },
  { href: '/dashboard/pipeline', label: 'Pipeline', icon: FolderKanban, roles: ['super_admin', 'owner', 'manager', 'supervisor', 'agent'] },
  { href: '/dashboard/tasks', label: 'Tareas', icon: CheckSquare, roles: ['super_admin', 'owner', 'manager', 'supervisor', 'agent'] },
  { href: '/dashboard/calendar', label: 'Calendario', icon: CalendarDays, roles: ['super_admin', 'owner', 'manager', 'supervisor', 'agent'] },
  { href: '/dashboard/catalog', label: 'Catálogo', icon: ShoppingBag, roles: ['super_admin', 'owner', 'manager', 'supervisor', 'agent'] },
  { href: '/dashboard/broadcast', label: 'Difusión', icon: Send, roles: ['super_admin', 'owner', 'manager'] },
  { href: '/dashboard/reports', label: 'Reportes', icon: BarChart3, roles: ['super_admin', 'owner', 'manager', 'supervisor'] },
  { href: '/dashboard/team', label: 'Equipo', icon: Users, roles: ['super_admin', 'owner', 'manager', 'supervisor'] },
  { href: '/dashboard/users', label: 'Usuarios', icon: Users, roles: ['super_admin', 'owner'] },
  { href: '/dashboard/settings', label: 'Configuración', icon: Settings, roles: ['super_admin', 'owner'] },
  { href: '/dashboard/profile', label: 'Mi perfil', icon: UserCircle, roles: ['super_admin', 'owner', 'manager', 'supervisor', 'agent'] },
  { href: '/admin', label: 'Super Admin', icon: ShieldCheck, roles: ['super_admin'] },
]

const roleColors: Record<string, string> = {
  super_admin: 'bg-red-500/20 text-red-300',
  owner: 'bg-violet-500/20 text-violet-300',
  manager: 'bg-blue-500/20 text-blue-300',
  supervisor: 'bg-emerald-500/20 text-emerald-300',
  agent: 'bg-slate-500/20 text-slate-300',
}

const roleLabels: Record<string, string> = {
  super_admin: 'Super Admin',
  owner: 'Propietario',
  manager: 'Gerente',
  supervisor: 'Supervisor',
  agent: 'Agente',
}

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

    fetch(`/api/settings?orgId=${profile.orgId}&action=get_ig_status`)
      .then(r => r.json())
      .then(d => setIgConnected(!!d.configured))
      .catch(() => setIgConnected(false))
  }, [profile?.orgId])

  const visible = navItems.filter(item =>
    profile?.role && item.roles.includes(profile.role)
  )

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo / Header */}
      <div className="p-5 border-b border-white/10">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-900/40">
              <span className="text-white font-black text-sm">1</span>
            </div>
            <h1 className="text-lg font-bold text-white tracking-tight">CRM</h1>
          </div>
          <div className="flex items-center gap-2">
            {waConnected !== null && (
              <div
                className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                  waConnected
                    ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                    : 'bg-white/5 text-slate-500 border-white/10'
                }`}
                title={waConnected ? 'WhatsApp conectado' : 'WhatsApp desconectado'}
              >
                {waConnected && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />}
                WA
              </div>
            )}
            {igConnected !== null && (
              <div
                className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                  igConnected
                    ? 'bg-pink-500/15 text-pink-400 border-pink-500/30'
                    : 'bg-white/5 text-slate-500 border-white/10'
                }`}
                title={igConnected ? 'Instagram configurado' : 'Instagram no configurado'}
              >
                {igConnected && <span className="w-1.5 h-1.5 rounded-full bg-pink-400 animate-pulse" />}
                IG
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-slate-600 to-slate-700 flex items-center justify-center flex-shrink-0">
            <span className="text-white text-xs font-bold">
              {profile?.displayName?.charAt(0).toUpperCase() ?? '?'}
            </span>
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-white/80 truncate">{profile?.displayName}</p>
            <span className={`inline-block mt-0.5 text-[10px] px-1.5 py-0.5 rounded-full font-medium ${roleColors[profile?.role ?? ''] ?? 'bg-white/10 text-white/50'}`}>
              {roleLabels[profile?.role ?? ''] ?? profile?.role}
            </span>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="px-3 pt-3 pb-1">
        <GlobalSearch />
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-2 space-y-0.5 overflow-y-auto">
        {visible.map(item => {
          const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                active
                  ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-md shadow-indigo-900/40'
                  : 'text-slate-400 hover:bg-white/8 hover:text-white'
              }`}
            >
              <item.icon size={17} className={active ? 'text-white' : 'text-slate-500'} />
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-white/10">
        <button
          onClick={signOut}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm text-slate-400 hover:bg-red-500/10 hover:text-red-400 transition-all"
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
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-slate-900 border border-white/10 rounded-lg text-white shadow-lg"
      >
        {open ? <X size={20} /> : <Menu size={20} />}
      </button>

      {/* Mobile overlay */}
      {open && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Mobile sidebar */}
      <aside className={`lg:hidden fixed inset-y-0 left-0 z-40 w-64 bg-slate-900 transform transition-transform ${open ? 'translate-x-0' : '-translate-x-full'}`}>
        <SidebarContent />
      </aside>

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-64 bg-slate-900 fixed inset-y-0 left-0">
        <SidebarContent />
      </aside>
    </>
  )
}
