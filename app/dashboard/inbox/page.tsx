'use client'

import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '@/context/AuthContext'
import { subscribeToClients } from '@/lib/firestore'
import ChatWindow from '@/components/chat/ChatWindow'
import type { Client } from '@/types'
import Link from 'next/link'
import {
  Search, Filter, Bot, Circle, Phone, Instagram,
  MessageCircle, Users, RefreshCw, Megaphone
} from 'lucide-react'

const AVATAR_COLORS = ['#25D366','#128C7E','#075E54','#3b82f6','#7c3aed','#db2777','#d97706']

function Avatar({ name, size = 40 }: { name: string; size?: number }) {
  const initials = name.trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?'
  const color = AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length]
  return (
    <div
      className="rounded-full flex items-center justify-center flex-shrink-0 text-white font-bold"
      style={{ width: size, height: size, backgroundColor: color, fontSize: size * 0.35 }}
    >
      {initials}
    </div>
  )
}

function formatTime(ts: any): string {
  if (!ts) return ''
  const d = ts?.seconds ? new Date(ts.seconds * 1000) : new Date(ts)
  const diff = Date.now() - d.getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'ahora'
  if (mins < 60) return `${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h`
  return `${Math.floor(hrs / 24)}d`
}

type FilterTab = 'all' | 'unread' | 'whatsapp' | 'instagram'

