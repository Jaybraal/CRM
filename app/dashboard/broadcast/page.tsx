'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { getClients, getCategories, getOrganization, getWhatsAppTemplates, getCampaigns, createCampaign, updateCampaign } from '@/lib/firestore'
import type { Client, Category, WhatsAppTemplate, BroadcastCampaign } from '@/types'
import { Send, Users, Filter, Zap, CheckSquare, AlertCircle, Clock, History, ChevronRight } from 'lucide-react'
import toast from 'react-hot-toast'

type Tab = 'send' | 'history'

function getTs(d: unknown): Date {
  if (!d) return new Date()
  if (d instanceof Date) return d
  if (typeof d === 'object' && 'seconds' in (d as object)) return new Date((d as { seconds: number }).seconds * 1000)
  return new Date(d as string)
}

export default function BroadcastPage() {
  const { profile } = useAuth()
  const [tab, setTab] = useState<Tab>('send')
  const [clients, setClients] = useState<Client[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>([])
  const [campaigns, setCampaigns] = useState<BroadcastCampaign[]>([])
  const [hasWhatsApp, setHasWhatsApp] = useState(false)
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [results, setResults] = useState<{ clientId: string; name: string; phone: string; success: boolean; error?: string }[]>([])

  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [filterCategory, setFilterCategory] = useState<string>('all')
  const [onlyWithWhatsApp, setOnlyWithWhatsApp] = useState(true)
  const [message, setMessage] = useState('')
  const [campaignName, setCampaignName] = useState('')
  const [scheduledAt, setScheduledAt] = useState('')

  useEffect(() => {
    if (!profile?.orgId) return
    Promise.all([
      getClients(profile.orgId),
      getCategories(profile.orgId),
      getOrganization(profile.orgId),
      getWhatsAppTemplates(profile.orgId),
      getCampaigns(profile.orgId),
      fetch(`/api/whatsapp/status?sessionId=${profile.orgId}`).then(r => r.json()).catch(() => ({})),
    ]).then(([c, cats, , tmpl, cmpg, sessionData]) => {
      setClients(c); setCategories(cats); setTemplates(tmpl)
      setCampaigns(cmpg); setHasWhatsApp(sessionData?.status === 'open')
    }).catch(e => console.error('Error cargando broadcast:', e)).finally(() => setLoading(false))
  }, [profile?.orgId])

  const filtered = clients.filter(c => {
    if (filterStatus !== 'all' && c.status !== filterStatus) return false
    if (filterCategory !== 'all' && c.categoryId !== filterCategory) return false
    if (onlyWithWhatsApp && !c.whatsappPhone) return false
    return true
  })

  const handleBroadcast = async () => {
    if (!message.trim()) { toast.error('Escribe un mensaje'); return }
    if (filtered.length === 0) { toast.error('No hay destinatarios'); return }
    if (!hasWhatsApp) { toast.error('Configura WhatsApp Business primero'); return }
    if (!campaignName.trim()) { toast.error('Escribe un nombre para la campaña'); return }

    // If scheduled — save and exit
    if (scheduledAt) {
      const scheduled = new Date(scheduledAt)
      if (scheduled <= new Date()) { toast.error('La fecha debe ser futura'); return }
      await createCampaign(profile!.orgId!, {
        name: campaignName,
        message,
        status: 'scheduled',
        recipientCount: filtered.length,
        sentCount: 0,
        failedCount: 0,
        scheduledAt: scheduled,
        createdBy: profile!.uid,
        filterStatus,
        filterCategory,
      })
      toast.success('Campaña programada')
      setCampaigns(await getCampaigns(profile!.orgId!))
      setTab('history')
      return
    }

    if (!confirm(`¿Enviar a ${filtered.length} clientes?`)) return

    setSending(true)
    setResults([])

    const campaignId = await createCampaign(profile!.orgId!, {
      name: campaignName,
      message,
      status: 'sending',
      recipientCount: filtered.length,
      sentCount: 0,
      failedCount: 0,
      createdBy: profile!.uid,
      filterStatus,
      filterCategory,
    })

    const res: typeof results = []
    let okCount = 0; let failCount = 0

    for (const client of filtered) {
      if (!client.whatsappPhone) continue
      try {
        const resp = await fetch('/api/whatsapp/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orgId: profile?.orgId, to: client.whatsappPhone, text: message }),
        })
        const success = resp.ok
        res.push({ clientId: client.id, name: client.name, phone: client.whatsappPhone, success })
        if (success) okCount++; else failCount++
      } catch {
        res.push({ clientId: client.id, name: client.name, phone: client.whatsappPhone || '', success: false, error: 'Error de red' })
        failCount++
      }
      setResults([...res])
      await new Promise(r => setTimeout(r, 1500))
    }

    await updateCampaign(profile!.orgId!, campaignId, {
      status: failCount === res.length ? 'failed' : 'done',
      sentCount: okCount,
      failedCount: failCount,
      sentAt: new Date() as unknown as Date,
    })

    setSending(false)
    setCampaigns(await getCampaigns(profile!.orgId!))
    toast.success(`Enviado a ${okCount}/${res.length} destinatarios`)
  }

  const sent = results.filter(r => r.success).length
  const failed = results.filter(r => !r.success).length

  const statusBadge = (s: BroadcastCampaign['status']) => {
    const map: Record<BroadcastCampaign['status'], string> = {
      scheduled: 'bg-blue-50 text-blue-700 border-blue-200',
      sending: 'bg-amber-50 text-amber-700 border-amber-200',
      done: 'bg-green-50 text-green-700 border-green-200',
      failed: 'bg-red-50 text-red-700 border-red-200',
    }
    const labels: Record<BroadcastCampaign['status'], string> = { scheduled: 'Programada', sending: 'Enviando', done: 'Enviada', failed: 'Fallida' }
    return <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${map[s]}`}>{labels[s]}</span>
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Difusión WhatsApp</h1>
        <p className="text-gray-500 text-sm mt-1">Envía mensajes masivos o programa campañas</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
        <button onClick={() => setTab('send')}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === 'send' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
          <Send size={14} /> Nueva campaña
        </button>
        <button onClick={() => setTab('history')}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === 'history' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
          <History size={14} /> Historial
          {campaigns.length > 0 && <span className="bg-gray-200 text-gray-700 text-xs px-1.5 py-0.5 rounded-full">{campaigns.length}</span>}
        </button>
      </div>

      {tab === 'history' && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          {campaigns.length === 0 ? (
            <div className="text-center py-12 text-gray-400 text-sm">No hay campañas aún</div>
          ) : (
            <div className="divide-y divide-gray-100">
              {campaigns.map(c => (
                <div key={c.id} className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium text-gray-900 truncate">{c.name}</p>
                      {statusBadge(c.status)}
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{c.message}</p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                      <span className="flex items-center gap-1"><Users size={11} /> {c.recipientCount} destinatarios</span>
                      {c.sentCount > 0 && <span className="flex items-center gap-1 text-green-600"><CheckSquare size={11} /> {c.sentCount} ok</span>}
                      {c.failedCount > 0 && <span className="flex items-center gap-1 text-red-500"><AlertCircle size={11} /> {c.failedCount} fallidos</span>}
                      {c.scheduledAt && <span className="flex items-center gap-1"><Clock size={11} /> {getTs(c.scheduledAt).toLocaleString('es', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>}
                      {c.sentAt && <span>{getTs(c.sentAt).toLocaleDateString('es', { day: 'numeric', month: 'short' })}</span>}
                    </div>
                  </div>
                  <ChevronRight size={16} className="text-gray-300 flex-shrink-0" />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'send' && (
        <>
          {!hasWhatsApp && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
              <AlertCircle size={18} className="text-amber-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-amber-800">WhatsApp no configurado</p>
                <p className="text-xs text-amber-600 mt-0.5">Ve a Configuración → WhatsApp Business para conectar tu número.</p>
              </div>
            </div>
          )}

          {loading ? (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 border-4 border-gray-400 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <>
              {/* Campaign name */}
              <div className="bg-white border border-gray-200 rounded-xl p-5">
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Nombre de la campaña *</label>
                <input value={campaignName} onChange={e => setCampaignName(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-gray-500"
                  placeholder='Ej: "Promo Diciembre", "Seguimiento leads"' />
              </div>

              {/* Filters */}
              <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
                <div className="flex items-center gap-2 pb-3 border-b border-gray-100">
                  <Filter size={16} className="text-gray-400" />
                  <h2 className="font-semibold text-gray-900 text-sm">Filtrar destinatarios</h2>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1.5">Estado</label>
                    <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-gray-500">
                      <option value="all">Todos los estados</option>
                      <option value="lead">Lead</option>
                      <option value="prospect">Prospecto</option>
                      <option value="active">Activo</option>
                      <option value="inactive">Inactivo</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1.5">Categoría</label>
                    <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-gray-500">
                      <option value="all">Todas las categorías</option>
                      {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                </div>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" checked={onlyWithWhatsApp} onChange={e => setOnlyWithWhatsApp(e.target.checked)} className="w-4 h-4 rounded border-gray-300" />
                  <span className="text-sm text-gray-700">Solo clientes con número WhatsApp vinculado</span>
                </label>
                <div className="flex items-center gap-2 text-sm text-gray-600 bg-gray-50 rounded-lg px-4 py-3">
                  <Users size={16} className="text-gray-400" />
                  <span><strong className="text-gray-900">{filtered.length}</strong> destinatarios seleccionados</span>
                </div>
                {filtered.length > 0 && (
                  <div className="max-h-36 overflow-y-auto space-y-1">
                    {filtered.slice(0, 20).map(c => (
                      <div key={c.id} className="flex items-center justify-between text-xs text-gray-600 px-1">
                        <span>{c.name}</span>
                        <span className="text-gray-400">{c.whatsappPhone}</span>
                      </div>
                    ))}
                    {filtered.length > 20 && <p className="text-xs text-gray-400 text-center pt-1">y {filtered.length - 20} más...</p>}
                  </div>
                )}
              </div>

              {/* Message */}
              <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                  <h2 className="font-semibold text-gray-900 text-sm">Mensaje</h2>
                  {templates.length > 0 && (
                    <div className="relative group">
                      <button className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 transition-colors">
                        <Zap size={14} /> Usar plantilla
                      </button>
                      <div className="absolute right-0 top-6 w-56 bg-white border border-gray-200 rounded-xl shadow-lg z-10 overflow-hidden hidden group-hover:block">
                        {templates.map(t => (
                          <button key={t.id} onClick={() => setMessage(t.body)} className="w-full text-left px-4 py-3 hover:bg-gray-50 border-b border-gray-100 last:border-0">
                            <p className="text-xs font-semibold text-gray-700">{t.name}</p>
                            <p className="text-xs text-gray-400 line-clamp-1 mt-0.5">{t.body}</p>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <textarea value={message} onChange={e => setMessage(e.target.value)} rows={5}
                  placeholder="Escribe tu mensaje aquí..."
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm text-gray-900 focus:outline-none focus:border-gray-500 resize-none" />
                <div className="flex items-center justify-between text-xs text-gray-400">
                  <span>{message.length} caracteres</span>
                  <span>WhatsApp: máx. ~4096 caracteres</span>
                </div>
              </div>

              {/* Schedule */}
              <div className="bg-white border border-gray-200 rounded-xl p-5">
                <div className="flex items-center gap-2 pb-3 border-b border-gray-100 mb-4">
                  <Clock size={16} className="text-gray-400" />
                  <h2 className="font-semibold text-gray-900 text-sm">Programar envío (opcional)</h2>
                </div>
                <input type="datetime-local" value={scheduledAt} onChange={e => setScheduledAt(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-gray-500" />
                <p className="text-xs text-gray-400 mt-1.5">Deja vacío para enviar ahora mismo</p>
              </div>

              {/* Send button */}
              <button onClick={handleBroadcast}
                disabled={sending || !message.trim() || filtered.length === 0}
                className="w-full flex items-center justify-center gap-2 bg-gray-900 hover:bg-gray-800 disabled:opacity-50 text-white font-semibold py-3 rounded-lg transition-colors">
                {sending ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Enviando... ({results.length}/{filtered.filter(c => c.whatsappPhone).length})
                  </>
                ) : scheduledAt ? (
                  <><Clock size={16} /> Programar campaña</>
                ) : (
                  <><Send size={16} /> Enviar a {filtered.length} clientes</>
                )}
              </button>

              {/* Results */}
              {results.length > 0 && (
                <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
                  <div className="flex items-center gap-4 pb-3 border-b border-gray-100">
                    <h2 className="font-semibold text-gray-900 text-sm flex-1">Resultados del envío</h2>
                    <span className="text-xs text-green-600 font-medium flex items-center gap-1"><CheckSquare size={12} /> {sent} exitosos</span>
                    {failed > 0 && <span className="text-xs text-red-500 font-medium flex items-center gap-1"><AlertCircle size={12} /> {failed} fallidos</span>}
                  </div>
                  <div className="max-h-64 overflow-y-auto space-y-1.5">
                    {results.map(r => (
                      <div key={r.clientId} className="flex items-center justify-between text-xs py-1.5 border-b border-gray-50">
                        <span className="text-gray-700">{r.name}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-gray-400">{r.phone}</span>
                          <span className={r.success ? 'text-green-600 font-medium' : 'text-red-500 font-medium'}>
                            {r.success ? '✓ Enviado' : '✗ Error'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  )
}
