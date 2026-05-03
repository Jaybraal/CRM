'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { getClient, getOrganization, updateClient, getCategories, getTasks, getDeals, getOrgUsers, getEmailThreads } from '@/lib/firestore'
import { collection, getDocs, getDoc, doc as firestoreDoc, orderBy, query, deleteField } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { Client, Organization, Category, Task, Deal, Message, AppUser, ClientStatus, EmailThread } from '@/types'
import { DEFAULT_CLIENT_STATUSES } from '@/types'
import ChatWindow from '@/components/chat/ChatWindow'
import { ArrowLeft, User, MessageCircle, Save, Activity, CheckSquare, FolderKanban, MessageSquare, UserCheck, Mail, Send } from 'lucide-react'
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

const inputClass = 'w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 text-sm transition-colors'

export default function ClientDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { profile } = useAuth()
  const [client, setClient] = useState<Client | null>(null)
  const [org, setOrg] = useState<Organization | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [clientStatuses, setClientStatuses] = useState<ClientStatus[]>(DEFAULT_CLIENT_STATUSES)
  const [agents, setAgents] = useState<AppUser[]>([])
  const [tab, setTab] = useState<'chat' | 'info' | 'activity' | 'email'>('chat')
  const [emailThreads, setEmailThreads] = useState<EmailThread[]>([])
  const [emailForm, setEmailForm] = useState({ subject: '', body: '' })
  const [sendingEmail, setSendingEmail] = useState(false)
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

    // Load email threads
    getEmailThreads(profile.orgId, id).then(setEmailThreads).catch(() => {})

    // Load timeline data
    const loadTimeline = async () => {
      if (!profile?.orgId || !id) return
      const getTs = (d: unknown): Date => {
        if (!d) return new Date()
        if (d instanceof Date) return d
        if (typeof d === 'object' && 'seconds' in (d as object)) return new Date((d as { seconds: number }).seconds * 1000)
        return new Date(d as string)
      }

      let tasksData, dealsData
      try {
        [tasksData, dealsData] = await Promise.all([
          getTasks(profile.orgId),
          getDeals(profile.orgId),
        ])
      } catch (e) { console.error('Error cargando timeline:', e); return }

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
          color: m.source === 'whatsapp' ? 'text-green-600 bg-green-50 dark:bg-green-900/20' : 'text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800',
        })),
        ...tasksData.filter(t => t.clientId === id).map(t => ({
          id: t.id,
          type: 'task' as const,
          title: t.completed ? `Tarea completada: ${t.title}` : `Tarea creada: ${t.title}`,
          date: getTs(t.createdAt),
          icon: CheckSquare,
          color: t.completed ? 'text-green-600 bg-green-50 dark:bg-green-900/20' : 'text-amber-600 bg-amber-50 dark:bg-amber-900/20',
        })),
        ...dealsData.filter(d => d.clientId === id).map(d => ({
          id: d.id,
          type: 'deal' as const,
          title: `Oportunidad: ${d.stage}`,
          sub: d.value ? `$${d.value.toLocaleString()}` : undefined,
          date: getTs(d.updatedAt),
          icon: FolderKanban,
          color: d.stage === 'closed_won' ? 'text-green-600 bg-green-50 dark:bg-green-900/20' : d.stage === 'closed_lost' ? 'text-red-600 bg-red-50 dark:bg-red-900/20' : 'text-blue-600 bg-blue-50 dark:bg-blue-900/20',
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

  const handleSendEmail = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!client?.email) { toast.error('Este cliente no tiene email registrado'); return }
    if (!profile?.orgId) return
    setSendingEmail(true)
    try {
      const res = await fetch('/api/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orgId: profile.orgId,
          clientId: client.id,
          toEmail: client.email,
          toName: client.name,
          subject: emailForm.subject,
          body: emailForm.body,
          fromName: profile.displayName,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast.success('Email enviado')
      setEmailForm({ subject: '', body: '' })
      setEmailThreads(prev => [{
        id: Date.now().toString(), orgId: profile.orgId!, clientId: client.id,
        subject: emailForm.subject, fromName: profile.displayName, fromEmail: '',
        toEmail: client.email!, body: emailForm.body, direction: 'outbound', createdAt: new Date(),
      }, ...prev])
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al enviar email')
    } finally { setSendingEmail(false) }
  }

  const addTag = () => {
    const t = tagInput.trim()
    if (t && !form.tags.includes(t)) {
      setForm(f => ({ ...f, tags: [...f.tags, t] }))
      setTagInput('')
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }
  if (!client) return <div className="text-center py-20 text-slate-500 dark:text-slate-400">Cliente no encontrado</div>

  const hasWhatsApp = true // Usa Baileys — siempre activo
  const categoryName = categories.find(c => c.id === client.categoryId)?.name

  return (
    <div className="space-y-4 max-w-3xl mx-auto">
      <button onClick={() => router.back()}
        className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors">
        <ArrowLeft size={16} /> Volver a clientes
      </button>

      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-sm p-5">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center flex-shrink-0">
            <User size={22} className="text-slate-500 dark:text-slate-400" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-black text-slate-900 dark:text-white">{client.name}</h1>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">{client.status}</span>
              {categoryName && <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">{categoryName}</span>}
              {client.whatsappPhone && hasWhatsApp && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800">WhatsApp ●</span>
              )}
            </div>
            {/* Agente asignado */}
            {profile?.role !== 'agent' && agents.length > 0 && (
              <div className="flex items-center gap-2 mt-3">
                <UserCheck size={14} className="text-slate-400 dark:text-slate-500 flex-shrink-0" />
                <select
                  value={client.assignedTo || ''}
                  onChange={e => handleReassign(e.target.value)}
                  disabled={reassigning}
                  className="text-sm text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2 py-1 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 disabled:opacity-50 transition-colors"
                >
                  <option value="">Sin asignar</option>
                  {agents.map(a => <option key={a.uid} value={a.uid}>{a.displayName}</option>)}
                </select>
                {reassigning && <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />}
              </div>
            )}
            {profile?.role === 'agent' && client.assignedTo === profile.uid && (
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-2 flex items-center gap-1"><UserCheck size={12} /> Asignado a ti</p>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl w-fit">
        <button onClick={() => setTab('chat')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-colors ${tab === 'chat' ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}>
          <MessageCircle size={15} /> Chat
        </button>
        <button onClick={() => setTab('info')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-colors ${tab === 'info' ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}>
          <User size={15} /> Info
        </button>
        <button onClick={() => setTab('email')}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === 'email' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
          <Mail size={15} /> Email
        </button>
        <button onClick={() => setTab('activity')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-colors ${tab === 'activity' ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}>
          <Activity size={15} /> Actividad
        </button>
      </div>

      {tab === 'chat' && <ChatWindow client={client} hasWhatsApp={hasWhatsApp} />}

      {tab === 'info' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-sm p-6 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5">Nombre *</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5">Estado</label>
              <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} className={inputClass}>
                {clientStatuses.map(s => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5">Email</label>
              <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className={inputClass} placeholder="correo@ejemplo.com" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5">Teléfono</label>
              <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} className={inputClass} placeholder="+1 234 567 8900" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5">WhatsApp del cliente</label>
              <input value={form.whatsappPhone} onChange={e => setForm(f => ({ ...f, whatsappPhone: e.target.value }))} className={inputClass} placeholder="+52 55 1234 5678" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5">Categoría</label>
              <select value={form.categoryId} onChange={e => setForm(f => ({ ...f, categoryId: e.target.value }))} className={inputClass}>
                <option value="">Sin categoría</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5">Notas</label>
            <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              rows={3} className={`${inputClass} resize-none`} placeholder="Notas adicionales..." />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5">Etiquetas</label>
            <div className="flex gap-2 mb-2">
              <input value={tagInput} onChange={e => setTagInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag() } }}
                className={inputClass} placeholder="Escribe y presiona Enter" />
              <button type="button" onClick={addTag} className="px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-sm font-bold transition-colors">+</button>
            </div>
            {form.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {form.tags.map(tag => (
                  <span key={tag} className="flex items-center gap-1 text-xs bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2.5 py-1 rounded-full">
                    {tag}
                    <button onClick={() => setForm(f => ({ ...f, tags: f.tags.filter(t => t !== tag) }))} className="ml-1 text-slate-400 dark:text-slate-500 hover:text-red-500">×</button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {client.photos?.length > 0 && (
            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2">Fotos</label>
              <div className="grid grid-cols-4 gap-2">
                {client.photos.map((url, i) => (
                  <img key={i} src={url} alt="" className="aspect-square object-cover rounded-xl border border-slate-200 dark:border-slate-700 cursor-pointer"
                    onClick={() => window.open(url, '_blank')} />
                ))}
              </div>
            </div>
          )}

          <button onClick={handleSave} disabled={saving}
            className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold py-2.5 rounded-xl shadow-lg shadow-blue-500/20 transition-colors">
            <Save size={16} /> {saving ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>
      )}

      {/* Respuestas del formulario de calificación */}
      {tab === 'info' && qualSession && org?.settings?.qualificationForm?.questions?.length && (
        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-sm p-4 sm:p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-black text-slate-900 dark:text-white text-sm flex items-center gap-2">
              📋 Formulario de calificación
            </h2>
            <span className={`text-xs px-2.5 py-1 rounded-full font-bold ${
              qualSession.state === 'completed'
                ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800'
                : 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800'
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
                  <div key={q.id} className={`rounded-xl p-3 ${answer ? 'bg-slate-50 dark:bg-slate-800' : 'bg-slate-50/50 dark:bg-slate-800/30 opacity-50'}`}>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Pregunta {i + 1}</p>
                    <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{q.text}</p>
                    {answer ? (
                      <p className={`text-sm mt-1.5 font-bold ${q.type === 'phone' ? 'text-green-700 dark:text-green-400' : 'text-slate-900 dark:text-white'}`}>
                        {q.type === 'phone' ? `📱 ${answer}` : answer}
                      </p>
                    ) : (
                      <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 italic">Sin respuesta aún</p>
                    )}
                  </div>
                )
              })}
          </div>
        </div>
      )}

      {tab === 'email' && (
        <div className="space-y-4">
          {!client.email && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
              Este cliente no tiene email. Añádelo en la pestaña Info.
            </div>
          )}
          {/* Compose */}
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <h2 className="font-semibold text-gray-900 text-sm mb-4 flex items-center gap-2"><Send size={14} /> Nuevo email</h2>
            <form onSubmit={handleSendEmail} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">Para</label>
                <input value={client.email || ''} disabled className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">Asunto</label>
                <input value={emailForm.subject} onChange={e => setEmailForm(f => ({ ...f, subject: e.target.value }))} required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-gray-500"
                  placeholder="Asunto del email" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">Mensaje</label>
                <textarea value={emailForm.body} onChange={e => setEmailForm(f => ({ ...f, body: e.target.value }))} required rows={5}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-gray-500 resize-none"
                  placeholder="Escribe tu mensaje..." />
              </div>
              <button type="submit" disabled={sendingEmail || !client.email}
                className="flex items-center gap-2 bg-gray-900 hover:bg-gray-800 disabled:opacity-50 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors">
                <Send size={14} /> {sendingEmail ? 'Enviando...' : 'Enviar email'}
              </button>
            </form>
          </div>
          {/* Thread history */}
          {emailThreads.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-3">
              <h2 className="font-semibold text-gray-900 text-sm mb-1">Historial de emails</h2>
              {emailThreads.map(t => {
                const getD = (d: unknown): Date => d instanceof Date ? d : new Date((d as { seconds: number }).seconds * 1000)
                return (
                  <div key={t.id} className={`p-3 rounded-lg border text-sm ${t.direction === 'outbound' ? 'bg-gray-50 border-gray-200' : 'bg-blue-50 border-blue-100'}`}>
                    <div className="flex items-center justify-between mb-1">
                      <p className="font-medium text-gray-900 truncate">{t.subject}</p>
                      <span className="text-xs text-gray-400 flex-shrink-0 ml-2">{getD(t.createdAt).toLocaleDateString('es', { day: 'numeric', month: 'short' })}</span>
                    </div>
                    <p className="text-xs text-gray-400">{t.direction === 'outbound' ? `De: ${t.fromName}` : `De: ${t.fromEmail}`}</p>
                    <p className="text-xs text-gray-600 mt-1.5 line-clamp-2">{t.body}</p>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {tab === 'activity' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-sm p-6">
          <h2 className="font-black text-slate-900 dark:text-white text-sm mb-5 flex items-center gap-2">
            <Activity size={15} className="text-slate-400 dark:text-slate-500" /> Línea de tiempo
          </h2>
          {timeline.length === 0 ? (
            <p className="text-sm text-slate-400 dark:text-slate-500 text-center py-8">Sin actividad registrada</p>
          ) : (
            <div className="space-y-4">
              {timeline.map((event, idx) => (
                <div key={event.id + idx} className="flex gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${event.color}`}>
                    <event.icon size={14} />
                  </div>
                  <div className="flex-1 min-w-0 pt-1">
                    <p className="text-sm font-bold text-slate-900 dark:text-white">{event.title}</p>
                    {event.sub && <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">{event.sub}</p>}
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
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
