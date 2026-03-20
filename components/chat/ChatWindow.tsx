'use client'

import { useEffect, useRef, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { subscribeToMessages, sendMessage, getWhatsAppTemplates } from '@/lib/firestore'
import { uploadMultiplePhotos } from '@/lib/storage'
import type { Client, Message, WhatsAppTemplate } from '@/types'
import { Send, Paperclip, X, MessageCircle, Zap, MapPin, Phone, PhoneCall, PhoneMissed, Navigation } from 'lucide-react'
import toast from 'react-hot-toast'

interface Props {
  client: Client
  hasWhatsApp: boolean
}

export default function ChatWindow({ client, hasWhatsApp }: Props) {
  const { profile } = useAuth()
  const [messages, setMessages] = useState<Message[]>([])
  const [text, setText] = useState('')
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const [pendingPreviews, setPendingPreviews] = useState<string[]>([])
  const [sending, setSending] = useState(false)
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>([])
  const [showTemplates, setShowTemplates] = useState(false)
  const [showLocationModal, setShowLocationModal] = useState(false)
  const [locationInput, setLocationInput] = useState({ lat: '', lng: '', name: '' })
  const [gettingGps, setGettingGps] = useState(false)
  const [calling, setCalling] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!profile?.orgId) return
    const unsub = subscribeToMessages(profile.orgId, client.id, setMessages)
    getWhatsAppTemplates(profile.orgId).then(setTemplates)
    return unsub
  }, [profile?.orgId, client.id])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleFiles = (files: FileList | null) => {
    if (!files) return
    const arr = Array.from(files)
    setPendingFiles(prev => [...prev, ...arr])
    arr.forEach(f => {
      const reader = new FileReader()
      reader.onload = e => setPendingPreviews(prev => [...prev, e.target?.result as string])
      reader.readAsDataURL(f)
    })
  }

  const removePending = (idx: number) => {
    setPendingFiles(prev => prev.filter((_, i) => i !== idx))
    setPendingPreviews(prev => prev.filter((_, i) => i !== idx))
  }

  const handleSend = async () => {
    if (!text.trim() && pendingFiles.length === 0) return
    if (!profile?.orgId) return
    setSending(true)
    try {
      let photoUrls: string[] = []
      if (pendingFiles.length > 0) {
        photoUrls = await uploadMultiplePhotos(profile.orgId, `chat/${client.id}`, pendingFiles)
      }

      await sendMessage(profile.orgId, client.id, {
        type: photoUrls.length > 0 ? 'image' : 'text',
        text: text.trim() || undefined,
        photos: photoUrls,
        senderId: profile.uid,
        senderName: profile.displayName,
        source: 'internal',
      })

      if (hasWhatsApp && client.whatsappPhone) {
        const jid = client.whatsappJid || client.whatsappPhone
        // Send images via proper Baileys image endpoint
        for (const url of photoUrls) {
          await fetch('/api/whatsapp/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ orgId: profile.orgId, to: jid, photoUrls: [url], type: 'image' }),
          })
        }
        // Send text
        if (text.trim()) {
          const waRes = await fetch('/api/whatsapp/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ orgId: profile.orgId, to: jid, text: text.trim(), type: 'text' }),
          })
          if (!waRes.ok) toast.error('Mensaje guardado pero fallo en WhatsApp', { duration: 4000 })
        }
      }

      setText('')
      setPendingFiles([])
      setPendingPreviews([])
    } catch {
      toast.error('Error al enviar')
    } finally {
      setSending(false)
    }
  }

  const handleGetGps = () => {
    if (!navigator.geolocation) { toast.error('GPS no disponible'); return }
    setGettingGps(true)
    navigator.geolocation.getCurrentPosition(
      pos => {
        setLocationInput(prev => ({
          ...prev,
          lat: pos.coords.latitude.toString(),
          lng: pos.coords.longitude.toString(),
        }))
        setGettingGps(false)
      },
      () => { toast.error('No se pudo obtener ubicación'); setGettingGps(false) }
    )
  }

  const handleSendLocation = async () => {
    const lat = parseFloat(locationInput.lat)
    const lng = parseFloat(locationInput.lng)
    if (isNaN(lat) || isNaN(lng)) { toast.error('Coordenadas inválidas'); return }
    if (!profile?.orgId) return
    setSending(true)
    try {
      await sendMessage(profile.orgId, client.id, {
        type: 'location',
        text: `📍 Ubicación compartida`,
        photos: [],
        location: { lat, lng, name: locationInput.name },
        senderId: profile.uid,
        senderName: profile.displayName,
        source: 'internal',
      })

      if (hasWhatsApp && client.whatsappJid) {
        await fetch('/api/whatsapp/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orgId: profile.orgId,
            to: client.whatsappJid,
            type: 'location',
            location: { lat, lng, name: locationInput.name },
          }),
        })
      }

      setShowLocationModal(false)
      setLocationInput({ lat: '', lng: '', name: '' })
    } catch {
      toast.error('Error al enviar ubicación')
    } finally {
      setSending(false)
    }
  }

  const handleCall = async () => {
    const phone = client.whatsappPhone || client.whatsappJid?.replace('@s.whatsapp.net', '')
    if (!phone) { toast.error('Sin número WhatsApp'); return }
    if (!profile?.orgId) return
    // Open WhatsApp directly — Baileys does not support outgoing calls
    const clean = phone.replace(/[^0-9]/g, '')
    window.open(`https://wa.me/${clean}`, '_blank')
    // Log call activity
    try {
      await sendMessage(profile.orgId, client.id, {
        type: 'call',
        text: '📞 Llamada saliente (via WhatsApp)',
        photos: [],
        callDuration: 0,
        senderId: profile.uid,
        senderName: profile.displayName,
        source: 'internal',
      })
    } catch { /* ignore */ }
  }

  const formatTime = (date: Date | { seconds: number } | undefined) => {
    if (!date) return ''
    const d = date instanceof Date ? date : new Date((date as { seconds: number }).seconds * 1000)
    return d.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })
  }

  const renderMessage = (msg: Message) => {
    const isInternal = msg.source === 'internal'

    if (msg.type === 'location' && msg.location) {
      const { lat, lng, name } = msg.location
      const mapsUrl = `https://maps.google.com/?q=${lat},${lng}`
      return (
        <a
          href={mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={`flex items-center gap-3 rounded-2xl px-4 py-3 cursor-pointer hover:opacity-90 transition-opacity ${isInternal ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-900'}`}
        >
          <div className={`p-2 rounded-full ${isInternal ? 'bg-white/20' : 'bg-green-100'}`}>
            <MapPin size={18} className={isInternal ? 'text-white' : 'text-green-600'} />
          </div>
          <div>
            <p className="text-sm font-medium">{name || 'Ubicación'}</p>
            <p className={`text-xs ${isInternal ? 'text-white/70' : 'text-gray-500'}`}>{lat.toFixed(5)}, {lng.toFixed(5)}</p>
            <p className={`text-xs mt-0.5 ${isInternal ? 'text-white/60' : 'text-blue-500'}`}>Abrir en Maps →</p>
          </div>
        </a>
      )
    }

    if (msg.type === 'call') {
      const missed = msg.callDuration === -1 || msg.callDuration == null
      const Icon = missed ? PhoneMissed : PhoneCall
      return (
        <div className={`flex items-center gap-3 rounded-2xl px-4 py-3 ${isInternal ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-900'}`}>
          <div className={`p-2 rounded-full ${missed ? (isInternal ? 'bg-red-500/30' : 'bg-red-100') : (isInternal ? 'bg-green-500/30' : 'bg-green-100')}`}>
            <Icon size={18} className={missed ? 'text-red-400' : 'text-green-500'} />
          </div>
          <div>
            <p className="text-sm font-medium">{missed ? 'Llamada perdida' : `Llamada${msg.callDuration ? ` · ${msg.callDuration}s` : ''}`}</p>
            <p className={`text-xs ${isInternal ? 'text-white/60' : 'text-gray-400'}`}>{isInternal ? 'Saliente' : 'Entrante'}</p>
          </div>
        </div>
      )
    }

    return (
      <div className={`rounded-2xl px-4 py-2.5 ${isInternal ? 'bg-gray-900 text-white rounded-tr-sm' : 'bg-gray-100 text-gray-900 rounded-tl-sm'}`}>
        {msg.photos?.length > 0 && (
          <div className={`grid gap-1.5 mb-2 ${msg.photos.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
            {msg.photos.map((url, i) =>
              /\.(mp4|mov|webm|ogg)(\?|$)/i.test(url) ? (
                <video
                  key={i}
                  src={url}
                  controls
                  className="rounded-lg max-h-48 w-full"
                />
              ) : (
                <img
                  key={i}
                  src={url}
                  alt=""
                  className="rounded-lg object-cover max-h-48 w-full cursor-pointer"
                  onClick={() => window.open(url, '_blank')}
                />
              )
            )}
          </div>
        )}
        {msg.text && <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.text}</p>}
      </div>
    )
  }

  return (
    <div className="relative flex flex-col h-[calc(100vh-220px)] min-h-[400px] bg-white border border-gray-200 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50">
        <div className="flex items-center gap-3">
          <MessageCircle size={18} className="text-gray-500" />
          <div>
            <p className="text-sm font-semibold text-gray-900">{client.name}</p>
            {client.whatsappPhone ? (
              <p className="text-xs text-gray-500">
                {client.whatsappPhone}
                {hasWhatsApp
                  ? <span className="ml-2 text-green-600 font-medium">● Conectado</span>
                  : <span className="ml-2 text-gray-400">● Sin conexión</span>
                }
              </p>
            ) : (
              <p className="text-xs text-gray-400">Sin número WhatsApp</p>
            )}
          </div>
        </div>
        {/* Call button in header */}
        {hasWhatsApp && client.whatsappPhone && (
          <button
            onClick={handleCall}
            disabled={calling}
            className="flex items-center gap-2 px-3 py-2 bg-green-500 hover:bg-green-600 disabled:opacity-50 text-white rounded-lg text-xs font-medium transition-colors"
            title="Llamar por WhatsApp"
          >
            {calling
              ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              : <Phone size={14} />
            }
            Llamar
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <div className="flex items-center justify-center h-full">
            <p className="text-sm text-gray-400">Sin mensajes aún.</p>
          </div>
        )}
        {messages.map(msg => {
          const isInternal = msg.source === 'internal'
          return (
            <div key={msg.id} className={`flex ${isInternal ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[75%] space-y-1.5 ${isInternal ? 'items-end' : 'items-start'} flex flex-col`}>
                <span className="text-xs text-gray-400 px-1">
                  {isInternal ? msg.senderName : `${client.name} · WhatsApp`}
                </span>
                {renderMessage(msg)}
                <span className="text-xs text-gray-400 px-1">{formatTime(msg.createdAt as Date)}</span>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {/* Pending photos preview */}
      {pendingPreviews.length > 0 && (
        <div className="px-4 pb-2 flex gap-2 flex-wrap border-t border-gray-100 pt-2">
          {pendingPreviews.map((src, i) => (
            <div key={i} className="relative w-16 h-16">
              <img src={src} alt="" className="w-full h-full object-cover rounded-lg border border-gray-200" />
              <button
                onClick={() => removePending(i)}
                className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5"
              >
                <X size={10} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Location Modal */}
      {showLocationModal && (
        <div className="absolute inset-0 bg-black/30 z-20 flex items-end justify-center p-4">
          <div className="bg-white rounded-2xl p-5 w-full max-w-sm space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Enviar ubicación</h3>
              <button onClick={() => setShowLocationModal(false)} className="text-gray-400 hover:text-gray-700">
                <X size={18} />
              </button>
            </div>
            <button
              onClick={handleGetGps}
              disabled={gettingGps}
              className="w-full flex items-center justify-center gap-2 py-2.5 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 transition-colors"
            >
              {gettingGps
                ? <div className="w-4 h-4 border-2 border-gray-500 border-t-transparent rounded-full animate-spin" />
                : <Navigation size={16} />
              }
              Usar mi ubicación GPS
            </button>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Latitud</label>
                <input
                  value={locationInput.lat}
                  onChange={e => setLocationInput(p => ({ ...p, lat: e.target.value }))}
                  placeholder="-12.0464"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gray-400"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Longitud</label>
                <input
                  value={locationInput.lng}
                  onChange={e => setLocationInput(p => ({ ...p, lng: e.target.value }))}
                  placeholder="-77.0428"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gray-400"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Nombre del lugar (opcional)</label>
              <input
                value={locationInput.name}
                onChange={e => setLocationInput(p => ({ ...p, name: e.target.value }))}
                placeholder="Ej: Oficina principal"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gray-400"
              />
            </div>
            <button
              onClick={handleSendLocation}
              disabled={sending || !locationInput.lat || !locationInput.lng}
              className="w-full bg-gray-900 hover:bg-gray-800 disabled:opacity-50 text-white font-semibold py-2.5 rounded-lg text-sm transition-colors"
            >
              {sending ? 'Enviando...' : 'Enviar ubicación'}
            </button>
          </div>
        </div>
      )}

      {/* Input */}
      <div className="p-3 border-t border-gray-100 flex items-end gap-2 relative">
        {/* Templates */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowTemplates(v => !v)}
            className="p-2.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            title="Plantillas"
          >
            <Zap size={18} />
          </button>
          {showTemplates && templates.length > 0 && (
            <div className="absolute bottom-12 left-0 w-64 bg-white border border-gray-200 rounded-xl shadow-lg z-10 overflow-hidden">
              {templates.map(t => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => { setText(t.body); setShowTemplates(false) }}
                  className="w-full text-left px-4 py-3 hover:bg-gray-50 border-b border-gray-100 last:border-0"
                >
                  <p className="text-xs font-semibold text-gray-700">{t.name}</p>
                  <p className="text-xs text-gray-400 line-clamp-1 mt-0.5">{t.body}</p>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Attach photos */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="p-2.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          title="Adjuntar fotos"
        >
          <Paperclip size={18} />
        </button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*,video/*"
          className="hidden"
          onChange={e => handleFiles(e.target.files)}
        />

        {/* Location */}
        <button
          type="button"
          onClick={() => setShowLocationModal(true)}
          className="p-2.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
          title="Enviar ubicación"
        >
          <MapPin size={18} />
        </button>

        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
          }}
          rows={1}
          placeholder="Escribe un mensaje..."
          className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-gray-400 resize-none"
          style={{ maxHeight: '120px', overflowY: 'auto' }}
        />
        <button
          onClick={handleSend}
          disabled={sending || (!text.trim() && pendingFiles.length === 0)}
          className="p-2.5 bg-gray-900 hover:bg-gray-700 disabled:opacity-40 text-white rounded-xl transition-colors flex-shrink-0"
        >
          {sending
            ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            : <Send size={16} />
          }
        </button>
      </div>
    </div>
  )
}