export default function InboxPage() {
  const { profile } = useAuth()
  const [clients, setClients] = useState<Client[]>([])
  const [selected, setSelected] = useState<Client | null>(null)
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState<FilterTab>('all')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!profile?.orgId) return
    setLoading(true)
    // subscribeToClients orders by createdAt — safe without composite index.
    // We sort client-side by lastMessageAt so conversations with messages
    // bubble to the top, while contacts without messages still appear.
    const unsub = subscribeToClients(profile.orgId, undefined, raw => {
      const sorted = [...raw].sort((a, b) => {
        const ta = (a.lastMessageAt as any)?.seconds ?? (a.createdAt as any)?.seconds ?? 0
        const tb = (b.lastMessageAt as any)?.seconds ?? (b.createdAt as any)?.seconds ?? 0
        return tb - ta
      })
      setClients(sorted)
      setLoading(false)
    }, 100)
    return () => unsub()
  }, [profile?.orgId])

  const filtered = clients.filter(c => {
    const matchSearch = !search || c.name.toLowerCase().includes(search.toLowerCase())
    const matchTab =
      tab === 'all'       ? true :
      tab === 'unread'    ? (c.unreadCount ?? 0) > 0 :
      tab === 'whatsapp'  ? !c.instagramId :
      tab === 'instagram' ? !!c.instagramId : true
    return matchSearch && matchTab
  })

  const isInstagram = (c: Client) => !!c.instagramId
  const hasWA       = (c: Client) => !!(c.phone || c.whatsappPhone)

  const handleSelect = useCallback((c: Client) => setSelected(c), [])

  const TABS: { id: FilterTab; label: string }[] = [
    { id: 'unread',    label: 'Sin leer'  },
    { id: 'whatsapp',  label: 'WS'        },
    { id: 'instagram', label: 'IG'        },
  ]

  return (
    <div className="flex flex-1 overflow-hidden h-full">

      {/* ── Chat list ── */}
      <div className={`${selected ? 'hidden md:flex' : 'flex'} w-full md:w-80 lg:w-96 flex-col border-r border-[#E3E6EC] dark:border-[#1A2540] bg-white dark:bg-[#0F1829] flex-shrink-0`}>

        <div className="px-4 pt-4 pb-2 border-b border-[#E3E6EC] dark:border-[#1A2540] flex-shrink-0">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h1 className="text-lg font-bold text-[#0C1224] dark:text-[#E8ECF4]">Bandeja</h1>
              <p className="text-xs text-[#9BA5B7]">WhatsApp · Instagram</p>
            </div>
            <div className="flex items-center gap-1">
              <Link
                href="/dashboard/broadcast"
                className="p-2 text-[#9BA5B7] hover:text-[#0D7A65] hover:bg-[#F4F5F7] dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                title="Difusión masiva"
              >
                <Megaphone size={16} />
              </Link>
              <button className="p-2 text-[#9BA5B7] hover:text-[#68748D] hover:bg-[#F4F5F7] dark:hover:bg-[#1A2540] rounded-lg transition-colors">
                <Filter size={16} />
              </button>
            </div>
          </div>

          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9BA5B7]" size={15} />
            <input
              type="text"
              placeholder="Buscar contacto..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-[#F4F5F7] dark:bg-[#1A2540] rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#0D7A65] text-[#0C1224] dark:text-[#E8ECF4]"
            />
          </div>

          <div className="flex gap-1 overflow-x-auto no-scrollbar pb-1">
            {TABS.map(t => (
              <button
                key={t.id}
                onClick={() => setTab(prev => prev === t.id ? 'all' : t.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors flex-shrink-0 ${
                  tab === t.id
                    ? 'bg-[#0C1224] text-white'
                    : 'text-[#68748D] dark:text-[#9BA5B7] hover:bg-[#F4F5F7] dark:hover:bg-[#1A2540]'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-32 gap-2 text-[#9BA5B7]">
              <RefreshCw size={16} className="animate-spin" />
              <span className="text-sm">Cargando chats...</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-[#9BA5B7] gap-3">
              <MessageCircle size={36} className="opacity-30" />
              <p className="text-sm">Sin conversaciones aún</p>
            </div>
          ) : (
            filtered.map(client => {
              const isIG   = isInstagram(client)
              const active = selected?.id === client.id
              const unread = client.unreadCount ?? 0
              return (
                <button
                  key={client.id}
                  onClick={() => handleSelect(client)}
                  className={`w-full text-left flex items-center gap-3 px-4 py-3.5 border-b border-slate-50 dark:border-[#1A2540]/60 transition-colors ${
                    active
                      ? 'bg-[#F4F5F7] dark:bg-[#0D7A65]/10 border-l-2 border-l-blue-600'
                      : 'hover:bg-[#F4F5F7] dark:hover:bg-[#1A2540]'
                  }`}
                >
                  <Avatar name={client.name} size={42} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className={`text-sm truncate ${unread > 0 ? 'font-bold text-[#0C1224] dark:text-[#E8ECF4]' : 'font-medium text-[#0C1224] dark:text-[#E8ECF4]'}`}>
                        {client.name}
                      </span>
                      <span className="text-[10px] text-[#9BA5B7] flex-shrink-0 ml-2">
                        {formatTime(client.lastMessageAt)}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase flex-shrink-0 ${
                        isIG
                          ? 'bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-900/30 dark:text-fuchsia-400'
                          : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                      }`}>
                        {isIG ? 'IG' : 'WA'}
                      </span>
                      <p className={`text-xs truncate ${unread > 0 ? 'text-[#0C1224] dark:text-[#E8ECF4] font-medium' : 'text-[#9BA5B7]'}`}>
                        {client.lastMessage || 'Sin mensajes'}
                      </p>
                      {unread > 0 && (
                        <span className="ml-auto flex-shrink-0 w-5 h-5 rounded-full bg-[#0C1224] text-[10px] font-bold text-white flex items-center justify-center">
                          {unread > 9 ? '9+' : unread}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              )
            })
          )}
        </div>

        <div className="px-4 py-2.5 border-t border-[#E3E6EC] dark:border-[#1A2540] flex items-center gap-3 flex-shrink-0">
          <div className="flex items-center gap-3 text-xs text-[#9BA5B7]">
            <span className="flex items-center gap-1"><Users size={12} /> {filtered.length}</span>
            <span className="flex items-center gap-1 text-emerald-500">
              <Circle size={8} fill="currentColor" />
              {filtered.filter(c => !isInstagram(c)).length} WA
            </span>
            <span className="flex items-center gap-1 text-fuchsia-500">
              <Circle size={8} fill="currentColor" />
              {filtered.filter(c => isInstagram(c)).length} IG
            </span>
          </div>
        </div>
      </div>

      {/* ── Chat area ── */}
      <div className={`${selected ? 'flex' : 'hidden md:flex'} flex-1 overflow-hidden flex-col`}>
        {selected ? (
          <ChatWindow
            key={selected.id}
            client={selected}
            hasWhatsApp={hasWA(selected)}
            fitParent
            channel={isInstagram(selected) ? 'instagram' : 'whatsapp'}
            onBack={() => setSelected(null)}
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-[#9BA5B7] gap-4 bg-[#F4F5F7] dark:bg-slate-950">
            <div className="w-20 h-20 rounded-lg bg-[#F4F5F7] dark:bg-[#1A2540] flex items-center justify-center">
              <MessageCircle size={36} className="opacity-40" />
            </div>
            <div className="text-center">
              <p className="font-semibold text-[#68748D] dark:text-[#9BA5B7]">Selecciona un chat</p>
              <p className="text-sm mt-1 text-[#9BA5B7]">Elige una conversación de la lista</p>
            </div>
            <div className="flex items-center gap-3 mt-2 flex-wrap justify-center">
              <span className="flex items-center gap-2 text-xs bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 px-3 py-1.5 rounded-full font-medium">
                <Phone size={12} /> WhatsApp
              </span>
              <span className="flex items-center gap-2 text-xs bg-fuchsia-50 dark:bg-fuchsia-900/20 text-fuchsia-600 dark:text-fuchsia-400 px-3 py-1.5 rounded-full font-medium">
                <Instagram size={12} /> Instagram
              </span>
              <span className="flex items-center gap-2 text-xs bg-[#F4F5F7] dark:bg-[#0D7A65]/10 text-[#0D7A65] dark:text-[#0D7A65] px-3 py-1.5 rounded-full font-medium">
                <Bot size={12} /> Alex IA activo
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
