'use client'

import { useEffect, useRef, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { subscribeToClients, getCategories, createClient, getOrgUsers, getOrganization, updateClient } from '@/lib/firestore'
import type { Client, Category, AppUser, ClientStatus } from '@/types'
import { DEFAULT_CLIENT_STATUSES } from '@/types'
import Modal from '@/components/ui/Modal'
import ClientForm from '@/components/clients/ClientForm'
import ChatWindow from '@/components/chat/ChatWindow'
import EmailLeadPanel from '@/components/clients/EmailLeadPanel'
import { Plus, Search, Download, Upload, MessageCircle, Mail, Phone } from 'lucide-react'
import toast from 'react-hot-toast'
import { getChannel, type ClientChannel } from '@/lib/channel'
import { listAllCampaigns, type CampaignOption } from '@/lib/outreach/clientCampaigns'

const CHANNEL_TABS: { value: '' | ClientChannel; label: string; icon: typeof Phone }[] = [
  { value: '', label: 'Todos', icon: MessageCircle },
  { value: 'whatsapp', label: 'WhatsApp', icon: Phone },
  { value: 'email', label: 'Email', icon: Mail },
]

function ChannelIcon({ channel, size = 12 }: { channel: ClientChannel; size?: number }) {
  if (channel === 'whatsapp') return <Phone size={size} className="text-[#25D366]" />
  if (channel === 'email') return <Mail size={size} className="text-[#3b82f6]" />
  return null
}

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

function getIdentityLine(c: Client): string | null {
  if (getChannel(c) === 'email') return c.email || null
  return getDisplayPhone(c)
}

export default function ClientsPage() {
  const { profile, user } = useAuth()
  const [clients, setClients] = useState<Client[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [agents, setAgents] = useState<AppUser[]>([])
  const [clientStatuses, setClientStatuses] = useState<ClientStatus[]>(DEFAULT_CLIENT_STATUSES)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterChannel, setFilterChannel] = useState<'' | ClientChannel>('')
  const [filterProduct, setFilterProduct] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showMobileChat, setShowMobileChat] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [importing, setImporting] = useState(false)
  const [visibleCount, setVisibleCount] = useState(50)
  const [bulkEnrolling, setBulkEnrolling] = useState(false)
  const [campaignOptions, setCampaignOptions] = useState<CampaignOption[]>([])
  const importRef = useRef<HTMLInputElement>(null)

  const [hasWhatsApp, setHasWhatsApp] = useState(true) // Usa Baileys — siempre activo
  const selectedClient = clients.find(c => c.id === selectedId) || null
  const totalUnread = clients.reduce((s, c) => s + (c.unreadCount ?? 0), 0)

  useEffect(() => {
    if (!profile?.orgId) { setLoading(false); return }
    getCategories(profile.orgId).then(setCategories)
    listAllCampaigns(profile.orgId).then(setCampaignOptions).catch(() => {})
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
  const handleChannelChange = (val: '' | ClientChannel) => { setFilterChannel(val); setFilterProduct(''); setVisibleCount(50) }
  const handleProductChange = (val: string) => { setFilterProduct(val); setVisibleCount(50) }
  const handleSearchChange = (val: string) => { setSearch(val); setVisibleCount(50) }

  // Negocios/campañas presentes entre los leads de email — se calcula solo,
  // no requiere configurar nada a mano al agregar un negocio nuevo.
  const emailProducts = Array.from(
    new Set(clients.filter(c => getChannel(c) === 'email').map(c => c.product || 'stod'))
  )
  const campaignLabel = (id: string) => campaignOptions.find(c => c.id === id)?.businessLabel || id

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
    const matchChannel = !filterChannel || getChannel(c) === filterChannel
    const matchProduct = !filterProduct || (c.product || 'stod') === filterProduct
    return matchSearch && matchStatus && matchChannel && matchProduct
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
    const headers = ['Nombre', 'Email', 'Teléfono', 'WhatsApp', 'Estado', 'Etiquetas', 'Notas', 'Negocio', 'Rubro', 'Sitio web', 'Idioma']
    const rows = filtered.map(c => [
      c.name, c.email || '', c.phone || '', c.whatsappPhone || '', c.status,
      (c.tags || []).join(';'), c.notes || '',
      c.product || '', c.specialty || '', c.website || '', c.language || '',
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
        const [name, email, phone, whatsappPhone, status, tags, notes, product, specialty, website, language] = cols
        if (!name) continue
        await createClient(profile.orgId, {
          name, email: email || undefined, phone: phone || undefined,
          whatsappPhone: whatsappPhone || undefined,
          status: (['lead', 'prospect', 'active', 'inactive'].includes(status) ? status : 'lead') as Client['status'],
          tags: tags ? tags.split(';').filter(Boolean) : [],
          photos: [], notes: notes || undefined,
          product: product || undefined,
          specialty: specialty || undefined,
          website: website || undefined,
          language: (['es', 'en', 'de'].includes(language) ? language : 'es') as Client['language'],
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

  // Leads de email pendientes de activar: excluye ya-enrolados y los marcados
  // como "alianza" (ej. CDO) que requieren un mensaje distinto, hecho a mano.
  // Respeta el filtro de negocio activo — nunca mezcla campañas de negocios distintos.
  const pendingEmailLeads = clients.filter(c =>
    getChannel(c) === 'email' &&
    c.outreachStatus !== 'enrolled' &&
    !(c.notes || '').toLowerCase().includes('alianza') &&
    (!filterProduct || (c.product || 'stod') === filterProduct)
  )

  const bulkEnrollPending = async () => {
    if (!profile?.orgId || !user || pendingEmailLeads.length === 0) return
    const confirmed = window.confirm(
      `¿Activar la secuencia de outreach para ${pendingEmailLeads.length} leads? Se enviará el correo del día 0 en el próximo envío programado.`
    )
    if (!confirmed) return

    setBulkEnrolling(true)
    let ok = 0, failed = 0
    try {
      const token = await user.getIdToken()
      for (const lead of pendingEmailLeads) {
        try {
          const res = await fetch('/api/outreach', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ action: 'enroll', orgId: profile.orgId, clientId: lead.id }),
          })
          if (res.ok) ok++
          else failed++
        } catch {
          failed++
        }
      }
      toast.success(`Secuencia activada: ${ok} leads${failed > 0 ? `, ${failed} fallaron` : ''}`)
    } finally {
      setBulkEnrolling(false)
    }
  }

  const selectedChannel = selectedClient ? getChannel(selectedClient) : null
  const isEmailLead = selectedChannel === 'email'

  const chatWindowProps = selectedClient && !isEmailLead ? {
    client: selectedClient,
    hasWhatsApp,
    fitParent: true as const,
    statusOptions: clientStatuses,
    currentStatus: selectedClient.status,
    onStatusChange: async (newStatus: string) => {
      if (!profile?.orgId) return
      try {
        await updateClient(profile.orgId, selectedClient.id, { status: newStatus })
        setClients(prev => prev.map(c => c.id === selectedClient.id ? { ...c, status: newStatus } : c))
      } catch { toast.error('Error al cambiar estado') }
    },
    profileHref: `/dashboard/clients/${selectedClient.id}`,
    onBack: () => setShowMobileChat(false),
  } : null

  return (
    <div className="flex flex-1 min-h-0 overflow-hidden">

      {/* ── Left panel: contact list ─────────────────────────────── */}
      <div className="flex flex-col w-full lg:w-80 xl:w-96 bg-white dark:bg-[#0F1829] border-r border-[#E3E6EC] dark:border-[#1A2540] flex-shrink-0">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-[#F4F5F7] dark:bg-[#0F1829]/50 border-b border-[#E3E6EC] dark:border-[#1A2540]">
          <div className="flex items-center gap-2">
            <h1 className="font-bold text-[#0C1224] dark:text-[#E8ECF4] text-base">Clientes</h1>
            {totalUnread > 0 && (
              <span className="bg-[#25D366] text-white text-[10px] font-bold min-w-[18px] h-[18px] flex items-center justify-center rounded-full px-1">
                {totalUnread > 99 ? '99+' : totalUnread}
              </span>
            )}
          </div>
          <div className="flex items-center gap-0.5">
            <button onClick={() => importRef.current?.click()} disabled={importing}
              title="Importar CSV"
              className="p-2 rounded-full text-[#68748D] dark:text-[#9BA5B7] hover:bg-[#E3E6EC] dark:hover:bg-[#1A2540] transition-colors">
              <Upload size={16} />
            </button>
            <button onClick={exportCSV} title="Exportar CSV"
              className="p-2 rounded-full text-[#68748D] dark:text-[#9BA5B7] hover:bg-[#E3E6EC] dark:hover:bg-[#1A2540] transition-colors">
              <Download size={16} />
            </button>
            <button onClick={() => setShowForm(true)} title="Nuevo cliente"
              className="p-2 rounded-full text-[#68748D] dark:text-[#9BA5B7] hover:bg-[#E3E6EC] dark:hover:bg-[#1A2540] transition-colors">
              <Plus size={16} />
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="px-3 py-2 border-b border-[#E3E6EC] dark:border-[#1A2540]">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9BA5B7] pointer-events-none" />
            <input
              value={search}
              onChange={e => handleSearchChange(e.target.value)}
              placeholder="Buscar contacto..."
              className="w-full pl-8 pr-3 py-1.5 bg-[#F4F5F7] dark:bg-[#1A2540] rounded-full text-sm text-[#0C1224] dark:text-[#E8ECF4] placeholder-slate-400 focus:outline-none focus:bg-[#E3E6EC] dark:focus:bg-slate-700 transition-colors"
            />
          </div>
        </div>

        {/* Channel filter tabs */}
        <div className="flex gap-1.5 px-3 py-2 border-b border-[#E3E6EC] dark:border-[#1A2540] overflow-x-auto scrollbar-none">
          {CHANNEL_TABS.map(t => (
            <button key={t.value} onClick={() => handleChannelChange(t.value)}
              className={`whitespace-nowrap flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium transition-colors flex-shrink-0 ${
                filterChannel === t.value
                  ? 'bg-slate-900 dark:bg-white text-white dark:text-[#0C1224]'
                  : 'bg-[#F4F5F7] dark:bg-[#1A2540] text-[#68748D] dark:text-[#9BA5B7] hover:bg-[#E3E6EC] dark:hover:bg-[#1A2540]'
              }`}>
              <t.icon size={12} />
              {t.label}
            </button>
          ))}
        </div>

        {/* Negocio/campaña — aparece solo cuando hay más de uno, para no generar ruido con un solo negocio activo */}
        {filterChannel === 'email' && emailProducts.length > 1 && (
          <div className="flex gap-1.5 px-3 py-2 border-b border-[#E3E6EC] dark:border-[#1A2540] overflow-x-auto scrollbar-none">
            <button onClick={() => handleProductChange('')}
              className={`whitespace-nowrap px-3 py-1 rounded-full text-xs font-medium flex-shrink-0 ${
                filterProduct === '' ? 'bg-slate-900 dark:bg-white text-white dark:text-[#0C1224]' : 'bg-[#F4F5F7] dark:bg-[#1A2540] text-[#68748D]'
              }`}>Todos los negocios</button>
            {emailProducts.map(p => (
              <button key={p} onClick={() => handleProductChange(p)}
                className={`whitespace-nowrap px-3 py-1 rounded-full text-xs font-medium flex-shrink-0 ${
                  filterProduct === p ? 'bg-slate-900 dark:bg-white text-white dark:text-[#0C1224]' : 'bg-[#F4F5F7] dark:bg-[#1A2540] text-[#68748D]'
                }`}>{campaignLabel(p)}</button>
            ))}
          </div>
        )}

        {/* Activación masiva de secuencia — solo visible en la pestaña Email.
            Si hay más de un negocio, exige elegir uno específico primero (nunca mezcla campañas). */}
        {filterChannel === 'email' && pendingEmailLeads.length > 0 && (emailProducts.length <= 1 || filterProduct !== '') && (
          <div className="px-3 py-2 border-b border-[#E3E6EC] dark:border-[#1A2540] bg-blue-50 dark:bg-blue-900/10">
            <button onClick={bulkEnrollPending} disabled={bulkEnrolling}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-xs font-semibold bg-[#0D7A65] text-white hover:bg-[#0a5f4f] disabled:opacity-50">
              {bulkEnrolling ? 'Activando...' : `Activar secuencia para los ${pendingEmailLeads.length} leads pendientes`}
            </button>
          </div>
        )}
        {filterChannel === 'email' && emailProducts.length > 1 && filterProduct === '' && (
          <div className="px-3 py-2 text-[11px] text-[#9BA5B7] border-b border-[#E3E6EC] dark:border-[#1A2540]">
            Elige un negocio arriba para activar su secuencia (no se mezclan campañas).
          </div>
        )}

        {/* Status filter tabs */}
        <div className="flex gap-1.5 px-3 py-2 border-b border-[#E3E6EC] dark:border-[#1A2540] overflow-x-auto scrollbar-none">
          {[{ value: '', label: 'Todos' }, { value: '__unread__', label: '● No leídos' }, ...clientStatuses].map(s => (
            <button key={s.value} onClick={() => handleFilterChange(s.value)}
              className={`whitespace-nowrap px-3 py-1 rounded-full text-xs font-medium transition-colors flex-shrink-0 ${
                filterStatus === s.value
                  ? 'bg-slate-900 dark:bg-white text-white dark:text-[#0C1224]'
                  : 'bg-[#F4F5F7] dark:bg-[#1A2540] text-[#68748D] dark:text-[#9BA5B7] hover:bg-[#E3E6EC] dark:hover:bg-[#1A2540]'
              }`}>
              {s.label}
            </button>
          ))}
        </div>

        {/* Contact list */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex justify-center py-10">
              <div className="w-6 h-6 border-2 border-[#0D7A65] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-[#9BA5B7] dark:text-[#68748D] text-sm">
              {search ? 'Sin resultados' : 'No hay contactos'}
            </div>
          ) : (
            filtered.slice(0, visibleCount).map(client => (
              <button
                key={client.id}
                onClick={() => handleSelectClient(client)}
                className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-[#F4F5F7] dark:hover:bg-[#1A2540]/50 active:bg-[#F4F5F7] dark:active:bg-slate-800 transition-colors border-b border-slate-50 dark:border-[#1A2540]/50 text-left ${
                  selectedId === client.id ? 'bg-[#F4F5F7] dark:bg-[#0D7A65]/10' : ''
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
                    <span className={`flex items-center gap-1 font-semibold text-sm truncate ${(client.unreadCount ?? 0) > 0 ? 'text-[#0C1224] dark:text-[#E8ECF4]' : 'text-[#0C1224] dark:text-[#9BA5B7]'}`}>
                      <ChannelIcon channel={getChannel(client)} />
                      <span className="truncate">{client.name}</span>
                    </span>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {(client.unreadCount ?? 0) > 0 ? (
                        <span className="bg-[#25D366] text-white text-[10px] font-bold min-w-[18px] h-[18px] flex items-center justify-center rounded-full px-1">
                          {client.unreadCount! > 99 ? '99+' : client.unreadCount}
                        </span>
                      ) : client.lastMessageAt ? (
                        <span className="text-[10px] text-[#9BA5B7] dark:text-[#68748D]">{formatLastTime(client.lastMessageAt)}</span>
                      ) : null}
                    </div>
                  </div>
                  {/* Preview último mensaje (estilo inbox) */}
                  <p className={`text-xs truncate mt-0.5 ${(client.unreadCount ?? 0) > 0 ? 'text-[#0C1224] dark:text-[#9BA5B7] font-medium' : 'text-[#9BA5B7] dark:text-[#68748D]'}`}>
                    {client.lastMessage || getIdentityLine(client) || (client.isLid ? 'Número privado' : 'Sin contacto')}
                  </p>
                  {/* Identidad secundaria (email o teléfono) solo si hay lastMessage */}
                  {client.lastMessage && (
                    <p className="text-[10px] text-[#9BA5B7] dark:text-[#68748D] truncate mt-0.5">
                      {getIdentityLine(client) || (client.isLid ? 'Número privado' : '')}
                    </p>
                  )}
                  {profile?.role !== 'agent' && client.assignedTo && agents.length > 0 && (
                    <p className="text-[10px] text-[#9BA5B7] dark:text-[#68748D] truncate">
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
            className="w-full py-3 text-sm text-[#68748D] dark:text-[#9BA5B7] hover:text-[#0C1224] dark:hover:text-slate-200 hover:bg-[#F4F5F7] dark:hover:bg-[#1A2540] transition-colors border-t border-[#E3E6EC] dark:border-[#1A2540]">
            Ver más ({filtered.length - visibleCount} restantes)
          </button>
        )}
        <input ref={importRef} type="file" accept=".csv" className="hidden" onChange={handleImport} />
      </div>

      {/* ── Right panel: desktop only ────────────────────────────── */}
      <div className="hidden lg:flex flex-col flex-1 min-w-0 min-h-0">
        {isEmailLead && selectedClient && profile?.orgId ? (
          <EmailLeadPanel client={selectedClient} orgId={profile.orgId} />
        ) : chatWindowProps ? (
          <div className="flex-1 min-h-0 overflow-hidden">
            <ChatWindow {...chatWindowProps} />
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center bg-[#F4F5F7] dark:bg-[#0F1829] text-[#9BA5B7] dark:text-[#68748D] select-none">
            <div className="w-24 h-24 bg-[#E3E6EC] dark:bg-[#1A2540] rounded-full flex items-center justify-center mb-5">
              <MessageCircle size={40} className="text-[#9BA5B7] dark:text-[#68748D]" />
            </div>
            <p className="font-semibold text-[#68748D] dark:text-[#9BA5B7] text-lg">Bienvenido a Clientes</p>
            <p className="text-sm mt-1.5 text-[#9BA5B7] dark:text-[#68748D]">Selecciona un contacto para abrir la conversación</p>
            <button onClick={() => setShowForm(true)}
              className="mt-6 flex items-center gap-2 px-5 py-2.5 bg-[#0C1224] hover:bg-[#1B2B4B] text-white text-sm font-bold rounded-md shadow-lg transition-colors">
              <Plus size={16} /> Nuevo contacto
            </button>
          </div>
        )}
      </div>

      {/* ── Overlay móvil: pantalla completa al abrir un chat ───── */}
      {showMobileChat && isEmailLead && selectedClient && profile?.orgId && (
        <div className="lg:hidden fixed inset-0 z-[60] flex flex-col">
          <EmailLeadPanel client={selectedClient} orgId={profile.orgId} onBack={() => setShowMobileChat(false)} />
        </div>
      )}
      {showMobileChat && !isEmailLead && chatWindowProps && (
        <div className="lg:hidden fixed inset-0 z-[60] flex flex-col">
          <ChatWindow {...chatWindowProps} />
        </div>
      )}

      <Modal open={showForm} onClose={() => setShowForm(false)} title="Nuevo cliente" size="lg">
        <ClientForm categories={categories} clientStatuses={clientStatuses} existing={null} onSuccess={() => setShowForm(false)} />
      </Modal>
    </div>
  )
}
