'use client'

import { useEffect, useRef, useState } from 'react'
import { Smartphone, Wifi, WifiOff, RefreshCw, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'

type Status = 'connecting' | 'qr' | 'open' | 'disconnected'

export default function BaileysQR({ orgId }: { orgId: string }) {
  const [status, setStatus] = useState<Status>('connecting')
  const [frozenQr, setFrozenQr] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  // Ref para evitar closure stale — refleja si ya tenemos un QR congelado
  const hasQrRef = useRef(false)

  const sessionId = orgId || 'default'

  const poll = async (forceQrUpdate = false) => {
    try {
      const res = await fetch(`/api/whatsapp/sessions/${sessionId}?orgId=${sessionId}`)
      const data = await res.json()
      const newStatus = data.status as Status

      setStatus(newStatus)

      // Actualizar QR solo si: se fuerza, o no tenemos uno todavía
      if (data.qr && (forceQrUpdate || !hasQrRef.current)) {
        hasQrRef.current = true
        setFrozenQr(data.qr)
      }

      if (newStatus === 'open') {
        hasQrRef.current = false
        setFrozenQr(null)
        if (intervalRef.current) {
          clearInterval(intervalRef.current)
          intervalRef.current = null
        }
      }
    } catch {
      setStatus('disconnected')
    }
  }

  useEffect(() => {
    poll(true)
    intervalRef.current = setInterval(() => poll(false), 10000)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleDisconnect = async () => {
    if (!confirm('¿Desconectar WhatsApp? Tendrás que escanear el QR de nuevo.')) return
    setLoading(true)
    try {
      await fetch(`/api/whatsapp/sessions/${sessionId}`, { method: 'DELETE' })
      setStatus('disconnected')
      hasQrRef.current = false
      setFrozenQr(null)
      toast.success('WhatsApp desconectado')
    } catch {
      toast.error('Error al desconectar')
    } finally {
      setLoading(false)
    }
  }

  const handleReconnect = () => {
    setStatus('connecting')
    hasQrRef.current = false
    setFrozenQr(null)
    if (intervalRef.current) clearInterval(intervalRef.current)
    poll(true)
    intervalRef.current = setInterval(() => poll(false), 10000)
  }

  return (
    <div className="space-y-4">
      {/* Status badge */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {status === 'open' ? (
            <span className="flex items-center gap-1.5 text-sm text-green-700 bg-green-50 border border-green-200 px-3 py-1 rounded-full font-medium">
              <Wifi size={14} /> Conectado
            </span>
          ) : status === 'qr' ? (
            <span className="flex items-center gap-1.5 text-sm text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1 rounded-full font-medium">
              <Smartphone size={14} /> Escanea el QR
            </span>
          ) : status === 'connecting' ? (
            <span className="flex items-center gap-1.5 text-sm text-gray-600 bg-gray-50 border border-gray-200 px-3 py-1 rounded-full font-medium">
              <RefreshCw size={14} className="animate-spin" /> Conectando...
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-sm text-red-700 bg-red-50 border border-red-200 px-3 py-1 rounded-full font-medium">
              <WifiOff size={14} /> Desconectado
            </span>
          )}
        </div>

        {status === 'open' ? (
          <button
            onClick={handleDisconnect}
            disabled={loading}
            className="flex items-center gap-1.5 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 border border-red-200 px-3 py-1.5 rounded-lg transition-colors"
          >
            <Trash2 size={12} /> Desconectar
          </button>
        ) : (
          <button
            onClick={handleReconnect}
            className="flex items-center gap-1.5 text-xs text-gray-700 hover:bg-gray-100 border border-gray-200 px-3 py-1.5 rounded-lg transition-colors"
          >
            <RefreshCw size={12} /> Reintentar
          </button>
        )}
      </div>

      {/* QR congelado */}
      {frozenQr ? (
        <div className="flex flex-col items-center gap-4 py-4">
          <div className="bg-white p-4 rounded-2xl border-2 border-gray-100 shadow-sm">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={frozenQr} alt="QR WhatsApp" className="w-52 h-52" />
          </div>
          <div className="text-center space-y-1">
            <p className="text-sm font-medium text-gray-800">Escanea con tu teléfono</p>
            <p className="text-xs text-gray-500">WhatsApp → Dispositivos vinculados → Vincular dispositivo</p>
            <p className="text-xs text-gray-400 mt-1">Si el QR expiró, pulsa <strong>Reintentar</strong></p>
          </div>
        </div>
      ) : status === 'open' ? (
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center">
            <Wifi size={28} className="text-green-500" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-800">WhatsApp conectado y activo</p>
            <p className="text-xs text-gray-500 mt-0.5">Los mensajes se sincronizarán automáticamente</p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
          </div>
          <p className="text-xs text-gray-400">Iniciando conexión con WhatsApp...</p>
        </div>
      )}
    </div>
  )
}
