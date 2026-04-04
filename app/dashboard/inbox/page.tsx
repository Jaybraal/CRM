'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { subscribeToClients, getOrganization, getCategories, getOrgUsers } from '@/lib/firestore'
import type { Client, Category, AppUser } from '@/types'
import ChatWindow from '@/components/chat/ChatWindow'
import Link from 'next/link'
import { Inbox, Search, ArrowLeft, User } from 'lucide-react'

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

function formatPhone(p?: string): string | null {
  if (!p) return null
  const digits = p.replace(/[^\d]/g, '')
  if (digits.length < 7) return null
  return `+${digits}`
}

export default function InboxPage() {
  const { profile } = useAuth()
  const [clients, setClients] = useState<Client[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [agents, setAgents] = useState<AppUser[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showMobileChat, setShowMobileChat] = useState(false)
  const [hasWhatsApp, setHasWhatsApp] = useState(false)
  const [filter, setFilter] = useState<'unread' | 'all'>('unread')

  useEffect(() => {
    if (!profile?.orgId) { setLoading(false); return }

    getOrganization(profile.orgId).then(org => {
      setHasWhatsApp(!!(org?.settings?.whatsapp?.phoneNumberId || process.env.NEXT_PUBLIC_BAILEYS_ENABLED === 'true'))
    })
    getCategories(profile.orgId).then(setCategories)
    if (profile.role !== 'agent') {
      getOrgUsers(profile.orgId).then(setAgents)
    }

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
    const matchSearch = !search ||
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.phone?.includes(search) ||
      c.whatsappPhone?.includes(search)
    const matchFilter = filter === 'all' || (c.unreadCount ?? 0) > 0
    return matchSearch && matchFilter
  })

  const selectedClient = clients.find(c => c.id === selectedId) || null
  const totalUnread = clients.reduce((s, c) => s + (c.unreadCount ?? 0), 0)
  const getCategoryColor = (id?: string) => categories.find(c => c.id === id)?.color || '#6b7280'

  return (
    <div className="flex flex-1 min-h-0 overflow-hidden">

      {/* ── Panel izquierdo ─────────────────────────────── */}
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
            <button key={f.value} onClick={() => setFilter(f.value as 'unread' | 'all')}
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
                {/* Avatar con dot de categoría */}
                <div className="relative">
                  <Avatar name={client.name} size={46} />
                  {client.categoryId && (
                    <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white"
                      style={{ backgroundColor: getCategoryColor(client.categoryId) }} />
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className={`font-semibold text-sm truncate ${(client.unreadCount ?? 0) > 0 ? 'text-gray-900' : 'text-gray-700'}`}>
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

                  {/* Preview del último mensaje */}
                  <p className={`text-xs truncate mt-0.5 ${(client.unreadCount ?? 0) > 0 ? 'text-gray-700 font-medium' : 'text-gray-400'}`}>
                    {client.lastMessage || formatPhone(client.phone) || formatPhone(client.whatsappPhone) || 'Sin teléfono'}
                  </p>

                  {/* Agente asignado */}
                  {profile?.role !== 'agent' && client.assignedTo && agents.length > 0 && (
                    <p className="text-[10px] text-gray-400 truncate mt-0.5">
                      {agents.find(a => a.uid === client.assignedTo)?.displayName || 'Sin asignar'}
                    </p>
                  )}
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* ── Panel derecho: chat ────────────────────────── */}
      <div className={`flex-col flex-1 min-w-0 min-h-0 ${showMobileChat ? 'flex' : 'hidden lg:flex'}`}>
        {selectedClient ? (
          <>
            {/* Header del chat */}
            <div className="flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-200 flex-shrink-0">
              <button
                onClick={() => setShowMobileChat(false)}
                className="lg:hidden p-1.5 -ml-1 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-colors">
                <ArrowLeft size={20} />
              </button>
              <Avatar name={selectedClient.name} size={38} />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 text-sm leading-tight truncate">{selectedClient.name}</p>
                <p className="text-xs text-gray-500 leading-tight mt-0.5">
                  {formatPhone(selectedClient.phone) || formatPhone(selectedClient.whatsappPhone) || (selectedClient.isLid ? 'Número privado' : 'Sin teléfono')}
                </p>
              </div>
              <Link
                href={`/dashboard/clients/${selectedClient.id}`}
                className="p-2 text-gray-400 hover:text-gray-700 rounded-full hover:bg-gray-100 transition-colors flex-shrink-0"
                title="Ver perfil completo">
                <User size={18} />
              </Link>
            </div>

            <div className="flex-1 min-h-0 overflow-hidden">
              <ChatWindow client={selectedClient} hasWhatsApp={hasWhatsApp} fitParent />
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center bg-[#f0f2f5]">
            <Inbox size={40} className="text-gray-300" />
            <p className="text-sm text-gray-400">Selecciona una conversación</p>
          </div>
        )}
      </div>
    </div>
  )
}
