'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { getClients, getCategories, getOrganization, getWhatsAppTemplates } from '@/lib/firestore'
import type { Client, Category, WhatsAppTemplate } from '@/types'
import { Send, Users, Filter, Zap, CheckSquare, AlertCircle } from 'lucide-react'
import toast from 'react-hot-toast'

interface BroadcastResult {
  clientId: string
  name: string
  phone: string
  success: boolean
  error?: string
}

export default function BroadcastPage() {
  const { profile } = useAuth()
  const [clients, setClients] = useState<Client[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>([])
  const [hasWhatsApp, setHasWhatsApp] = useState(false)
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [results, setResults] = useState<BroadcastResult[]>([])

  // Filters
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [filterCategory, setFilterCategory] = useState<string>('all')
  const [onlyWithWhatsApp, setOnlyWithWhatsApp] = useState(true)

  // Message
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!profile?.orgId) return
    Promise.all([
      getClients(profile.orgId),
      getCategories(profile.orgId),
      getOrganization(profile.orgId),
      getWhatsAppTemplates(profile.orgId),
      fetch(`/api/whatsapp/status?sessionId=${profile.orgId}`).then(r => r.json()).catch(() => ({})),
    ]).then(([c, cats, , tmpl, sessionData]) => {
      setClients(c)
      setCategories(cats)
      setTemplates(tmpl)
      setHasWhatsApp(sessionData?.status === 'open')
      setLoading(false)
    })
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

    setSending(true)
    setResults([])

    const res: BroadcastResult[] = []

    for (const client of filtered) {
      if (!client.whatsappPhone) continue
      try {
        const resp = await fetch('/api/whatsapp/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orgId: profile?.orgId,
            to: client.whatsappPhone,
            text: message,
          }),
        })
        res.push({ clientId: client.id, name: client.name, phone: client.whatsappPhone, success: resp.ok })
      } catch (e) {
        res.push({ clientId: client.id, name: client.name, phone: client.whatsappPhone || '', success: false, error: 'Error de red' })
      }
      setResults([...res])
      // Small delay to avoid rate limiting
      await new Promise(r => setTimeout(r, 200))
    }

    setSending(false)
    const ok = res.filter(r => r.success).length
    toast.success(`Enviado a ${ok}/${res.length} destinatarios`)
  }

  const sent = results.filter(r => r.success).length
  const failed = results.filter(r => !r.success).length

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Difusión WhatsApp</h1>
        <p className="text-gray-500 text-sm mt-1">Envía un mensaje masivo a tus clientes via WhatsApp</p>
      </div>

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
          {/* Filters */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-gray-100">
              <Filter size={16} className="text-gray-400" />
              <h2 className="font-semibold text-gray-900 text-sm">Filtrar destinatarios</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Estado</label>
                <select
                  value={filterStatus}
                  onChange={e => setFilterStatus(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-gray-500"
                >
                  <option value="all">Todos los estados</option>
                  <option value="lead">Lead</option>
                  <option value="prospect">Prospecto</option>
                  <option value="active">Activo</option>
                  <option value="inactive">Inactivo</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Categoría</label>
                <select
                  value={filterCategory}
                  onChange={e => setFilterCategory(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-gray-500"
                >
                  <option value="all">Todas las categorías</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            </div>

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={onlyWithWhatsApp}
                onChange={e => setOnlyWithWhatsApp(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300"
              />
              <span className="text-sm text-gray-700">Solo clientes con número WhatsApp vinculado</span>
            </label>

            <div className="flex items-center gap-2 text-sm text-gray-600 bg-gray-50 rounded-lg px-4 py-3">
              <Users size={16} className="text-gray-400" />
              <span><strong className="text-gray-900">{filtered.length}</strong> destinatarios seleccionados</span>
            </div>

            {/* Recipient list preview */}
            {filtered.length > 0 && (
              <div className="max-h-36 overflow-y-auto space-y-1">
                {filtered.slice(0, 20).map(c => (
                  <div key={c.id} className="flex items-center justify-between text-xs text-gray-600 px-1">
                    <span>{c.name}</span>
                    <span className="text-gray-400">{c.whatsappPhone}</span>
                  </div>
                ))}
                {filtered.length > 20 && (
                  <p className="text-xs text-gray-400 text-center pt-1">y {filtered.length - 20} más...</p>
                )}
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
                      <button
                        key={t.id}
                        onClick={() => setMessage(t.body)}
                        className="w-full text-left px-4 py-3 hover:bg-gray-50 border-b border-gray-100 last:border-0"
                      >
                        <p className="text-xs font-semibold text-gray-700">{t.name}</p>
                        <p className="text-xs text-gray-400 line-clamp-1 mt-0.5">{t.body}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              rows={5}
              placeholder="Escribe tu mensaje aquí..."
              className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm text-gray-900 focus:outline-none focus:border-gray-500 resize-none"
            />
            <div className="flex items-center justify-between text-xs text-gray-400">
              <span>{message.length} caracteres</span>
              <span>WhatsApp: máx. ~4096 caracteres</span>
            </div>

            <button
              onClick={handleBroadcast}
              disabled={sending || !message.trim() || filtered.length === 0}
              className="w-full flex items-center justify-center gap-2 bg-gray-900 hover:bg-gray-800 disabled:opacity-50 text-white font-semibold py-3 rounded-lg transition-colors"
            >
              {sending ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Enviando... ({results.length}/{filtered.filter(c => c.whatsappPhone).length})
                </>
              ) : (
                <>
                  <Send size={16} />
                  Enviar a {filtered.length} clientes
                </>
              )}
            </button>
          </div>

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
    </div>
  )
}
