'use client'

import { useEffect, useRef, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { subscribeToClients, getCategories, createClient, getOrgUsers } from '@/lib/firestore'
import type { Client, Category, AppUser } from '@/types'
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

const STATUS_LABELS: Record<string, string> = {
  '': 'Todos',
  lead: 'Lead',
  prospect: 'Prospecto',
  active: 'Activo',
  inactive: 'Inactivo',
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
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showMobileChat, setShowMobileChat] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [importing, setImporting] = useState(false)
  const importRef = useRef<HTMLInputElement>(null)

  const hasWhatsApp = process.env.NEXT_PUBLIC_BAILEYS_ENABLED === 'true'
  const selectedClient = clients.find(c => c.id === selectedId) || null

  useEffect(() => {
    if (!profile?.orgId) { setLoading(false); return }
    getCategories(profile.orgId).then(setCategories)
    if (profile.role !== 'agent') {
      getOrgUsers(profile.orgId).then(users => setAgents(users.filter(u => u.role === 'agent')))
    }
    const unsub = subscribeToClients(
      profile.orgId,
      profile.role === 'agent' ? profile.uid : undefined,
      (c) => { setClients(c); setLoading(false) }
    )
    return unsub
  }, [profile])

  const filtered = clients.filter(c => {
    const matchSearch = !search ||
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.phone?.includes(search) ||
      c.whatsappPhone?.includes(search) ||
      c.email?.toLowerCase().includes(search.toLowerCase())
    const matchStatus = !filterStatus || c.status === filterStatus
    return matchSearch && matchStatus
  })

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
        flex-col w-full lg:w-80 xl:w-96 bg-white border-r border-gray-200 flex-shrink-0
        ${showMobileChat ? 'hidden lg:flex' : 'flex'}
      `}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-100">
          <h1 className="font-bold text-gray-900 text-base">Chats</h1>
          <div className="flex items-center gap-0.5">
            <button onClick={() => importRef.current?.click()} disabled={importing}
              title="Importar CSV"
              className="p-2 rounded-full text-gray-500 hover:bg-gray-200 transition-colors">
              <Upload size={16} />
            </button>
            <button onClick={exportCSV} title="Exportar CSV"
              className="p-2 rounded-full text-gray-500 hover:bg-gray-200 transition-colors">
              <Download size={16} />
            </button>
            <button onClick={() => setShowForm(true)} title="Nuevo cliente"
              className="p-2 rounded-full text-gray-500 hover:bg-gray-200 transition-colors">
              <Plus size={16} />
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="px-3 py-2 border-b border-gray-100">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar contacto..."
              className="w-full pl-8 pr-3 py-1.5 bg-gray-100 rounded-full text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:bg-gray-200 transition-colors"
            />
          </div>
        </div>

        {/* Status filter tabs */}
        <div className="flex gap-1.5 px-3 py-2 border-b border-gray-100 overflow-x-auto scrollbar-none">
          {['', 'lead', 'prospect', 'active', 'inactive'].map(s => (
            <button key={s} onClick={() => setFilterStatus(s)}
              className={`whitespace-nowrap px-3 py-1 rounded-full text-xs font-medium transition-colors flex-shrink-0 ${
                filterStatus === s ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}>
              {STATUS_LABELS[s]}
            </button>
          ))}
        </div>

        {/* Contact list */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex justify-center py-10">
              <div className="w-6 h-6 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-gray-400 text-sm">
              {search ? 'Sin resultados' : 'No hay contactos'}
            </div>
          ) : (
            filtered.map(client => (
              <button
                key={client.id}
                onClick={() => handleSelectClient(client)}
                className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 active:bg-gray-100 transition-colors border-b border-gray-50 text-left ${
                  selectedId === client.id ? 'bg-[#f0f2f5]' : ''
                }`}
              >
                {/* Avatar */}
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
                    <span className="font-semibold text-gray-900 text-sm truncate">{client.name}</span>
                    <span className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: STATUS_COLORS[client.status] || '#9ca3af' }} />
                  </div>
                  <p className="text-xs text-gray-500 truncate mt-0.5">
                    {getDisplayPhone(client) || (client.isLid ? 'Número privado' : 'Sin teléfono')}
                  </p>
                  {client.tags?.length > 0 && (
                    <div className="flex gap-1 mt-1 overflow-hidden">
                      {client.tags.slice(0, 3).map(tag => (
                        <span key={tag} className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full leading-none">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </button>
            ))
          )}
        </div>

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
            <div className="flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-200 flex-shrink-0">
              <button
                onClick={() => setShowMobileChat(false)}
                className="lg:hidden p-1.5 -ml-1 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-colors">
                <ArrowLeft size={20} />
              </button>
              <Avatar name={selectedClient.name} size={38} />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 text-sm leading-tight">{selectedClient.name}</p>
                <p className="text-xs text-gray-500 leading-tight mt-0.5">
                  {getDisplayPhone(selectedClient) || (selectedClient.isLid ? 'Número privado' : 'Sin teléfono')}
                </p>
              </div>
              <Link
                href={`/dashboard/clients/${selectedClient.id}`}
                className="p-2 text-gray-400 hover:text-gray-700 rounded-full hover:bg-gray-100 transition-colors flex-shrink-0"
                title="Ver perfil completo">
                <User size={18} />
              </Link>
            </div>

            {/* Chat messages */}
            <div className="flex-1 min-h-0 overflow-hidden">
              <ChatWindow client={selectedClient} hasWhatsApp={hasWhatsApp} />
            </div>
          </>
        ) : (
          /* Empty state */
          <div className="flex-1 flex flex-col items-center justify-center bg-[#f0f2f5] text-gray-400 select-none">
            <div className="w-24 h-24 bg-gray-200 rounded-full flex items-center justify-center mb-5">
              <MessageCircle size={40} className="text-gray-300" />
            </div>
            <p className="font-semibold text-gray-500 text-lg">Bienvenido a Chats</p>
            <p className="text-sm mt-1.5 text-gray-400">Selecciona un contacto para abrir la conversación</p>
            <button onClick={() => setShowForm(true)}
              className="mt-6 flex items-center gap-2 px-5 py-2.5 bg-gray-900 hover:bg-gray-800 text-white text-sm font-medium rounded-full transition-colors">
              <Plus size={16} /> Nuevo contacto
            </button>
          </div>
        )}
      </div>

      <Modal open={showForm} onClose={() => setShowForm(false)} title="Nuevo cliente" size="lg">
        <ClientForm categories={categories} existing={null} onSuccess={() => setShowForm(false)} />
      </Modal>
    </div>
  )
}
