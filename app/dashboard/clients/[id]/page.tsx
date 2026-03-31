'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { getClient, getOrganization, updateClient, getCategories, getTasks, getDeals, getOrgUsers } from '@/lib/firestore'
import { collection, getDocs, getDoc, doc as firestoreDoc, orderBy, query, deleteField } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { Client, Organization, Category, Task, Deal, Message, AppUser, ClientStatus } from '@/types'
import { DEFAULT_CLIENT_STATUSES } from '@/types'
import ChatWindow from '@/components/chat/ChatWindow'
import { ArrowLeft, User, MessageCircle, Save, Activity, CheckSquare, FolderKanban, MessageSquare, UserCheck } from 'lucide-react'
import toast from 'react-hot-toast'

interface TimelineEvent {
  id: string
  type: 'message' | 'task' | 'deal'
  title: string
  sub?: string
  date: Date
  icon: typeof MessageSquare
  color: string
}

const inputClass = 'w-full bg-white border border-gray-300 rounded-lg px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-gray-500'

export default function ClientDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { profile } = useAuth()
  const [client, setClient] = useState<Client | null>(null)
  const [org, setOrg] = useState<Organization | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [clientStatuses, setClientStatuses] = useState<ClientStatus[]>(DEFAULT_CLIENT_STATUSES)
  const [agents, setAgents] = useState<AppUser[]>([])
  const [tab, setTab] = useState<'chat' | 'info' | 'activity'>('chat')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [reassigning, setReassigning] = useState(false)
  const [tagInput, setTagInput] = useState('')
  const [timeline, setTimeline] = useState<TimelineEvent[]>([])
  const [qualSession, setQualSession] = useState<{
    state: string
    answers: Record<string, string>
    currentQuestion: number
  } | null>(null)

  // Formulario de edición
  const [form, setForm] = useState({
    name: '', email: '', phone: '', whatsappPhone: '',
    status: 'lead' as Client['status'], categoryId: '', notes: '', tags: [] as string[],
  })

  useEffect(() => {
    if (!profile?.orgId || !id) return
    Promise.all([
      getClient(profile.orgId, id),
      getOrganization(profile.orgId),
      getCategories(profile.orgId),
      profile.role !== 'agent' ? getOrgUsers(profile.orgId) : Promise.resolve([]),
      getDoc(firestoreDoc(db, 'organizations', profile.orgId, 'qualification_sessions', id)).catch(() => null),
    ]).then(([c, o, cats, users, qualSnap]) => {
      setClient(c)
      setOrg(o)
      setCategories(cats)
      if (o?.settings?.clientStatuses?.length) setClientStatuses(o.settings.clientStatuses)
      setAgents((users as AppUser[]).filter(u => u.role === 'agent'))
      if (c) setForm({
        name: c.name,
        email: c.email || '',
        phone: c.phone || '',
        whatsappPhone: c.whatsappPhone || '',
        status: c.status,
        categoryId: c.categoryId || '',
        notes: c.notes || '',
        tags: c.tags || [],
      })
      if (qualSnap && 'exists' in qualSnap && qualSnap.exists()) {
        setQualSession(qualSnap.data() as { state: string; answers: Record<string, string>; currentQuestion: number })
      }
      setLoading(false)
    }).catch(() => setLoading(false))

    // Load timeline data
    const loadTimeline = async () => {
      if (!profile?.orgId || !id) return
      const getTs = (d: unknown): Date => {
        if (!d) return new Date()
        if (d instanceof Date) return d
        if (typeof d === 'object' && 'seconds' in (d as object)) return new Date((d as { seconds: number }).seconds * 1000)
        return new Date(d as string)
      }

      const [tasksData, dealsData] = await Promise.all([
        getTasks(profile.orgId),
        getDeals(profile.orgId),
      ])

      const messagesSnap = await getDocs(
        query(collection(db, 'organizations', profile.orgId, 'clients', id, 'messages'), orderBy('createdAt', 'desc'))
      )
      const messages = messagesSnap.docs.map(d => ({ id: d.id, ...d.data() })) as Message[]

      const events: TimelineEvent[] = [
        ...messages.slice(0, 10).map(m => ({
          id: m.id,
          type: 'message' as const,
          title: m.source === 'whatsapp' ? 'Mensaje WhatsApp recibido' : `Mensaje enviado por ${m.senderName}`,
          sub: m.text ? m.text.substring(0, 80) : m.photos?.length ? `${m.photos.length} foto(s)` : '',
          date: getTs(m.createdAt),
          icon: MessageSquare,
          color: m.source === 'whatsapp' ? 'text-green-600 bg-green-50' : 'text-gray-600 bg-gray-100',
        })),
        ...tasksData.filter(t => t.clientId === id).map(t => ({
          id: t.id,
          type: 'task' as const,
          title: t.completed ? `Tarea completada: ${t.title}` : `Tarea creada: ${t.title}`,
          date: getTs(t.createdAt),
          icon: CheckSquare,
          color: t.completed ? 'text-green-600 bg-green-50' : 'text-amber-600 bg-amber-50',
        })),
        ...dealsData.filter(d => d.clientId === id).map(d => ({
          id: d.id,
          type: 'deal' as const,
          title: `Oportunidad: ${d.stage}`,
          sub: d.value ? `$${d.value.toLocaleString()}` : undefined,
          date: getTs(d.updatedAt),
          icon: FolderKanban,
          color: d.stage === 'closed_won' ? 'text-green-600 bg-green-50' : d.stage === 'closed_lost' ? 'text-red-600 bg-red-50' : 'text-blue-600 bg-blue-50',
        })),
      ].sort((a, b) => b.date.getTime() - a.date.getTime())

      setTimeline(events)
    }
    loadTimeline()
  }, [profile?.orgId, id])

  const handleSave = async () => {
    if (!profile?.orgId || !client) return
    setSaving(true)
    try {
      await updateClient(profile.orgId, client.id, {
        name: form.name,
        email: form.email || deleteField() as unknown as string,
        phone: form.phone || deleteField() as unknown as string,
        whatsappPhone: form.whatsappPhone || deleteField() as unknown as string,
        status: form.status,
        categoryId: form.categoryId || deleteField() as unknown as string,
        notes: form.notes || deleteField() as unknown as string,
        tags: form.tags,
      })
      setClient(prev => prev ? { ...prev, ...form } : prev)
      toast.success('Cliente actualizado')
    } catch {
      toast.error('Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  const handleReassign = async (newAgentUid: string) => {
    if (!profile?.orgId || !client) return
    setReassigning(true)
    try {
      await updateClient(profile.orgId, client.id, { assignedTo: newAgentUid })
      setClient(prev => prev ? { ...prev, assignedTo: newAgentUid } : prev)
      const agentName = agents.find(a => a.uid === newAgentUid)?.displayName || ''
      toast.success(`Reasignado a ${agentName}`)
    } catch {
      toast.error('Error al reasignar')
    } finally {
      setReassigning(false)
    }
  }

  const addTag = () => {
    const t = tagInput.trim()
    if (t && !form.tags.includes(t)) {
      setForm(f => ({ ...f, tags: [...f.tags, t] }))
      setTagInput('')
    }
  }

  if (loading) {
    return <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-gray-400 border-t-transparent rounded-full animate-spin" /></div>
  }
  if (!client) return <div className="text-center py-20 text-gray-500">Cliente no encontrado</div>

  const hasWhatsApp = !!(org?.settings?.whatsapp?.phoneNumberId && org?.settings?.whatsapp?.token) ||
    process.env.NEXT_PUBLIC_BAILEYS_ENABLED === 'true'
  const categoryName = categories.find(c => c.id === client.categoryId)?.name

  return (
    <div className="space-y-4 max-w-3xl mx-auto">
      <button onClick={() => router.back()}
        className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 transition-colors">
        <ArrowLeft size={16} /> Volver a clientes
      </button>

      {/* Header */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0">
            <User size={22} className="text-gray-500" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-gray-900">{client.name}</h1>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">{client.status}</span>
              {categoryName && <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">{categoryName}</span>}
              {client.whatsappPhone && hasWhatsApp && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-200">WhatsApp ●</span>
              )}
            </div>
            {/* Agente asignado */}
            {profile?.role !== 'agent' && agents.length > 0 && (
              <div className="flex items-center gap-2 mt-3">
                <UserCheck size={14} className="text-gray-400 flex-shrink-0" />
                <select
                  value={client.assignedTo || ''}
                  onChange={e => handleReassign(e.target.value)}
                  disabled={reassigning}
                  className="text-sm text-gray-700 border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:border-gray-400 disabled:opacity-50"
                >
                  <option value="">Sin asignar</option>
                  {agents.map(a => <option key={a.uid} value={a.uid}>{a.displayName}</option>)}
                </select>
                {reassigning && <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />}
              </div>
            )}
            {profile?.role === 'agent' && client.assignedTo === profile.uid && (
              <p className="text-xs text-gray-400 mt-2 flex items-center gap-1"><UserCheck size={12} /> Asignado a ti</p>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
        <button onClick={() => setTab('chat')}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === 'chat' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
          <MessageCircle size={15} /> Chat
        </button>
        <button onClick={() => setTab('info')}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === 'info' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
          <User size={15} /> Info
        </button>
        <button onClick={() => setTab('activity')}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === 'activity' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
          <Activity size={15} /> Actividad
        </button>
      </div>

      {tab === 'chat' && <ChatWindow client={client} hasWhatsApp={hasWhatsApp} />}

      {tab === 'info' && (
        <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Nombre *</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Estado</label>
              <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} className={inputClass}>
                {clientStatuses.map(s => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Email</label>
              <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className={inputClass} placeholder="correo@ejemplo.com" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Teléfono</label>
              <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} className={inputClass} placeholder="+1 234 567 8900" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">WhatsApp del cliente</label>
              <input value={form.whatsappPhone} onChange={e => setForm(f => ({ ...f, whatsappPhone: e.target.value }))} className={inputClass} placeholder="+52 55 1234 5678" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Categoría</label>
              <select value={form.categoryId} onChange={e => setForm(f => ({ ...f, categoryId: e.target.value }))} className={inputClass}>
                <option value="">Sin categoría</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Notas</label>
            <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              rows={3} className={`${inputClass} resize-none`} placeholder="Notas adicionales..." />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Etiquetas</label>
            <div className="flex gap-2 mb-2">
              <input value={tagInput} onChange={e => setTagInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag() } }}
                className={inputClass} placeholder="Escribe y presiona Enter" />
              <button type="button" onClick={addTag} className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm">+</button>
            </div>
            {form.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {form.tags.map(tag => (
                  <span key={tag} className="flex items-center gap-1 text-xs bg-gray-100 text-gray-700 px-2.5 py-1 rounded-full">
                    {tag}
                    <button onClick={() => setForm(f => ({ ...f, tags: f.tags.filter(t => t !== tag) }))} className="ml-1 text-gray-400 hover:text-red-500">×</button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {client.photos?.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-2">Fotos</label>
              <div className="grid grid-cols-4 gap-2">
                {client.photos.map((url, i) => (
                  <img key={i} src={url} alt="" className="aspect-square object-cover rounded-lg border border-gray-200 cursor-pointer"
                    onClick={() => window.open(url, '_blank')} />
                ))}
              </div>
            </div>
          )}

          <button onClick={handleSave} disabled={saving}
            className="w-full flex items-center justify-center gap-2 bg-gray-900 hover:bg-gray-800 disabled:opacity-50 text-white font-semibold py-2.5 rounded-lg transition-colors">
            <Save size={16} /> {saving ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>
      )}

      {/* Respuestas del formulario de calificación */}
      {tab === 'info' && qualSession && org?.settings?.qualificationForm?.questions?.length && (
        <div className="bg-white border border-gray-200 rounded-xl p-4 sm:p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-900 text-sm flex items-center gap-2">
              📋 Formulario de calificación
            </h2>
            <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
              qualSession.state === 'completed'
                ? 'bg-green-50 text-green-700 border border-green-200'
                : 'bg-amber-50 text-amber-700 border border-amber-200'
            }`}>
              {qualSession.state === 'completed' ? 'Completado' : `En progreso (${qualSession.currentQuestion}/${org.settings.qualificationForm.questions.length})`}
            </span>
          </div>
          <div className="space-y-3">
            {org.settings.qualificationForm.questions
              .sort((a, b) => a.order - b.order)
              .map((q, i) => {
                const answer = qualSession.answers?.[q.id]
                return (
                  <div key={q.id} className={`rounded-lg p-3 ${answer ? 'bg-gray-50' : 'bg-gray-50/50 opacity-50'}`}>
                    <p className="text-xs text-gray-500 mb-1">Pregunta {i + 1}</p>
                    <p className="text-sm font-medium text-gray-800">{q.text}</p>
                    {answer ? (
                      <p className={`text-sm mt-1.5 font-semibold ${q.type === 'phone' ? 'text-green-700' : 'text-gray-900'}`}>
                        {q.type === 'phone' ? `📱 ${answer}` : answer}
                      </p>
                    ) : (
                      <p className="text-xs text-gray-400 mt-1 italic">Sin respuesta aún</p>
                    )}
                  </div>
                )
              })}
          </div>
        </div>
      )}

      {tab === 'activity' && (
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h2 className="font-semibold text-gray-900 text-sm mb-5 flex items-center gap-2">
            <Activity size={15} className="text-gray-400" /> Línea de tiempo
          </h2>
          {timeline.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">Sin actividad registrada</p>
          ) : (
            <div className="space-y-4">
              {timeline.map((event, idx) => (
                <div key={event.id + idx} className="flex gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${event.color}`}>
                    <event.icon size={14} />
                  </div>
                  <div className="flex-1 min-w-0 pt-1">
                    <p className="text-sm font-medium text-gray-900">{event.title}</p>
                    {event.sub && <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{event.sub}</p>}
                    <p className="text-xs text-gray-400 mt-1">
                      {event.date.toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' })}
                      {' · '}
                      {event.date.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
