'use client'

import { useState } from 'react'
import { Wifi, WifiOff, Copy, CheckCircle, ExternalLink } from 'lucide-react'
import toast from 'react-hot-toast'

export default function InstagramConnect() {
  const [copied, setCopied] = useState(false)

  const webhookUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/api/instagram/webhook`
    : '/api/instagram/webhook'

  const verifyToken = process.env.NEXT_PUBLIC_IG_VERIFY_TOKEN || 'crm_ig_webhook_2024'

  const copyWebhook = () => {
    navigator.clipboard.writeText(webhookUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="space-y-4">
      {/* Status badge */}
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-sm text-gray-500 bg-gray-50 border border-gray-200 px-3 py-1 rounded-full font-medium">
          <WifiOff size={14} /> No configurado
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

      {/* Placeholder conectado */}
      <div className="flex flex-col items-center gap-3 py-6 text-center">
        <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center">
          {/* Instagram gradient icon */}
          <svg viewBox="0 0 24 24" className="w-8 h-8" fill="none">
            <defs>
              <linearGradient id="ig-grad" x1="0%" y1="100%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#f09433" />
                <stop offset="25%" stopColor="#e6683c" />
                <stop offset="50%" stopColor="#dc2743" />
                <stop offset="75%" stopColor="#cc2366" />
                <stop offset="100%" stopColor="#bc1888" />
              </linearGradient>
            </defs>
            <rect x="2" y="2" width="20" height="20" rx="5" ry="5" stroke="url(#ig-grad)" strokeWidth="2" fill="none" />
            <circle cx="12" cy="12" r="4" stroke="url(#ig-grad)" strokeWidth="2" fill="none" />
            <circle cx="17.5" cy="6.5" r="1" fill="url(#ig-grad)" />
          </svg>
        </div>
        <div>
          <p className="text-sm font-medium text-gray-800">Instagram no conectado</p>
          <p className="text-xs text-gray-500 mt-0.5">Configura tu app en Meta for Developers para recibir mensajes</p>
        </div>
      </div>

      {/* Webhook URL */}
      <div className="border-t border-gray-100 pt-4 space-y-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">URL del Webhook</label>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              readOnly
              value={webhookUrl}
              className="flex-1 min-w-0 bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-sm text-gray-600 select-all truncate"
            />
            <button
              type="button"
              onClick={copyWebhook}
              className="flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm transition-colors shrink-0"
            >
              {copied ? <CheckCircle size={16} /> : <Copy size={16} />}
              {copied ? 'Copiado' : 'Copiar'}
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-1.5">
            Token de verificación:{' '}
            <span className="font-mono bg-gray-100 px-1.5 py-0.5 rounded text-gray-700">
              {verifyToken}
            </span>
          </p>
        </div>
        <p className="text-xs text-gray-400 bg-gray-50 border border-gray-100 rounded-lg px-3 py-2.5">
          Los tokens de acceso de Instagram son gestionados por el administrador del sistema por razones de seguridad.
        </p>
      </div>
    </div>
  )
}
