'use client'

import { useState } from 'react'
import { Wifi, WifiOff, Copy, CheckCircle, ExternalLink, Save, Eye, EyeOff } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '@/context/AuthContext'

const inputClass = 'w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 text-sm font-mono transition-colors'
const labelClass = 'block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1.5'

export default function InstagramConnect() {
  const { profile } = useAuth()
  const [copied, setCopied] = useState(false)
  const [igToken, setIgToken] = useState('')
  const [igPageId, setIgPageId] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [showToken, setShowToken] = useState(false)

  const webhookUrl = typeof window !== 'undefined' ? `${window.location.origin}/api/instagram/webhook` : '/api/instagram/webhook'
  const verifyToken = process.env.NEXT_PUBLIC_IG_VERIFY_TOKEN || 'crm_ig_webhook_2024'

  const copyWebhook = () => {
    navigator.clipboard.writeText(webhookUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!igToken.trim() || !igPageId.trim()) { toast.error('Completa todos los campos'); return }
    setSaving(true)
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgId: profile?.orgId, action: 'save_ig_tokens', ig_token: igToken.trim(), ig_page_id: igPageId.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error al guardar')
      setSaved(true)
      toast.success('Instagram configurado correctamente')
      setIgToken(''); setIgPageId('')
      setTimeout(() => setSaved(false), 3000)
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Error al guardar') }
    finally { setSaving(false) }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className={`flex items-center gap-1.5 text-sm px-3 py-1 rounded-full font-bold border ${saved ? 'text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800' : 'text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700'}`}>
          {saved ? <><Wifi size={14} /> Configurado</> : <><WifiOff size={14} /> No configurado</>}
        </span>
        <a href="https://developers.facebook.com/apps" target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-1.5 rounded-xl transition-colors">
          <ExternalLink size={12} /> Meta for Developers
        </a>
      </div>

      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-xl px-3 py-2.5 text-xs text-blue-700 dark:text-blue-300 space-y-1">
        <p className="font-black">Pasos para conectar Instagram:</p>
        <ol className="list-decimal list-inside space-y-0.5 text-blue-600 dark:text-blue-400">
          <li>Crea una app en <strong>Meta for Developers</strong></li>
          <li>Agrega el producto <strong>Messenger</strong> (soporta IG DM)</li>
          <li>En Webhooks, pega la URL y el token de verificación de abajo</li>
          <li>Suscríbete al evento <strong>messages</strong></li>
          <li>Copia el <strong>Page Access Token</strong> y el <strong>Page ID</strong> aquí abajo</li>
        </ol>
      </div>

      <div>
        <label className={labelClass}>URL del Webhook</label>
        <div className="flex flex-col sm:flex-row gap-2">
          <input readOnly value={webhookUrl} className="flex-1 min-w-0 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm text-slate-600 dark:text-slate-300 select-all truncate" />
          <button type="button" onClick={copyWebhook}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-sm font-bold transition-colors shrink-0">
            {copied ? <CheckCircle size={16} className="text-emerald-500" /> : <Copy size={16} />}
            {copied ? 'Copiado' : 'Copiar'}
          </button>
        </div>
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-1.5">
          Token de verificación: <span className="font-mono bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-slate-700 dark:text-slate-300">{verifyToken}</span>
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-3 border-t border-slate-100 dark:border-slate-800 pt-4">
        <div>
          <label className={labelClass}>Page ID de Instagram / Facebook</label>
          <input value={igPageId} onChange={e => setIgPageId(e.target.value)} placeholder="123456789012345" className={inputClass} />
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">El ID numérico de tu página de Facebook</p>
        </div>
        <div>
          <label className={labelClass}>Page Access Token</label>
          <div className="relative">
            <input type={showToken ? 'text' : 'password'} value={igToken} onChange={e => setIgToken(e.target.value)} placeholder="EAAxxxxxx..." className={`${inputClass} pr-10`} />
            <button type="button" onClick={() => setShowToken(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
              {showToken ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Token de acceso permanente de la página</p>
        </div>
        <button type="submit" disabled={saving || !igToken || !igPageId}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-sm rounded-xl transition-colors shadow-lg shadow-blue-500/20">
          <Save size={14} />
          {saving ? 'Guardando...' : 'Guardar configuración de Instagram'}
        </button>
      </form>
    </div>
  )
}
