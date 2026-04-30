'use client'

import { useEffect, useRef, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { subscribeToClients, getCategories, getOrgUsers } from '@/lib/firestore'
import type { Client, Category, AppUser } from '@/types'
import ChatWindow from '@/components/chat/ChatWindow'
import { Search, ArrowLeft, User } from 'lucide-react'

const AVATAR_COLORS = ['#E1306C', '#833AB4', '#405DE6', '#5851DB', '#C13584', '#F77737', '#FCAF45']

function Avatar({ name, size = 44 }: { name: string; size?: number }) {
  const initials = name.trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?'
  const color = AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length]
  return (
    <div className="rounded-full flex items-center justify-center flex-shrink-0 text-white font-bold"
      style={{ width: size, height: size, backgroundColor: color, fontSize: size * 0.36 }}>
      {initials}
    </div>
  )
}

function IgIcon({ size = 16 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none">
      <defs>
        <linearGradient id="ig-s" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#f09433" />
          <stop offset="50%" stopColor="#dc2743" />
          <stop offset="100%" stopColor="#bc1888" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="20" height="20" rx="5" stroke="url(#ig-s)" strokeWidth="2" fill="none" />
      <circle cx="12" cy="12" r="4" stroke="url(#ig-s)" strokeWidth="2" fill="none" />
      <circle cx="17.5" cy="6.5" r="1" fill="url(#ig-s)" />
    </svg>
  )
}

function formatLastTime(v: unknown): string {
  if (!v) return ''
  const d = v instanceof Date ? v : new Date((v as { seconds: number }).seconds * 1000)
  const diff = Date.now() - d.getTime()
  if (diff < 60000) return 'ahora'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m`
  if (diff < 86400000) return d.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })
  if (diff < 604800000) return d.toLocaleDateString('es', { weekday: 'short' })
  return d.toLocaleDateString('es', { day: '2-digit', month: '2-digit' })
}

export default function InstagramPage() {
  const { profile } = useAuth()
  const [allClients, setAllClients] = useState<Client[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [agents, setAgents] = useState<AppUser[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showMobileChat, setShowMobileChat] = useState(false)
  const [hasInstagram, setHasInstagram] = useState(false)

  useEffect(() => {
    if (!profile?.orgId) { setLoading(false); return }
    getCategories(profile.orgId).then(setCategories)
    if (profile.role !== 'agent') getOrgUsers(profile.orgId).then(setAgents)

    // Verificar si Instagram está configurado
    fetch(`/api/instagram/send`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orgId: profile.orgId, check: true }) })
      .catch(() => {})

    const unsub = subscribeToClients(
      profile.orgId,
      profile.role === 'agent' ? profile.uid : undefined,
      (c) => {
        const getTime = (v: unknown) => {
          if (!v) return 0
          if (v instanceof Date) return v.getTime()
          if (typeof v === 'object' && v !== null && 'seconds' in v) return (v as { seconds: number }).seconds * 1000
          return 0
        }
        const igClients = c.filter(cl => cl.instagramId || cl.createdBy === 'instagram')
        const sorted = [...igClients].sort((a, b) => {
          const aTime = getTime(a.lastMessageAt) || getTime(a.createdAt)
          const bTime = getTime(b.lastMessageAt) || getTime(b.createdAt)
          return bTime - aTime
        })
        setAllClients(sorted)
        setHasInstagram(true)
        setLoading(false)
      }
    )
    return unsub
  }, [profile])

  const filtered = allClients.filter(c =>
    !search ||
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.instagramId?.includes(search)
  )

  const selectedClient = allClients.find(c => c.id === selectedId) || null
  const totalUnread = allClients.reduce((s, c) => s + (c.unreadCount ?? 0), 0)

  return (
    <div className="flex h-[calc(100vh-0px)] overflow-hidden">
      {/* Lista */}
      <div className={`flex flex-col bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 ${showMobileChat ? 'hidden lg:flex' : 'flex'} w-full lg:w-80 xl:w-96 flex-shrink-0`}>
        {/* Header */}
        <div className="p-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <IgIcon size={20} />
              <h2 className="font-black text-slate-900 dark:text-white">Instagram</h2>
              {totalUnread > 0 && (
                <span className="bg-pink-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">{totalUnread}</span>
              )}
            </div>
          </div>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar contacto..."
              className="w-full pl-8 pr-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 transition-colors placeholder:text-slate-400 dark:placeholder:text-slate-500"
            />
          </div>
        </div>

        {/* Lista de contactos */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-6 text-center gap-4">
              <div className="w-16 h-16 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center">
                <IgIcon size={28} />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
                  {allClients.length === 0 ? 'No hay mensajes de Instagram' : 'Sin resultados'}
                </p>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                  {allClients.length === 0
                    ? 'Conecta tu cuenta en Configuración → Instagram'
                    : 'Intenta con otro término'}
                </p>
              </div>
            </div>
          ) : (
            filtered.map(client => (
              <button
                key={client.id}
                onClick={() => { setSelectedId(client.id); setShowMobileChat(true) }}
                className={`w-full flex items-center gap-3 px-4 py-3 border-b border-slate-50 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-left ${selectedId === client.id ? 'bg-pink-50 dark:bg-pink-950/20 border-l-2 border-l-pink-400' : ''}`}
              >
                <div className="relative">
                  <Avatar name={client.name} size={44} />
                  <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-white dark:bg-slate-900 rounded-full flex items-center justify-center">
                    <IgIcon size={10} />
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-sm text-slate-900 dark:text-white truncate">{client.name}</span>
                    <span className="text-xs text-slate-400 dark:text-slate-500 shrink-0">{formatLastTime(client.lastMessageAt)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2 mt-0.5">
                    <span className="text-xs text-slate-500 dark:text-slate-400 truncate">{client.lastMessage || 'Sin mensajes'}</span>
                    {(client.unreadCount ?? 0) > 0 && (
                      <span className="bg-pink-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full shrink-0 min-w-[18px] text-center">
                        {client.unreadCount}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Panel de chat */}
      <div className={`flex-1 flex flex-col bg-slate-50 dark:bg-slate-800/30 ${showMobileChat ? 'flex' : 'hidden lg:flex'}`}>
        {/* Mobile back */}
        {showMobileChat && (
          <div className="lg:hidden flex items-center gap-3 px-4 py-3 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800">
            <button onClick={() => setShowMobileChat(false)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
              <ArrowLeft size={18} className="text-slate-600 dark:text-slate-300" />
            </button>
            {selectedClient && (
              <div className="flex items-center gap-2">
                <Avatar name={selectedClient.name} size={32} />
                <span className="font-bold text-sm text-slate-900 dark:text-white">{selectedClient.name}</span>
              </div>
            )}
          </div>
        )}

        {selectedClient ? (
          <ChatWindow
            client={selectedClient}
            hasWhatsApp={false}
            channel="instagram"
            fitParent
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-6">
            <div className="w-20 h-20 bg-white dark:bg-slate-900 rounded-full flex items-center justify-center border border-slate-100 dark:border-slate-800 shadow-sm">
              <IgIcon size={36} />
            </div>
            <div>
              <p className="font-black text-slate-900 dark:text-white">Bienvenido a Instagram</p>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Selecciona un contacto para abrir la conversación</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
