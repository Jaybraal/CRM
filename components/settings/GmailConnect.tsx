'use client'

import { useEffect, useState } from 'react'
import { WifiOff, CheckCircle, ExternalLink, Save, Eye, EyeOff, Loader2, Mail, RefreshCw, Send } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '@/context/AuthContext'

const inputClass = 'w-full bg-gray-50 border border-gray-200 rounded-md px-3.5 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400 text-sm font-mono transition-all'
const labelClass = 'block text-sm font-medium text-gray-700 mb-1.5'

export default function GmailConnect() {
  const { profile } = useAuth()
  const [email, setEmail] = useState('')
  const [appPassword, setAppPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [status, setStatus] = useState<'loading' | 'connected' | 'disconnected'>('loading')
  const [connectedEmail, setConnectedEmail] = useState('')

  const loadStatus = () => {
    if (!profile?.orgId) return
    fetch(`/api/settings?orgId=${profile.orgId}&action=get_gmail_status`)
      .then(r => r.json())
      .then(d => {
        setStatus(d.configured ? 'connected' : 'disconnected')
        setConnectedEmail(d.gmail_user || '')
      })
      .catch(() => setStatus('disconnected'))
  }

  useEffect(loadStatus, [profile?.orgId])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim() || !appPassword.trim()) {
      toast.error('Completa el correo y la contraseña de aplicación')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orgId: profile?.orgId,
          action: 'save_gmail_credentials',
          gmail_user: email.trim(),
          gmail_app_password: appPassword.trim(),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error al guardar')
      setStatus('connected')
      setConnectedEmail(email.trim())
      toast.success('Gmail guardado. Prueba la conexión para confirmar.')
      setAppPassword('')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  const handleTest = async () => {
    setTesting(true)
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgId: profile?.orgId, action: 'test_gmail' }),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) throw new Error(data.error || 'La prueba falló')
      toast.success('Conexión OK. Revisa tu bandeja: te enviamos un correo de prueba.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'La prueba falló')
    } finally {
      setTesting(false)
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
        <div className="flex items-center justify-between p-4 bg-gradient-to-r from-red-50 to-orange-50 border border-red-200 rounded-md">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-red-500 to-orange-600 rounded-lg shadow-md shadow-red-200">
              <Mail size={16} className="text-white" />
            </div>
            <div>
              <p className="text-sm font-semibold text-red-900">Gmail conectado</p>
              <p className="text-xs text-red-600">{connectedEmail}</p>
            </div>
          </div>
          <span className="flex items-center gap-1.5 text-xs font-medium text-red-700 bg-red-100 border border-red-200 px-2.5 py-1 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
            Activo
          </span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleTest}
            disabled={testing}
            className="flex items-center gap-2 text-sm text-emerald-700 hover:bg-emerald-50 border border-emerald-200 px-4 py-2 rounded-md transition-colors disabled:opacity-50"
          >
            {testing ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            {testing ? 'Enviando...' : 'Enviar prueba'}
          </button>
          <button
            onClick={() => { setStatus('disconnected'); setAppPassword('') }}
            className="flex items-center gap-2 text-sm text-gray-600 hover:bg-gray-100 border border-gray-200 px-4 py-2 rounded-md transition-colors"
          >
            <RefreshCw size={14} /> Cambiar cuenta
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
          href="https://myaccount.google.com/apppasswords"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-xs text-violet-600 hover:bg-violet-50 border border-violet-200 px-3 py-1.5 rounded-md transition-colors font-medium"
        >
          <ExternalLink size={12} /> Crear contraseña de aplicación
        </a>
      </div>

      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-md px-4 py-3 space-y-2">
        <p className="text-xs font-semibold text-blue-800">Cómo conectar tu Gmail para enviar campañas</p>
        <ol className="list-decimal list-inside space-y-1 text-xs text-blue-700 ml-1">
          <li>Activa la <strong>verificación en 2 pasos</strong> en tu cuenta de Google</li>
          <li>Entra a <strong>Contraseñas de aplicación</strong> (enlace arriba)</li>
          <li>Genera una para &quot;Correo&quot; → Google te da <strong>16 caracteres</strong></li>
          <li>Pega tu correo y esa contraseña aquí abajo (no es tu contraseña normal)</li>
          <li>Guarda y pulsa <strong>Enviar prueba</strong> para confirmar</li>
        </ol>
      </div>

      <form onSubmit={handleSave} className="space-y-4">
        <div>
          <label className={labelClass}>Correo de Gmail</label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="tucorreo@gmail.com"
            className={inputClass}
          />
        </div>

        <div>
          <label className={labelClass}>Contraseña de aplicación (16 caracteres)</label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={appPassword}
              onChange={e => setAppPassword(e.target.value)}
              placeholder="xxxx xxxx xxxx xxxx"
              className={`${inputClass} pr-10`}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-1.5">Se guarda cifrada. Los espacios se ignoran automáticamente.</p>
        </div>

        <button
          type="submit"
          disabled={saving || !email.trim() || !appPassword.trim()}
          className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-gradient-to-r from-red-500 to-orange-600 hover:from-red-600 hover:to-orange-700 disabled:from-gray-200 disabled:to-gray-300 text-white disabled:text-gray-400 rounded-md font-medium text-sm transition-all shadow-md shadow-red-200/50 disabled:shadow-none disabled:cursor-not-allowed"
        >
          {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
          {saving ? 'Guardando...' : 'Guardar y conectar Gmail'}
        </button>
      </form>
    </div>
  )
}
