'use client'

import { useEffect, useRef, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { subscribeToClients, getCategories, createClient, getOrgUsers, getOrganization, updateClient } from '@/lib/firestore'
import type { Client, Category, AppUser, ClientStatus } from '@/types'
import { DEFAULT_CLIENT_STATUSES } from '@/types'
import Modal from '@/components/ui/Modal'
import ClientForm from '@/components/clients/ClientForm'
import ChatWindow from '@/components/chat/ChatWindow'
import Link from 'next/link'
import { Plus, Search, Download, Upload, ArrowLeft, User, MessageCircle } from 'lucide-react'
import toast from 'react-hot-toast'

const STATUS_COLORS: Record<string, string> = {
  lead: '#9ca3af',
  prospect: '#3b82f6',
  active: '#22c55e',
  inactive: '#d1d5db',
}

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

function formatPhone(p?: string): string | null {
  if (!p) return null
  const digits = p.replace(/[^\d]/g, '')
  if (digits.length < 7) return null
  return `+${digits}`
}

function getDisplayPhone(c: Client): string | null {
  return formatPhone(c.phone) || formatPhone(c.whatsappPhone)
}

export default function ClientsPage() {
  const { profile } = useAuth()
  const [clients, setClients] = useState<Client[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [agents, setAgents] = useState<AppUser[]>([])
  const [clientStatuses, setClientStatuses] = useState<ClientStatus[]>(DEFAULT_CLIENT_STATUSES)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showMobileChat, setShowMobileChat] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [importing, setImporting] = useState(false)
  const [visibleCount, setVisibleCount] = useState(50)
  const importRef = useRef<HTMLInputElement>(null)

  const [hasWhatsApp, setHasWhatsApp] = useState(true) // Usa Baileys — siempre activo
  const selectedClient = clients.find(c => c.id === selectedId) || null
  const totalUnread = clients.reduce((s, c) => s + (c.unreadCount ?? 0), 0)

  useEffect(() => {
    if (!profile?.orgId) { setLoading(false); return }
    getCategories(profile.orgId).then(setCategories)
    getOrganization(profile.orgId).then(o => {
      if (o?.settings?.clientStatuses?.length) setClientStatuses(o.settings.clientStatuses)
      // Baileys siempre activo — setHasWhatsApp ya es true por defecto
    })
    if (profile.role !== 'agent') {
      getOrgUsers(profile.orgId).then(setAgents)
    }
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
        const sorted = [...c].sort((a, b) => {
          const aTime = getTime(a.lastMessageAt) || getTime(a.createdAt)
          const bTime = getTime(b.lastMessageAt) || getTime(b.createdAt)
          return bTime - aTime
        })
        setClients(sorted)
        setLoading(false)
      }
    )
    return unsub
  }, [profile])

  // Reset visible count when filter changes
  const handleFilterChange = (val: string) => { setFilterStatus(val); setVisibleCount(50) }
  const handleSearchChange = (val: string) => { setSearch(val); setVisibleCount(50) }

  const filtered = clients.filter(c => {
    const matchSearch = !search ||
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.phone?.includes(search) ||
      c.whatsappPhone?.includes(search) ||
      c.email?.toLowerCase().includes(search.toLowerCase())
    const matchStatus = !filterStatus
      ? true
      : filterStatus === '__unread__'
        ? (c.unreadCount ?? 0) > 0
        : c.status === filterStatus
    return matchSearch && matchStatus
  })

  const formatLastTime = (v: unknown): string => {
    if (!v) return ''
    const d = v instanceof Date ? v : new Date((v as { seconds: number }).seconds * 1000)
    const now = new Date()
    const diff = now.getTime() - d.getTime()
    if (diff < 60000) return 'ahora'
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m`
    if (diff < 86400000) return d.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })
    if (diff < 604800000) return d.toLocaleDateString('es', { weekday: 'short' })
    return d.toLocaleDateString('es', { day: '2-digit', month: '2-digit' })
  }

  const getCategoryColor = (id?: string) => categories.find(c => c.id === id)?.color || '#6b7280'

  const handleSelectClient = (client: Client) => {
    setSelectedId(client.id)
    setShowMobileChat(true)
  }

  const exportCSV = () => {
    const headers = ['Nombre', 'Email', 'Teléfono', 'WhatsApp', 'Estado', 'Etiquetas']
    const rows = filtered.map(c => [
      c.name, c.email || '', c.phone || '', c.whatsappPhone || '', c.status,
      (c.tags || []).join(';'),
    ])
    const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `clientes_${new Date().toISOString().slice(0, 10)}.csv`; a.click()
    URL.revokeObjectURL(url)
    toast.success(`${filtered.length} clientes exportados`)
  }

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !profile?.orgId) return
    setImporting(true)
    try {
      const text = await file.text()
      const lines = text.split('\n').filter(Boolean).slice(1)
      let created = 0
      for (const line of lines) {
        const cols = line.split(',').map(v => v.replace(/^"|"$/g, '').trim())
        const [name, email, phone, whatsappPhone, status, , tags, notes] = cols
        if (!name) continue
        await createClient(profile.orgId, {
          name, email: email || undefined, phone: phone || undefined,
          whatsappPhone: whatsappPhone || undefined,
          status: (['lead', 'prospect', 'active', 'inactive'].includes(status) ? status : 'lead') as Client['status'],
          tags: tags ? tags.split(';').filter(Boolean) : [],
          photos: [], notes: notes || undefined,
          assignedTo: profile.uid, createdBy: profile.uid, pipelineStage: 'new',
        })
        created++
      }
      toast.success(`${created} clientes importados`)
    } catch {
      toast.error('Error al importar el CSV')
    } finally {
      setImporting(false)
      if (importRef.current) importRef.current.value = ''
    }
  }

  return (
    <div className="flex flex-1 min-h-0 overflow-hidden">

      {/* ── Left panel: contact list ─────────────────────────────── */}
      <div className={`
        flex-col w-full lg:w-80 xl:w-96 bg-white dark:bg-slate-900 border-r border-slate-100 dark:border-slate-800 flex-shrink-0
        ${showMobileChat ? 'hidden lg:flex' : 'flex'}
      `}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-slate-50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <h1 className="font-bold text-slate-900 dark:text-white text-base">Chats</h1>
            {totalUnread > 0 && (
              <span className="bg-[#25D366] text-white text-[10px] font-bold min-w-[18px] h-[18px] flex items-center justify-center rounded-full px-1">
                {totalUnread > 99 ? '99+' : totalUnread}
              </span>
            )}
          </div>
          <div className="flex items-center gap-0.5">
            <button onClick={() => importRef.current?.click()} disabled={importing}
              title="Importar CSV"
              className="p-2 rounded-full text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
              <Upload size={16} />
            </button>
            <button onClick={exportCSV} title="Exportar CSV"
              className="p-2 rounded-full text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
              <Download size={16} />
            </button>
            <button onClick={() => setShowForm(true)} title="Nuevo cliente"
              className="p-2 rounded-full text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
              <Plus size={16} />
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              value={search}
              onChange={e => handleSearchChange(e.target.value)}
              placeholder="Buscar contacto..."
              className="w-full pl-8 pr-3 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-full text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:bg-slate-200 dark:focus:bg-slate-700 transition-colors"
            />
          </div>
        </div>

        {/* Status filter tabs */}
        <div className="flex gap-1.5 px-3 py-2 border-b border-slate-100 dark:border-slate-800 overflow-x-auto scrollbar-none">
          {[{ value: '', label: 'Todos' }, { value: '__unread__', label: '● No leídos' }, ...clientStatuses].map(s => (
            <button key={s.value} onClick={() => handleFilterChange(s.value)}
              className={`whitespace-nowrap px-3 py-1 rounded-full text-xs font-medium transition-colors flex-shrink-0 ${
                filterStatus === s.value
                  ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}>
              {s.label}
            </button>
          ))}
        </div>

        {/* Contact list */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex justify-center py-10">
              <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-slate-400 dark:text-slate-500 text-sm">
              {search ? 'Sin resultados' : 'No hay contactos'}
            </div>
          ) : (
            filtered.slice(0, visibleCount).map(client => (
              <button
                key={client.id}
                onClick={() => handleSelectClient(client)}
                className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 active:bg-slate-100 dark:active:bg-slate-800 transition-colors border-b border-slate-50 dark:border-slate-800/50 text-left ${
                  selectedId === client.id ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                }`}
              >
                {/* Avatar */}
                <div className="relative">
                  <Avatar name={client.name} size={46} />
                  {client.categoryId && (
                    <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white dark:border-slate-900"
                      style={{ backgroundColor: getCategoryColor(client.categoryId) }} />
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className={`font-semibold text-sm truncate ${(client.unreadCount ?? 0) > 0 ? 'text-slate-900 dark:text-white' : 'text-slate-700 dark:text-slate-300'}`}>{client.name}</span>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {(client.unreadCount ?? 0) > 0 ? (
                        <span className="bg-[#25D366] text-white text-[10px] font-bold min-w-[18px] h-[18px] flex items-center justify-center rounded-full px-1">
                          {client.unreadCount! > 99 ? '99+' : client.unreadCount}
                        </span>
                      ) : client.lastMessageAt ? (
                        <span className="text-[10px] text-slate-400 dark:text-slate-500">{formatLastTime(client.lastMessageAt)}</span>
                      ) : null}
                    </div>
                  </div>
                  {/* Preview último mensaje (estilo inbox) */}
                  <p className={`text-xs truncate mt-0.5 ${(client.unreadCount ?? 0) > 0 ? 'text-slate-700 dark:text-slate-300 font-medium' : 'text-slate-400 dark:text-slate-500'}`}>
                    {client.lastMessage || getDisplayPhone(client) || (client.isLid ? 'Número privado' : 'Sin teléfono')}
                  </p>
                  {/* Teléfono secundario solo si hay lastMessage */}
                  {client.lastMessage && (
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate mt-0.5">
                      {getDisplayPhone(client) || (client.isLid ? 'Número privado' : '')}
                    </p>
                  )}
                  {profile?.role !== 'agent' && client.assignedTo && agents.length > 0 && (
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate">
                      {agents.find(a => a.uid === client.assignedTo)?.displayName || 'Sin asignar'}
                    </p>
                  )}
                </div>
              </button>
            ))
          )}
        </div>

        {filtered.length > visibleCount && (
          <button
            onClick={() => setVisibleCount(v => v + 50)}
            className="w-full py-3 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors border-t border-slate-100 dark:border-slate-800">
            Ver más ({filtered.length - visibleCount} restantes)
          </button>
        )}
        <input ref={importRef} type="file" accept=".csv" className="hidden" onChange={handleImport} />
      </div>

      {/* ── Right panel: chat ────────────────────────────────────── */}
      <div className={`
        flex-col flex-1 min-w-0 min-h-0
        ${showMobileChat ? 'flex' : 'hidden lg:flex'}
      `}>
        {selectedClient ? (
          <>
            {/* Chat header */}
            <div className="flex items-center gap-3 px-4 py-3 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 flex-shrink-0">
              <button
                onClick={() => setShowMobileChat(false)}
                className="lg:hidden p-1.5 -ml-1 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
                <ArrowLeft size={20} />
              </button>
              <Avatar name={selectedClient.name} size={38} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-slate-900 dark:text-white text-sm leading-tight truncate">{selectedClient.name}</p>
                  <select
                    value={selectedClient.status}
                    onChange={async (e) => {
                      const newStatus = e.target.value
                      if (!profile?.orgId) return
                      try {
                        await updateClient(profile.orgId, selectedClient.id, { status: newStatus })
                        setClients(prev => prev.map(c => c.id === selectedClient.id ? { ...c, status: newStatus } : c))
                      } catch { toast.error('Error al cambiar estado') }
                    }}
                    className="text-[10px] font-medium px-1.5 py-0.5 rounded-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 focus:outline-none focus:border-slate-400 dark:focus:border-slate-500 cursor-pointer"
                    style={{ maxWidth: '100px' }}
                  >
                    {clientStatuses.map(s => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-tight mt-0.5">
                  {getDisplayPhone(selectedClient) || (selectedClient.isLid ? 'Número privado' : 'Sin teléfono')}
                </p>
              </div>
              <Link
                href={`/dashboard/clients/${selectedClient.id}`}
                className="p-2 text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex-shrink-0"
                title="Ver perfil completo">
                <User size={18} />
              </Link>
            </div>

            {/* Chat messages */}
            <div className="flex-1 min-h-0 overflow-hidden">
              <ChatWindow client={selectedClient} hasWhatsApp={hasWhatsApp} fitParent />
            </div>
          </>
        ) : (
          /* Empty state */
          <div className="flex-1 flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-900 text-slate-400 dark:text-slate-500 select-none">
            <div className="w-24 h-24 bg-slate-200 dark:bg-slate-800 rounded-full flex items-center justify-center mb-5">
              <MessageCircle size={40} className="text-slate-300 dark:text-slate-600" />
            </div>
            <p className="font-semibold text-slate-500 dark:text-slate-400 text-lg">Bienvenido a Chats</p>
            <p className="text-sm mt-1.5 text-slate-400 dark:text-slate-500">Selecciona un contacto para abrir la conversación</p>
            <button onClick={() => setShowForm(true)}
              className="mt-6 flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl shadow-lg shadow-blue-500/20 transition-colors">
              <Plus size={16} /> Nuevo contacto
            </button>
          </div>
        )}
      </div>

      <Modal open={showForm} onClose={() => setShowForm(false)} title="Nuevo cliente" size="lg">
        <ClientForm categories={categories} clientStatuses={clientStatuses} existing={null} onSuccess={() => setShowForm(false)} />
      </Modal>
    </div>
  )
}
