'use client'

import { useEffect, useRef, useState } from 'react'
import { Smartphone, Wifi, WifiOff, RefreshCw, Trash2, RotateCcw, CheckCircle2 } from 'lucide-react'
import toast from 'react-hot-toast'

type Status = 'connecting' | 'qr' | 'open' | 'disconnected'

export default function BaileysQR({ orgId }: { orgId: string }) {
  const [status, setStatus] = useState<Status>('connecting')
  const [frozenQr, setFrozenQr] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const hasQrRef = useRef(false)
  // La sesión SIEMPRE va atada al orgId real (modelo multi-tenant). Nunca caer a
  // una sesión 'default' compartida: eso mezclaría WhatsApp entre negocios y
  // provoca conflictos de sesión (código 440).
  const sessionId = orgId

  const poll = async (forceQrUpdate = false) => {
    if (!sessionId) return
    try {
      const res = await fetch(`/api/whatsapp/sessions/${sessionId}?orgId=${sessionId}`)
      const data = await res.json()
      const newStatus = data.status as Status
      setStatus(newStatus)
      // Mostrar SIEMPRE el QR vigente del servidor. WhatsApp rota el QR cada
      // ~20-60s; si mostramos uno viejo (congelado), el escaneo falla. Si el
      // servidor devuelve null (durante reconexión) mantenemos el último válido.
      if (data.qr) {
        hasQrRef.current = true
        setFrozenQr(data.qr)
      }
      void forceQrUpdate
      if (newStatus === 'open') {
        hasQrRef.current = false
        setFrozenQr(null)
        if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null }
      }
    } catch { setStatus('disconnected') }
  }

  useEffect(() => {
    if (!sessionId) return
    poll(true)
    intervalRef.current = setInterval(() => poll(false), 5000)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId])

  const handleDisconnect = async () => {
    if (!confirm('¿Desconectar WhatsApp? Tendrás que escanear el QR de nuevo.')) return
    setLoading(true)
    try {
      await fetch(`/api/whatsapp/sessions/${sessionId}`, { method: 'DELETE' })
      setStatus('disconnected'); hasQrRef.current = false; setFrozenQr(null)
      toast.success('WhatsApp desconectado')
    } catch { toast.error('Error al desconectar') }
    finally { setLoading(false) }
  }

  const handleReconnect = () => {
    setStatus('connecting'); hasQrRef.current = false; setFrozenQr(null)
    if (intervalRef.current) clearInterval(intervalRef.current)
    poll(true)
    intervalRef.current = setInterval(() => poll(false), 5000)
  }

  const handleReset = async () => {
    if (!confirm('¿Reset completo? Esto borra el auth de Firestore y genera un QR nuevo.')) return
    setLoading(true)
    try {
      hasQrRef.current = false; setFrozenQr(null); setStatus('connecting')
      await fetch(`/api/whatsapp/sessions/${sessionId}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orgId: sessionId }) })
      if (intervalRef.current) clearInterval(intervalRef.current)
      setTimeout(() => { poll(true); intervalRef.current = setInterval(() => poll(false), 5000) }, 3000)
      toast.success('Sesión reseteada — esperando QR nuevo...')
    } catch { toast.error('Error al resetear') }
    finally { setLoading(false) }
  }

  if (!sessionId) {
    return (
      <div className="flex flex-col items-center gap-3 py-8 text-center">
        <div className="w-16 h-16 bg-amber-50 dark:bg-amber-900/20 rounded-2xl flex items-center justify-center">
          <WifiOff size={28} className="text-amber-500" />
        </div>
        <div>
          <p className="text-sm font-bold text-slate-800 dark:text-slate-200">Selecciona un negocio primero</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Elige tu negocio activo en la barra superior para vincular WhatsApp.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          {status === 'open' ? (
            <span className="flex items-center gap-1.5 text-sm text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 px-3 py-1 rounded-full font-bold">
              <Wifi size={14} /> Conectado
            </span>
          ) : status === 'qr' ? (
            <span className="flex items-center gap-1.5 text-sm text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 px-3 py-1 rounded-full font-bold">
              <Smartphone size={14} /> Escanea el QR
            </span>
          ) : status === 'connecting' ? (
            <span className="flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-1 rounded-full font-bold">
              <RefreshCw size={14} className="animate-spin" /> Conectando...
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-sm text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-3 py-1 rounded-full font-bold">
              <WifiOff size={14} /> Desconectado
            </span>
          )}
        </div>

        {status === 'open' ? (
          <button onClick={handleDisconnect} disabled={loading}
            className="flex items-center gap-1.5 text-xs font-bold text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 border border-red-200 dark:border-red-800 px-3 py-1.5 rounded-xl transition-colors">
            <Trash2 size={12} /> Desconectar
          </button>
        ) : (
          <div className="flex gap-2">
            <button onClick={handleReconnect}
              className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-1.5 rounded-xl transition-colors">
              <RefreshCw size={12} /> Reintentar
            </button>
            <button onClick={handleReset} disabled={loading}
              className="flex items-center gap-1.5 text-xs font-bold text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 border border-amber-200 dark:border-amber-800 px-3 py-1.5 rounded-xl transition-colors disabled:opacity-50">
              <RotateCcw size={12} /> Reset
            </button>
          </div>
        )}
      </div>

      {frozenQr ? (
        <div className="flex flex-col items-center gap-4 py-4">
          <div className="bg-white p-4 rounded-2xl border-2 border-slate-100 shadow-sm">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={frozenQr} alt="QR WhatsApp" className="w-52 h-52" />
          </div>
          <div className="text-center space-y-1">
            <p className="text-sm font-bold text-slate-800 dark:text-slate-200">Escanea con tu teléfono</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">WhatsApp → Dispositivos vinculados → Vincular dispositivo</p>
            <p className="text-xs text-slate-400 mt-1">Si el QR expiró, pulsa <strong>Reintentar</strong></p>
          </div>
        </div>
      ) : status === 'open' ? (
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          <div className="w-16 h-16 bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl flex items-center justify-center">
            <Wifi size={28} className="text-emerald-500" />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-800 dark:text-slate-200">WhatsApp conectado y activo</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Los mensajes se sincronizarán automáticamente</p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          <div className="w-16 h-16 bg-slate-50 dark:bg-slate-800 rounded-2xl flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
          <p className="text-xs text-slate-400 dark:text-slate-500">Iniciando conexión con WhatsApp...</p>
        </div>
      )}
    </div>
  )
}
