'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { subscribeToClients, getOrganization } from '@/lib/firestore'
import type { Client } from '@/types'
import ChatWindow from '@/components/chat/ChatWindow'
import { Inbox, Search } from 'lucide-react'

const AVATAR_COLORS = ['#25D366', '#128C7E', '#075E54', '#34B7F1', '#7c3aed', '#db2777', '#d97706']

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

export default function InboxPage() {
  const { profile } = useAuth()
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showMobileChat, setShowMobileChat] = useState(false)
  const [hasWhatsApp, setHasWhatsApp] = useState(false)
  const [filter, setFilter] = useState<'all' | 'unread'>('unread')

  useEffect(() => {
    if (!profile?.orgId) { setLoading(false); return }
    getOrganization(profile.orgId).then(org => {
      setHasWhatsApp(!!(org?.settings?.whatsapp?.phoneNumberId || process.env.NEXT_PUBLIC_BAILEYS_ENABLED === 'true'))
    })
    const getTime = (v: unknown) => {
      if (!v) return 0
      if (v instanceof Date) return v.getTime()
      if (typeof v === 'object' && v !== null && 'seconds' in v) return (v as { seconds: number }).seconds * 1000
      return 0
    }
    const unsub = subscribeToClients(
      profile.orgId,
      profile.role === 'agent' ? profile.uid : undefined,
      (c) => {
        const withMessages = c.filter(cl => cl.lastMessageAt)
        const sorted = [...withMessages].sort((a, b) => getTime(b.lastMessageAt) - getTime(a.lastMessageAt))
        setClients(sorted)
        setLoading(false)
      }
    )
    return unsub
  }, [profile])

  const filtered = clients.filter(c => {
    const matchSearch = !search || c.name.toLowerCase().includes(search.toLowerCase())
    const matchFilter = filter === 'all' || (c.unreadCount ?? 0) > 0
    return matchSearch && matchFilter
  })

  const selectedClient = clients.find(c => c.id === selectedId) || null
  const totalUnread = clients.reduce((s, c) => s + (c.unreadCount ?? 0), 0)

  return (
    <div className="flex flex-1 min-h-0 overflow-hidden">

      {/* Lista de chats */}
      <div className={`flex-col w-full lg:w-80 xl:w-96 bg-white border-r border-gray-200 flex-shrink-0 ${showMobileChat ? 'hidden lg:flex' : 'flex'}`}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Inbox size={18} className="text-gray-600" />
            <h1 className="font-bold text-gray-900 text-base">Inbox</h1>
            {totalUnread > 0 && (
              <span className="bg-[#25D366] text-white text-[10px] font-bold min-w-[18px] h-[18px] flex items-center justify-center rounded-full px-1">
                {totalUnread > 99 ? '99+' : totalUnread}
              </span>
            )}
          </div>
        </div>

        {/* Búsqueda */}
        <div className="px-3 py-2 border-b border-gray-100">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar conversación..."
              className="w-full pl-8 pr-3 py-1.5 bg-gray-100 rounded-full text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:bg-gray-200 transition-colors"
            />
          </div>
        </div>

        {/* Filtros */}
        <div className="flex gap-1.5 px-3 py-2 border-b border-gray-100">
          {[{ value: 'unread', label: '● No leídos' }, { value: 'all', label: 'Todos' }].map(f => (
            <button key={f.value} onClick={() => setFilter(f.value as 'all' | 'unread')}
              className={`whitespace-nowrap px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                filter === f.value ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}>
              {f.label}
            </button>
          ))}
        </div>

        {/* Lista */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex justify-center py-10">
              <div className="w-6 h-6 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 py-16 text-center px-4">
              <Inbox size={32} className="text-gray-300" />
              <p className="text-sm text-gray-400">
                {filter === 'unread' ? 'No hay mensajes sin leer' : 'Sin conversaciones aún'}
              </p>
            </div>
          ) : (
            filtered.map(client => (
              <button
                key={client.id}
                onClick={() => { setSelectedId(client.id); setShowMobileChat(true) }}
                className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 active:bg-gray-100 transition-colors border-b border-gray-50 text-left ${selectedId === client.id ? 'bg-[#f0f2f5]' : ''}`}
              >
                <Avatar name={client.name} size={46} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className={`text-sm truncate ${(client.unreadCount ?? 0) > 0 ? 'font-bold text-gray-900' : 'font-semibold text-gray-700'}`}>
                      {client.name}
                    </span>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {(client.unreadCount ?? 0) > 0 ? (
                        <span className="bg-[#25D366] text-white text-[10px] font-bold min-w-[18px] h-[18px] flex items-center justify-center rounded-full px-1">
                          {client.unreadCount! > 99 ? '99+' : client.unreadCount}
                        </span>
                      ) : (
                        <span className="text-[10px] text-gray-400">{formatLastTime(client.lastMessageAt)}</span>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-gray-400 truncate mt-0.5">
                    {client.phone || client.whatsappPhone ? `+${(client.phone || client.whatsappPhone)!.replace(/\D/g, '')}` : 'Sin teléfono'}
                  </p>
                  {client.lastMessageAt && (client.unreadCount ?? 0) > 0 && (
                    <p className="text-[10px] text-gray-400 mt-0.5">{formatLastTime(client.lastMessageAt)}</p>
                  )}
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Chat */}
      <div className={`flex-1 min-w-0 ${showMobileChat ? 'flex' : 'hidden lg:flex'} flex-col`}>
        {selectedClient ? (
          <>
            <div className="lg:hidden flex items-center px-4 py-2 bg-white border-b border-gray-200">
              <button onClick={() => setShowMobileChat(false)} className="text-sm text-gray-500 hover:text-gray-900 mr-3">
                ← Volver
              </button>
            </div>
            <ChatWindow client={selectedClient} hasWhatsApp={hasWhatsApp} fitParent />
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
            <Inbox size={40} className="text-gray-200" />
            <p className="text-sm text-gray-400">Selecciona una conversación</p>
          </div>
        )}
      </div>
    </div>
  )
}
