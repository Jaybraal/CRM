'use client'

import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '@/context/AuthContext'
import { subscribeToClients } from '@/lib/firestore'
import ChatWindow from '@/components/chat/ChatWindow'
import type { Client } from '@/types'
import {
  Search, Filter, Bot, Circle, Phone, Instagram,
  MessageCircle, Users, RefreshCw
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

type FilterTab = 'all' | 'mine' | 'unread' | 'whatsapp' | 'instagram'

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
      tab === 'mine'      ? c.assignedTo === profile?.uid :
      tab === 'unread'    ? (c.unreadCount ?? 0) > 0 :
      tab === 'whatsapp'  ? !c.instagramId :
      tab === 'instagram' ? !!c.instagramId : true
    return matchSearch && matchTab
  })

  const isInstagram = (c: Client) => !!c.instagramId
  const hasWA       = (c: Client) => !!(c.phone || c.whatsappPhone)

  const handleSelect = useCallback((c: Client) => setSelected(c), [])

  const TABS: { id: FilterTab; label: string }[] = [
    { id: 'all',       label: 'Todos'     },
    { id: 'mine',      label: 'Míos'      },
    { id: 'unread',    label: 'Sin leer'  },
    { id: 'whatsapp',  label: 'WhatsApp'  },
    { id: 'instagram', label: 'Instagram' },
  ]

  return (
    <div className="flex flex-1 overflow-hidden h-full">

      {/* ── Chat list ── */}
      <div className={`${selected ? 'hidden md:flex' : 'flex'} w-full md:w-80 lg:w-96 flex-col border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex-shrink-0`}>

        <div className="px-4 pt-4 pb-2 border-b border-slate-100 dark:border-slate-800 flex-shrink-0">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h1 className="text-lg font-black text-slate-900 dark:text-white">Bandeja</h1>
              <p className="text-xs text-slate-400">WhatsApp · Instagram</p>
            </div>
            <button className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
              <Filter size={16} />
            </button>
          </div>

          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
            <input
              type="text"
              placeholder="Buscar contacto..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-100 dark:bg-slate-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-700 dark:text-slate-200"
            />
          </div>

          <div className="flex gap-1 overflow-x-auto no-scrollbar pb-1">
            {TABS.map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors flex-shrink-0 ${
                  tab === t.id
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-32 gap-2 text-slate-400">
              <RefreshCw size={16} className="animate-spin" />
              <span className="text-sm">Cargando chats...</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-slate-400 gap-3">
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
                  className={`w-full text-left flex items-center gap-3 px-4 py-3.5 border-b border-slate-50 dark:border-slate-800/60 transition-colors ${
                    active
                      ? 'bg-blue-50 dark:bg-blue-900/20 border-l-2 border-l-blue-600'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  <Avatar name={client.name} size={42} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className={`text-sm truncate ${unread > 0 ? 'font-bold text-slate-900 dark:text-white' : 'font-medium text-slate-700 dark:text-slate-200'}`}>
                        {client.name}
                      </span>
                      <span className="text-[10px] text-slate-400 flex-shrink-0 ml-2">
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
                      <p className={`text-xs truncate ${unread > 0 ? 'text-slate-700 dark:text-slate-200 font-medium' : 'text-slate-400'}`}>
                        {client.lastMessage || 'Sin mensajes'}
                      </p>
                      {unread > 0 && (
                        <span className="ml-auto flex-shrink-0 w-5 h-5 rounded-full bg-blue-600 text-[10px] font-bold text-white flex items-center justify-center">
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

        <div className="px-4 py-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center gap-3 flex-shrink-0">
          <div className="flex items-center gap-3 text-xs text-slate-400">
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
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400 gap-4 bg-slate-50 dark:bg-slate-950">
            <div className="w-20 h-20 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
              <MessageCircle size={36} className="opacity-40" />
            </div>
            <div className="text-center">
              <p className="font-semibold text-slate-500 dark:text-slate-400">Selecciona un chat</p>
              <p className="text-sm mt-1 text-slate-400">Elige una conversación de la lista</p>
            </div>
            <div className="flex items-center gap-3 mt-2 flex-wrap justify-center">
              <span className="flex items-center gap-2 text-xs bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 px-3 py-1.5 rounded-full font-medium">
                <Phone size={12} /> WhatsApp
              </span>
              <span className="flex items-center gap-2 text-xs bg-fuchsia-50 dark:bg-fuchsia-900/20 text-fuchsia-600 dark:text-fuchsia-400 px-3 py-1.5 rounded-full font-medium">
                <Instagram size={12} /> Instagram
              </span>
              <span className="flex items-center gap-2 text-xs bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 px-3 py-1.5 rounded-full font-medium">
                <Bot size={12} /> Alex IA activo
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
