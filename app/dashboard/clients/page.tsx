'use client'

import { useEffect, useRef, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { subscribeToClients, getCategories, deleteClient, createClient, getOrgUsers } from '@/lib/firestore'
import type { Client, Category, AppUser } from '@/types'
import Modal from '@/components/ui/Modal'
import ClientForm from '@/components/clients/ClientForm'
import Link from 'next/link'
import { Plus, Search, Trash2, Eye, Phone, Mail, MessageCircle, Download, Upload, ChevronLeft, ChevronRight, UserCheck } from 'lucide-react'
import toast from 'react-hot-toast'

const PAGE_SIZE = 12

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  lead: { label: 'Lead', color: 'bg-gray-100 text-gray-600' },
  prospect: { label: 'Prospecto', color: 'bg-gray-200 text-gray-700' },
  active: { label: 'Activo', color: 'bg-gray-900 text-white' },
  inactive: { label: 'Inactivo', color: 'bg-gray-100 text-gray-400' },
}

export default function ClientsPage() {
  const { profile } = useAuth()
  const [clients, setClients] = useState<Client[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [agents, setAgents] = useState<AppUser[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterAgent, setFilterAgent] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editClient, setEditClient] = useState<Client | null>(null)
  const [page, setPage] = useState(1)
  const [importing, setImporting] = useState(false)
  const importRef = useRef<HTMLInputElement>(null)

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

  useEffect(() => { setPage(1) }, [search, filterCategory, filterStatus, filterAgent])

  const filtered = clients.filter(c => {
    const matchSearch = !search || c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.email?.toLowerCase().includes(search.toLowerCase()) ||
      c.phone?.includes(search)
    const matchCat = !filterCategory || c.categoryId === filterCategory
    const matchStatus = !filterStatus || c.status === filterStatus
    const matchAgent = !filterAgent || c.assignedTo === filterAgent
    return matchSearch && matchCat && matchStatus && matchAgent
  })

  const getAgentName = (uid?: string) => agents.find(a => a.uid === uid)?.displayName || ''

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  // Detect duplicates by phone or email
  const duplicates = (() => {
    const phoneMap: Record<string, Client[]> = {}
    const emailMap: Record<string, Client[]> = {}
    clients.forEach(c => {
      if (c.phone) { phoneMap[c.phone] = [...(phoneMap[c.phone] || []), c] }
      if (c.email) { emailMap[c.email] = [...(emailMap[c.email] || []), c] }
    })
    const dup = new Set<string>()
    Object.values(phoneMap).filter(arr => arr.length > 1).forEach(arr => arr.forEach(c => dup.add(c.id)))
    Object.values(emailMap).filter(arr => arr.length > 1).forEach(arr => arr.forEach(c => dup.add(c.id)))
    return dup
  })()

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar este cliente?') || !profile?.orgId) return
    await deleteClient(profile.orgId, id)
    toast.success('Cliente eliminado')
  }

  const getCategoryName = (id?: string) => categories.find(c => c.id === id)?.name || ''
  const getCategoryColor = (id?: string) => categories.find(c => c.id === id)?.color || '#6b7280'

  // ── Exportar CSV ────────────────────────────────────────────
  const exportCSV = () => {
    const headers = ['Nombre', 'Email', 'Teléfono', 'WhatsApp', 'Estado', 'Categoría', 'Etiquetas', 'Notas']
    const rows = filtered.map(c => [
      c.name,
      c.email || '',
      c.phone || '',
      c.whatsappPhone || '',
      c.status,
      getCategoryName(c.categoryId),
      (c.tags || []).join(';'),
      (c.notes || '').replace(/\n/g, ' '),
    ])
    const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `clientes_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success(`${filtered.length} clientes exportados`)
  }

  // ── Importar CSV ────────────────────────────────────────────
  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !profile?.orgId) return
    setImporting(true)
    try {
      const text = await file.text()
      const lines = text.split('\n').filter(Boolean)
      // Skip header row
      const dataLines = lines.slice(1)
      let created = 0
      for (const line of dataLines) {
        const cols = line.split(',').map(v => v.replace(/^"|"$/g, '').trim())
        const [name, email, phone, whatsappPhone, status, , tags, notes] = cols
        if (!name) continue
        await createClient(profile.orgId, {
          name,
          email: email || undefined,
          phone: phone || undefined,
          whatsappPhone: whatsappPhone || undefined,
          status: (['lead', 'prospect', 'active', 'inactive'].includes(status) ? status : 'lead') as Client['status'],
          tags: tags ? tags.split(';').filter(Boolean) : [],
          photos: [],
          notes: notes || undefined,
          assignedTo: profile.uid,
          createdBy: profile.uid,
          pipelineStage: 'new',
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Clientes</h1>
          <p className="text-gray-500 text-sm mt-1">{filtered.length} clientes</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={exportCSV}
            className="flex items-center gap-2 bg-white border border-gray-300 hover:border-gray-400 text-gray-700 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors"
          >
            <Download size={15} /> Exportar CSV
          </button>
          <button
            onClick={() => importRef.current?.click()}
            disabled={importing}
            className="flex items-center gap-2 bg-white border border-gray-300 hover:border-gray-400 text-gray-700 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
          >
            <Upload size={15} /> {importing ? 'Importando...' : 'Importar CSV'}
          </button>
          <input ref={importRef} type="file" accept=".csv" className="hidden" onChange={handleImport} />
          <button
            onClick={() => { setEditClient(null); setShowForm(true) }}
            className="flex items-center gap-2 bg-gray-900 hover:bg-gray-800 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
          >
            <Plus size={18} /> Nuevo cliente
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nombre, email o teléfono..."
            className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-gray-500"
          />
        </div>
        <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)}
          className="bg-white border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:border-gray-500">
          <option value="">Todas las categorías</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className="bg-white border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:border-gray-500">
          <option value="">Todos los estados</option>
          <option value="lead">Lead</option>
          <option value="prospect">Prospecto</option>
          <option value="active">Activo</option>
          <option value="inactive">Inactivo</option>
        </select>
        {agents.length > 0 && (
          <select value={filterAgent} onChange={e => setFilterAgent(e.target.value)}
            className="bg-white border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:border-gray-500">
            <option value="">Todos los agentes</option>
            {agents.map(a => <option key={a.uid} value={a.uid}>{a.displayName}</option>)}
          </select>
        )}
      </div>

      {/* Duplicates warning */}
      {duplicates.size > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center gap-3 text-sm">
          <span className="text-amber-600 font-medium">⚠ {duplicates.size} clientes con teléfono o email duplicado</span>
          <span className="text-amber-500 text-xs">Revisa y consolida los registros duplicados.</span>
        </div>
      )}

      {/* Lista */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-gray-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
          <p className="text-gray-400">No hay clientes. Agrega el primero.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {paginated.map(client => (
              <div key={client.id} className={`bg-white border rounded-xl p-5 hover:shadow-sm transition-all ${duplicates.has(client.id) ? 'border-amber-200 bg-amber-50/30' : 'border-gray-200 hover:border-gray-300'}`}>
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 truncate">{client.name}</h3>
                    {client.categoryId && (
                      <span className="inline-block text-xs px-2 py-0.5 rounded-full mt-1 font-medium"
                        style={{ backgroundColor: getCategoryColor(client.categoryId) + '22', color: getCategoryColor(client.categoryId) }}>
                        {getCategoryName(client.categoryId)}
                      </span>
                    )}
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${STATUS_LABELS[client.status]?.color}`}>
                    {STATUS_LABELS[client.status]?.label}
                  </span>
                </div>

                <div className="space-y-1 text-sm text-gray-500 mb-3">
                  {client.phone && <div className="flex items-center gap-2"><Phone size={13} /><span>{client.phone}</span></div>}
                  {client.email && <div className="flex items-center gap-2"><Mail size={13} /><span className="truncate">{client.email}</span></div>}
                </div>

                {client.tags?.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-3">
                    {client.tags.map(tag => (
                      <span key={tag} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{tag}</span>
                    ))}
                  </div>
                )}

                {client.photos?.length > 0 && (
                  <div className="flex gap-1 mb-3">
                    {client.photos.slice(0, 4).map((url, i) => (
                      <img key={i} src={url} alt="" className="w-10 h-10 object-cover rounded-lg border border-gray-200" />
                    ))}
                    {client.photos.length > 4 && (
                      <div className="w-10 h-10 bg-gray-100 rounded-lg border border-gray-200 flex items-center justify-center text-xs text-gray-500">
                        +{client.photos.length - 4}
                      </div>
                    )}
                  </div>
                )}

                {agents.length > 0 && client.assignedTo && (
                  <div className="flex items-center gap-1.5 text-xs text-gray-400 mb-2">
                    <UserCheck size={12} />
                    <span>{getAgentName(client.assignedTo) || '—'}</span>
                  </div>
                )}

                <div className="flex gap-2 pt-3 border-t border-gray-100">
                  <button onClick={() => { setEditClient(client); setShowForm(true) }}
                    className="flex-1 flex items-center justify-center gap-1.5 text-xs text-gray-500 hover:text-gray-900 py-1.5 rounded-lg hover:bg-gray-100 transition-colors">
                    <Eye size={13} /> Editar
                  </button>
                  <Link href={`/dashboard/clients/${client.id}`}
                    className="flex-1 flex items-center justify-center gap-1.5 text-xs text-gray-500 hover:text-gray-900 py-1.5 rounded-lg hover:bg-gray-100 transition-colors">
                    <MessageCircle size={13} /> Chat
                  </Link>
                  <button onClick={() => handleDelete(client.id)}
                    className="flex items-center justify-center p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Paginación */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 pt-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="p-2 rounded-lg border border-gray-200 text-gray-500 hover:border-gray-400 disabled:opacity-30 transition-colors">
                <ChevronLeft size={16} />
              </button>
              <span className="text-sm text-gray-600">
                Página <span className="font-semibold">{page}</span> de <span className="font-semibold">{totalPages}</span>
              </span>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                className="p-2 rounded-lg border border-gray-200 text-gray-500 hover:border-gray-400 disabled:opacity-30 transition-colors">
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </>
      )}

      <Modal open={showForm} onClose={() => { setShowForm(false); setEditClient(null) }}
        title={editClient ? 'Editar cliente' : 'Nuevo cliente'} size="lg">
        <ClientForm categories={categories} existing={editClient}
          onSuccess={() => { setShowForm(false); setEditClient(null) }} />
      </Modal>
    </div>
  )
}
