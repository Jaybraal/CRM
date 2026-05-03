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
  const sessionId = orgId || 'default'

  const poll = async (forceQrUpdate = false) => {
    try {
      const res = await fetch(`/api/whatsapp/sessions/${sessionId}?orgId=${sessionId}`)
      const data = await res.json()
      const newStatus = data.status as Status
      setStatus(newStatus)
      if (data.qr && (forceQrUpdate || !hasQrRef.current)) {
        hasQrRef.current = true
        setFrozenQr(data.qr)
      }
      if (newStatus === 'open') {
        hasQrRef.current = false
        setFrozenQr(null)
        if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null }
      }
    } catch { setStatus('disconnected') }
  }

  useEffect(() => {
    poll(true)
    intervalRef.current = setInterval(() => poll(false), 10000)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
    intervalRef.current = setInterval(() => poll(false), 10000)
  }

  const handleReset = async () => {
    if (!confirm('¿Reset completo? Esto borra el auth de Firestore y genera un QR nuevo.')) return
    setLoading(true)
    try {
      hasQrRef.current = false; setFrozenQr(null); setStatus('connecting')
      await fetch(`/api/whatsapp/sessions/${sessionId}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orgId: sessionId }) })
      if (intervalRef.current) clearInterval(intervalRef.current)
      setTimeout(() => { poll(true); intervalRef.current = setInterval(() => poll(false), 10000) }, 3000)
      toast.success('Sesión reseteada — esperando QR nuevo...')
    } catch { toast.error('Error al resetear') }
    finally { setLoading(false) }
  }

  return (
    <div className="space-y-4">
<<<<<<< HEAD
=======
      {/* Status row */}
>>>>>>> origin/main
      <div className="flex items-center justify-between">
        <div>
          {status === 'open' ? (
<<<<<<< HEAD
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
=======
            <span className="flex items-center gap-1.5 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Conectado
            </span>
          ) : status === 'qr' ? (
            <span className="flex items-center gap-1.5 text-sm text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1 rounded-full font-medium">
              <Smartphone size={13} /> Escanea el QR
            </span>
          ) : status === 'connecting' ? (
            <span className="flex items-center gap-1.5 text-sm text-blue-600 bg-blue-50 border border-blue-200 px-3 py-1 rounded-full font-medium">
              <RefreshCw size={13} className="animate-spin" /> Conectando...
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-sm text-red-700 bg-red-50 border border-red-200 px-3 py-1 rounded-full font-medium">
              <WifiOff size={13} /> Desconectado
>>>>>>> origin/main
            </span>
          )}
        </div>

        {status === 'open' ? (
<<<<<<< HEAD
          <button onClick={handleDisconnect} disabled={loading}
            className="flex items-center gap-1.5 text-xs font-bold text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 border border-red-200 dark:border-red-800 px-3 py-1.5 rounded-xl transition-colors">
=======
          <button
            onClick={handleDisconnect}
            disabled={loading}
            className="flex items-center gap-1.5 text-xs text-red-600 hover:bg-red-50 border border-red-200 px-3 py-1.5 rounded-xl transition-colors disabled:opacity-50"
          >
>>>>>>> origin/main
            <Trash2 size={12} /> Desconectar
          </button>
        ) : (
          <div className="flex gap-2">
<<<<<<< HEAD
            <button onClick={handleReconnect}
              className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-1.5 rounded-xl transition-colors">
              <RefreshCw size={12} /> Reintentar
            </button>
            <button onClick={handleReset} disabled={loading}
              className="flex items-center gap-1.5 text-xs font-bold text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 border border-amber-200 dark:border-amber-800 px-3 py-1.5 rounded-xl transition-colors disabled:opacity-50">
=======
            <button
              onClick={handleReconnect}
              className="flex items-center gap-1.5 text-xs text-gray-700 hover:bg-gray-100 border border-gray-200 px-3 py-1.5 rounded-xl transition-colors"
            >
              <RefreshCw size={12} /> Reintentar
            </button>
            <button
              onClick={handleReset}
              disabled={loading}
              className="flex items-center gap-1.5 text-xs text-orange-600 hover:bg-orange-50 border border-orange-200 px-3 py-1.5 rounded-xl transition-colors disabled:opacity-50"
              title="Borra el auth guardado y genera un QR completamente nuevo"
            >
>>>>>>> origin/main
              <RotateCcw size={12} /> Reset
            </button>
          </div>
        )}
      </div>

<<<<<<< HEAD
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
=======
      {/* Main area */}
      {frozenQr ? (
        <div className="flex flex-col items-center gap-4 py-4">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-400/20 to-green-400/20 rounded-2xl blur-xl" />
            <div className="relative bg-white p-4 rounded-2xl border-2 border-emerald-100 shadow-lg">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={frozenQr} alt="QR WhatsApp" className="w-52 h-52" />
            </div>
          </div>
          <div className="text-center space-y-1">
            <p className="text-sm font-semibold text-gray-800">Escanea con tu teléfono</p>
            <p className="text-xs text-gray-500">WhatsApp → Dispositivos vinculados → Vincular dispositivo</p>
            <p className="text-xs text-gray-400 mt-1">Si el QR expiró, pulsa <strong>Reintentar</strong></p>
>>>>>>> origin/main
          </div>
        </div>
      ) : status === 'open' ? (
        <div className="flex flex-col items-center gap-3 py-6 text-center">
<<<<<<< HEAD
          <div className="w-16 h-16 bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl flex items-center justify-center">
            <Wifi size={28} className="text-emerald-500" />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-800 dark:text-slate-200">WhatsApp conectado y activo</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Los mensajes se sincronizarán automáticamente</p>
=======
          <div className="relative">
            <div className="absolute inset-0 bg-emerald-400/20 rounded-full blur-xl" />
            <div className="relative w-16 h-16 bg-gradient-to-br from-emerald-400 to-green-500 rounded-full flex items-center justify-center shadow-lg shadow-emerald-200">
              <CheckCircle2 size={30} className="text-white" />
            </div>
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-800">WhatsApp conectado y activo</p>
            <p className="text-xs text-gray-500 mt-0.5">Los mensajes se sincronizan automáticamente</p>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-100">
            <Wifi size={12} /> Sesión activa
>>>>>>> origin/main
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3 py-6 text-center">
<<<<<<< HEAD
          <div className="w-16 h-16 bg-slate-50 dark:bg-slate-800 rounded-2xl flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
=======
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
>>>>>>> origin/main
          </div>
          <p className="text-xs text-slate-400 dark:text-slate-500">Iniciando conexión con WhatsApp...</p>
        </div>
      )}
    </div>
  )
}
