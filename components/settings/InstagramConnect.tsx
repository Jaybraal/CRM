'use client'

import { useState } from 'react'
import { Wifi, WifiOff, Copy, CheckCircle, ExternalLink, Save, Eye, EyeOff } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '@/context/AuthContext'

const inputClass = 'w-full bg-white border border-gray-300 rounded-lg px-3 py-2.5 text-gray-900 focus:outline-none focus:border-gray-500 text-sm font-mono'
const labelClass = 'block text-sm font-medium text-gray-700 mb-1.5'

export default function InstagramConnect() {
  const { profile } = useAuth()
  const [copied, setCopied] = useState(false)
  const [igToken, setIgToken] = useState('')
  const [igPageId, setIgPageId] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [showToken, setShowToken] = useState(false)

  const webhookUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/api/instagram/webhook`
    : '/api/instagram/webhook'

  const verifyToken = process.env.NEXT_PUBLIC_IG_VERIFY_TOKEN || 'crm_ig_webhook_2024'

  const copyWebhook = () => {
    navigator.clipboard.writeText(webhookUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!igToken.trim() || !igPageId.trim()) {
      toast.error('Completa todos los campos')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orgId: profile?.orgId,
          action: 'save_ig_tokens',
          ig_token: igToken.trim(),
          ig_page_id: igPageId.trim(),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error al guardar')
      setSaved(true)
      toast.success('Instagram configurado correctamente')
      setIgToken('')
      setIgPageId('')
      setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Status */}
      <div className="flex items-center justify-between">
        <span className={`flex items-center gap-1.5 text-sm px-3 py-1 rounded-full font-medium border ${
          saved
            ? 'text-green-700 bg-green-50 border-green-200'
            : 'text-gray-500 bg-gray-50 border-gray-200'
        }`}>
          {saved ? <><Wifi size={14} /> Configurado</> : <><WifiOff size={14} /> No configurado</>}
        </span>
        <a
          href="https://developers.facebook.com/apps"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-xs text-gray-600 hover:bg-gray-100 border border-gray-200 px-3 py-1.5 rounded-lg transition-colors"
        >
          <ExternalLink size={12} /> Meta for Developers
        </a>
      </div>

      {/* Instrucciones */}
      <div className="bg-blue-50 border border-blue-100 rounded-lg px-3 py-2.5 text-xs text-blue-700 space-y-1">
        <p className="font-medium">Pasos para conectar Instagram:</p>
        <ol className="list-decimal list-inside space-y-0.5 text-blue-600">
          <li>Crea una app en <strong>Meta for Developers</strong></li>
          <li>Agrega el producto <strong>Messenger</strong> (soporta IG DM)</li>
          <li>En Webhooks, pega la URL y el token de verificación de abajo</li>
          <li>Suscríbete al evento <strong>messages</strong></li>
          <li>Copia el <strong>Page Access Token</strong> y el <strong>Page ID</strong> aquí abajo</li>
        </ol>
      </div>

      {/* Webhook URL */}
      <div>
        <label className={labelClass}>URL del Webhook</label>
        <div className="flex flex-col sm:flex-row gap-2">
          <input readOnly value={webhookUrl}
            className="flex-1 min-w-0 bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-sm text-gray-600 select-all truncate" />
          <button type="button" onClick={copyWebhook}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm transition-colors shrink-0">
            {copied ? <CheckCircle size={16} /> : <Copy size={16} />}
            {copied ? 'Copiado' : 'Copiar'}
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-1.5">
          Token de verificación:{' '}
          <span className="font-mono bg-gray-100 px-1.5 py-0.5 rounded text-gray-700">{verifyToken}</span>
        </p>
      </div>

      {/* Formulario de tokens */}
      <form onSubmit={handleSave} className="space-y-3 border-t border-gray-100 pt-4">
        <div>
          <label className={labelClass}>Page ID de Instagram / Facebook</label>
          <input
            value={igPageId}
            onChange={e => setIgPageId(e.target.value)}
            placeholder="123456789012345"
            className={inputClass}
          />
          <p className="text-xs text-gray-400 mt-1">El ID numérico de tu página de Facebook vinculada a Instagram</p>
        </div>
        <div>
          <label className={labelClass}>Page Access Token</label>
          <div className="relative">
            <input
              type={showToken ? 'text' : 'password'}
              value={igToken}
              onChange={e => setIgToken(e.target.value)}
              placeholder="EAAxxxxxx..."
              className={`${inputClass} pr-10`}
            />
            <button
              type="button"
              onClick={() => setShowToken(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              {showToken ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-1">Token de acceso permanente de la página (genera uno en Meta Business Suite)</p>
        </div>
        <button
          type="submit"
          disabled={saving || !igToken || !igPageId}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-900 hover:bg-gray-800 disabled:opacity-50 text-white text-sm rounded-lg transition-colors"
        >
          <Save size={14} />
          {saving ? 'Guardando...' : 'Guardar configuración de Instagram'}
        </button>
      </form>
    </div>
  )
}
