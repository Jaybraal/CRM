'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { getClients, getCategories, getOrganization, getWhatsAppTemplates, getCampaigns, createCampaign, updateCampaign } from '@/lib/firestore'
import type { Client, Category, WhatsAppTemplate, BroadcastCampaign } from '@/types'
import { Send, Users, Filter, Zap, CheckSquare, AlertCircle, Clock } from 'lucide-react'
import toast from 'react-hot-toast'
import { Spinner } from '@/components/ui/primitives'

interface BroadcastResult { clientId: string; name: string; phone: string; success: boolean; error?: string }

const selectClass = 'w-full bg-[#F4F5F7] dark:bg-[#1A2540] border border-[#E3E6EC] dark:border-[#1A2540] rounded-md px-3 py-2.5 text-sm text-[#0C1224] dark:text-[#E8ECF4] focus:outline-none focus:border-[#0D7A65] transition-colors'
const inputClass = 'w-full bg-[#F4F5F7] dark:bg-[#1A2540] border border-[#E3E6EC] dark:border-[#1A2540] rounded-md px-4 py-2.5 text-sm text-[#0C1224] dark:text-[#E8ECF4] focus:outline-none focus:border-[#0D7A65] transition-colors'

export default function BroadcastPage() {
  const { profile } = useAuth()
  const [clients, setClients] = useState<Client[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>([])
  const [campaigns, setCampaigns] = useState<BroadcastCampaign[]>([])
  const [hasWhatsApp, setHasWhatsApp] = useState(false)
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [results, setResults] = useState<BroadcastResult[]>([])
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [filterCategory, setFilterCategory] = useState<string>('all')
  const [onlyWithWhatsApp, setOnlyWithWhatsApp] = useState(true)
  const [message, setMessage] = useState('')
  const [scheduledAt, setScheduledAt] = useState('')

  useEffect(() => {
    if (!profile?.orgId) return
    Promise.all([
      getClients(profile.orgId), getCategories(profile.orgId), getOrganization(profile.orgId),
      getWhatsAppTemplates(profile.orgId),
      getCampaigns(profile.orgId),
      fetch(`/api/whatsapp/status?sessionId=${profile.orgId}`).then(r => r.json()).catch(() => ({})),
    ]).then(([c, cats, , tmpl, camp, sessionData]) => {
      setClients(c); setCategories(cats); setTemplates(tmpl); setCampaigns(camp)
      setHasWhatsApp(sessionData?.status === 'open')
    }).catch(e => console.error(e)).finally(() => setLoading(false))
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
    if (!confirm(`¿Enviar a ${filtered.length} clientes?`)) return

    setSending(true); setResults([])
    const res: BroadcastResult[] = []
    for (const client of filtered) {
      if (!client.whatsappPhone) continue
      try {
        const resp = await fetch('/api/whatsapp/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orgId: profile?.orgId, to: client.whatsappPhone, text: message }),
        })
        res.push({ clientId: client.id, name: client.name, phone: client.whatsappPhone, success: resp.ok })
      } catch {
        res.push({ clientId: client.id, name: client.name, phone: client.whatsappPhone || '', success: false })
      }
      setResults([...res])
      await new Promise(r => setTimeout(r, 1500))
    }
    setSending(false)
    toast.success(`Enviado a ${res.filter(r => r.success).length}/${res.length} destinatarios`)
  }

  const sent = results.filter(r => r.success).length
  const failed = results.filter(r => !r.success).length

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-[#0C1224] dark:text-[#E8ECF4]">Difusión WhatsApp</h1>
        <p className="text-[#68748D] dark:text-[#9BA5B7] text-sm mt-1">Envía un mensaje masivo a tus clientes</p>
      </div>

      {!hasWhatsApp && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle size={18} className="text-amber-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-amber-800 dark:text-amber-300">WhatsApp no configurado</p>
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">Ve a Configuración → WhatsApp Business para conectar tu número.</p>
          </div>
        </div>
      )}

      {loading ? (
        <Spinner />
      ) : (
        <>
          {/* Filters */}
          <div className="bg-white dark:bg-[#0F1829] border border-[#E3E6EC] dark:border-[#1A2540] rounded-lg p-5 space-y-4 shadow-sm">
            <div className="flex items-center gap-2 pb-3 border-b border-[#E3E6EC] dark:border-[#1A2540]">
              <Filter size={16} className="text-[#9BA5B7]" />
              <h2 className="font-bold text-[#0C1224] dark:text-[#E8ECF4] text-sm uppercase tracking-wider">Filtrar destinatarios</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-[#68748D] dark:text-[#9BA5B7] mb-1.5 uppercase tracking-wide">Estado</label>
                <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className={selectClass}>
                  <option value="all">Todos los estados</option>
                  <option value="lead">Lead</option>
                  <option value="prospect">Prospecto</option>
                  <option value="active">Activo</option>
                  <option value="inactive">Inactivo</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-[#68748D] dark:text-[#9BA5B7] mb-1.5 uppercase tracking-wide">Categoría</label>
                <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} className={selectClass}>
                  <option value="all">Todas las categorías</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            </div>
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={onlyWithWhatsApp} onChange={e => setOnlyWithWhatsApp(e.target.checked)} className="w-4 h-4 rounded border-[#E3E6EC] accent-blue-600" />
              <span className="text-sm font-medium text-[#0C1224] dark:text-[#9BA5B7]">Solo clientes con número WhatsApp</span>
            </label>
            <div className="flex items-center gap-2 text-sm bg-[#F4F5F7] dark:bg-[#0D7A65]/10 border border-blue-100 dark:border-blue-800 rounded-md px-4 py-3">
              <Users size={16} className="text-[#0D7A65]" />
              <span className="text-blue-700 dark:text-[#0D7A65]"><strong className="font-bold">{filtered.length}</strong> destinatarios seleccionados</span>
            </div>
            {filtered.length > 0 && (
              <div className="max-h-36 overflow-y-auto space-y-1">
                {filtered.slice(0, 20).map(c => (
                  <div key={c.id} className="flex items-center justify-between text-xs text-[#68748D] dark:text-[#9BA5B7] px-1">
                    <span className="font-medium">{c.name}</span>
                    <span className="text-[#9BA5B7]">{c.whatsappPhone}</span>
                  </div>
                ))}
                {filtered.length > 20 && <p className="text-xs text-[#9BA5B7] text-center pt-1">y {filtered.length - 20} más...</p>}
              </div>
            )}
          </div>

          {/* Message */}
          <div className="bg-white dark:bg-[#0F1829] border border-[#E3E6EC] dark:border-[#1A2540] rounded-lg p-5 space-y-4 shadow-sm">
            <div className="flex items-center justify-between pb-3 border-b border-[#E3E6EC] dark:border-[#1A2540]">
              <h2 className="font-bold text-[#0C1224] dark:text-[#E8ECF4] text-sm uppercase tracking-wider">Mensaje</h2>
              {templates.length > 0 && (
                <div className="relative group">
                  <button className="flex items-center gap-1.5 text-xs font-bold text-[#68748D] hover:text-[#0D7A65] transition-colors">
                    <Zap size={14} /> Usar plantilla
                  </button>
                  <div className="absolute right-0 top-6 w-60 bg-white dark:bg-[#1A2540] border border-[#E3E6EC] dark:border-[#1A2540] rounded-lg shadow-sm z-10 overflow-hidden hidden group-hover:block">
                    {templates.map(t => (
                      <button key={t.id} onClick={() => setMessage(t.body)} className="w-full text-left px-4 py-3 hover:bg-[#F4F5F7] dark:hover:bg-[#1A2540] border-b border-[#E3E6EC] dark:border-[#1A2540] last:border-0 transition-colors">
                        <p className="text-xs font-bold text-[#0C1224] dark:text-[#E8ECF4]">{t.name}</p>
                        <p className="text-xs text-[#9BA5B7] line-clamp-1 mt-0.5">{t.body}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <textarea value={message} onChange={e => setMessage(e.target.value)} rows={5} placeholder="Escribe tu mensaje aquí..."
              className={`${inputClass} resize-none`} />
            <div className="flex items-center justify-between text-xs text-[#9BA5B7]">
              <span>{message.length} caracteres</span>
              <span>WhatsApp: máx. ~4096 caracteres</span>
            </div>
          </div>

          {/* Schedule */}
          <div className="bg-white dark:bg-[#0F1829] border border-[#E3E6EC] dark:border-[#1A2540] rounded-lg p-5 space-y-3 shadow-sm">
            <div className="flex items-center gap-2 pb-3 border-b border-[#E3E6EC] dark:border-[#1A2540]">
              <Clock size={16} className="text-[#9BA5B7]" />
              <h2 className="font-bold text-[#0C1224] dark:text-[#E8ECF4] text-sm uppercase tracking-wider">Programar envío (opcional)</h2>
            </div>
            <input type="datetime-local" value={scheduledAt} onChange={e => setScheduledAt(e.target.value)} className={inputClass} />
            <p className="text-xs text-[#9BA5B7] dark:text-[#68748D]">Deja vacío para enviar ahora mismo</p>
          </div>

          {/* Send button */}
          <button onClick={handleBroadcast} disabled={sending || !message.trim() || filtered.length === 0}
            className="w-full flex items-center justify-center gap-2 bg-[#0C1224] hover:bg-[#1B2B4B] disabled:opacity-50 text-white font-bold py-3 rounded-md transition-colors shadow-lg">
            {sending ? (
              <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Enviando... ({results.length}/{filtered.filter(c => c.whatsappPhone).length})</>
            ) : scheduledAt ? (
              <><Clock size={16} /> Programar campaña</>
            ) : (
              <><Send size={16} /> Enviar a {filtered.length} clientes</>
            )}
          </button>

          {/* Results */}
          {results.length > 0 && (
            <div className="bg-white dark:bg-[#0F1829] border border-[#E3E6EC] dark:border-[#1A2540] rounded-lg p-5 space-y-3 shadow-sm">
              <div className="flex items-center gap-4 pb-3 border-b border-[#E3E6EC] dark:border-[#1A2540]">
                <h2 className="font-bold text-[#0C1224] dark:text-[#E8ECF4] text-sm uppercase tracking-wider flex-1">Resultados</h2>
                <span className="text-xs text-emerald-600 font-bold flex items-center gap-1"><CheckSquare size={12} /> {sent} exitosos</span>
                {failed > 0 && <span className="text-xs text-red-500 font-bold flex items-center gap-1"><AlertCircle size={12} /> {failed} fallidos</span>}
              </div>
              <div className="max-h-64 overflow-y-auto space-y-1.5">
                {results.map(r => (
                  <div key={r.clientId} className="flex items-center justify-between text-xs py-2 border-b border-slate-50 dark:border-[#1A2540]">
                    <span className="font-medium text-[#0C1224] dark:text-[#9BA5B7]">{r.name}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-[#9BA5B7]">{r.phone}</span>
                      <span className={r.success ? 'text-emerald-600 font-bold' : 'text-red-500 font-bold'}>{r.success ? '✓' : '✗'}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
