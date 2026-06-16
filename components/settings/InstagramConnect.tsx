'use client'

import { useEffect, useState } from 'react'
import { WifiOff, Copy, CheckCircle, ExternalLink, Save, Eye, EyeOff, Loader2, Instagram, RefreshCw } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '@/context/AuthContext'

const inputClass = 'w-full bg-gray-50 border border-gray-200 rounded-md px-3.5 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400 text-sm font-mono transition-all'
const labelClass = 'block text-sm font-medium text-gray-700 mb-1.5'

export default function InstagramConnect() {
  const { profile } = useAuth()
  const [copied, setCopied] = useState(false)
  const [igToken, setIgToken] = useState('')
  const [igPageId, setIgPageId] = useState('')
  const [saving, setSaving] = useState(false)
  const [showToken, setShowToken] = useState(false)
  const [status, setStatus] = useState<'loading' | 'connected' | 'disconnected'>('loading')

  const webhookUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/api/instagram/webhook`
    : '/api/instagram/webhook'

  const verifyToken = process.env.NEXT_PUBLIC_IG_VERIFY_TOKEN || 'crm_ig_webhook_2024'

  useEffect(() => {
    if (!profile?.orgId) return
    fetch(`/api/settings?orgId=${profile.orgId}&action=get_ig_status`)
      .then(r => r.json())
      .then(d => setStatus(d.configured ? 'connected' : 'disconnected'))
      .catch(() => setStatus('disconnected'))
  }, [profile?.orgId])

  const copyWebhook = () => {
    navigator.clipboard.writeText(webhookUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const copyVerifyToken = () => {
    navigator.clipboard.writeText(verifyToken)
    toast.success('Token de verificación copiado')
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
      setStatus('connected')
      toast.success('Instagram configurado correctamente')
      setIgToken('')
      setIgPageId('')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  const handleDisconnect = async () => {
    if (!confirm('¿Desconectar Instagram? Los mensajes dejarán de sincronizarse.')) return
    setSaving(true)
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orgId: profile?.orgId,
          action: 'save_ig_tokens',
          ig_token: '',
          ig_page_id: '',
        }),
      })
      if (!res.ok) throw new Error('Error al desconectar')
      setStatus('disconnected')
      toast.success('Instagram desconectado')
    } catch {
      toast.error('Error al desconectar')
    } finally {
      setSaving(false)
    }
  }

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center py-8 gap-2 text-gray-400">
        <Loader2 size={16} className="animate-spin" />
        <span className="text-sm">Verificando conexión...</span>
      </div>
    )
  }

  if (status === 'connected') {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between p-4 bg-gradient-to-r from-pink-50 to-rose-50 border border-pink-200 rounded-md">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-pink-500 to-rose-600 rounded-lg shadow-md shadow-pink-200">
              <Instagram size={16} className="text-white" />
            </div>
            <div>
              <p className="text-sm font-semibold text-pink-900">Instagram conectado</p>
              <p className="text-xs text-pink-600">Los mensajes se sincronizan automáticamente</p>
            </div>
          </div>
          <span className="flex items-center gap-1.5 text-xs font-medium text-pink-700 bg-pink-100 border border-pink-200 px-2.5 py-1 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-pink-500 animate-pulse" />
            Activo
          </span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setStatus('disconnected')}
            className="flex items-center gap-2 text-sm text-gray-600 hover:bg-gray-100 border border-gray-200 px-4 py-2 rounded-md transition-colors"
          >
            <RefreshCw size={14} /> Actualizar token
          </button>
          <button
            onClick={handleDisconnect}
            disabled={saving}
            className="flex items-center gap-2 text-sm text-red-600 hover:bg-red-50 border border-red-200 px-4 py-2 rounded-md transition-colors disabled:opacity-50"
          >
            <WifiOff size={14} /> Desconectar
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-sm px-3 py-1 rounded-full font-medium border text-gray-500 bg-gray-50 border-gray-200">
          <WifiOff size={13} /> No configurado
        </span>
        <a
          href="https://developers.facebook.com/apps"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-xs text-violet-600 hover:bg-violet-50 border border-violet-200 px-3 py-1.5 rounded-md transition-colors font-medium"
        >
          <ExternalLink size={12} /> Meta for Developers
        </a>
      </div>

      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-md px-4 py-3 space-y-2">
        <p className="text-xs font-semibold text-blue-800">Pasos para conectar Instagram DM</p>
        <ol className="list-decimal list-inside space-y-1 text-xs text-blue-700 ml-1">
          <li>Crea o entra a tu app en <strong>Meta for Developers</strong></li>
          <li>Agrega el producto <strong>Messenger</strong> (soporta Instagram DM)</li>
          <li>En <strong>Webhooks</strong>, pega la URL y el token de verificación de abajo</li>
          <li>Suscríbete al evento <strong>messages</strong></li>
          <li>Copia el <strong>Page Access Token</strong> y <strong>Page ID</strong> aquí abajo</li>
        </ol>
      </div>

      <form onSubmit={handleSave} className="space-y-4">
        <div>
          <label className={labelClass}>URL del Webhook</label>
          <div className="flex gap-2">
            <input type="text" value={webhookUrl} readOnly className={`${inputClass} bg-gray-100 text-gray-500 cursor-default`} />
            <button
              type="button"
              onClick={copyWebhook}
              className="flex items-center gap-1.5 text-sm px-3 py-2.5 rounded-md border border-gray-200 hover:bg-gray-100 transition-colors flex-shrink-0 text-gray-700"
            >
              {copied ? <CheckCircle size={14} className="text-green-500" /> : <Copy size={14} />}
              {copied ? 'Copiado' : 'Copiar'}
            </button>
          </div>
        </div>

        <div>
          <label className={labelClass}>Token de verificación</label>
          <div className="flex gap-2">
            <input type="text" value={verifyToken} readOnly className={`${inputClass} bg-gray-100 text-gray-500 cursor-default`} />
            <button
              type="button"
              onClick={copyVerifyToken}
              className="flex items-center gap-1.5 text-sm px-3 py-2.5 rounded-md border border-gray-200 hover:bg-gray-100 transition-colors flex-shrink-0 text-gray-700"
            >
              <Copy size={14} /> Copiar
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-1.5">Ingresa este valor en el campo &quot;Verify Token&quot; de Meta</p>
        </div>

        <div className="flex items-center gap-3 py-1">
          <div className="flex-1 h-px bg-gray-100" />
          <span className="text-xs text-gray-400 font-medium">Credenciales de tu app</span>
          <div className="flex-1 h-px bg-gray-100" />
        </div>

        <div>
          <label className={labelClass}>Page Access Token</label>
          <div className="relative">
            <input
              type={showToken ? 'text' : 'password'}
              value={igToken}
              onChange={e => setIgToken(e.target.value)}
              placeholder="EAAxxxxxxxxxxxxx..."
              className={`${inputClass} pr-10`}
            />
            <button
              type="button"
              onClick={() => setShowToken(!showToken)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              {showToken ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-1.5">App → Messenger → Tokens de acceso</p>
        </div>

        <div>
          <label className={labelClass}>Page ID</label>
          <input
            type="text"
            value={igPageId}
            onChange={e => setIgPageId(e.target.value)}
            placeholder="123456789012345"
            className={inputClass}
          />
          <p className="text-xs text-gray-400 mt-1.5">Configuración de la página → Información básica</p>
        </div>

        <button
          type="submit"
          disabled={saving || !igToken.trim() || !igPageId.trim()}
          className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-gradient-to-r from-pink-500 to-rose-600 hover:from-pink-600 hover:to-rose-700 disabled:from-gray-200 disabled:to-gray-300 text-white disabled:text-gray-400 rounded-md font-medium text-sm transition-all shadow-md shadow-pink-200/50 disabled:shadow-none disabled:cursor-not-allowed"
        >
          {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
          {saving ? 'Guardando...' : 'Guardar y conectar Instagram'}
        </button>
      </form>
    </div>
  )
}
