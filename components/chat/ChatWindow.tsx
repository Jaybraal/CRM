'use client'

import { useEffect, useRef, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { subscribeToMessages, sendMessage, getWhatsAppTemplates } from '@/lib/firestore'
import { uploadMultiplePhotos } from '@/lib/storage'
import type { Client, Message, WhatsAppTemplate } from '@/types'
import { Send, Paperclip, X, Zap, MapPin, Phone, PhoneCall, PhoneMissed, Navigation, ChevronDown } from 'lucide-react'
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
        for (const url of photoUrls) {
          await fetch('/api/whatsapp/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ orgId: profile.orgId, to: jid, photoUrls: [url], type: 'image' }),
          })
        }
        if (text.trim()) {
          const waRes = await fetch('/api/whatsapp/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ orgId: profile.orgId, to: jid, text: text.trim(), type: 'text' }),
          })
          if (!waRes.ok) toast.error('Mensaje guardado pero falló en WhatsApp', { duration: 4000 })
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
        text: '📍 Ubicación compartida',
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
    const clean = phone.replace(/[^0-9]/g, '')
    window.open(`https://wa.me/${clean}`, '_blank')
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

  const initials = client.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()

  const renderMessage = (msg: Message) => {
    const isMe = msg.source === 'internal'

    if (msg.type === 'location' && msg.location) {
      const { lat, lng, name } = msg.location
      const mapsUrl = `https://maps.google.com/?q=${lat},${lng}`
      return (
        <a href={mapsUrl} target="_blank" rel="noopener noreferrer"
          className={`flex items-center gap-3 rounded-2xl px-4 py-3 cursor-pointer hover:opacity-90 transition-opacity max-w-[260px] ${isMe ? 'bg-[#DCF8C6]' : 'bg-white'}`}>
          <div className={`p-2 rounded-full ${isMe ? 'bg-green-300/40' : 'bg-green-100'}`}>
            <MapPin size={18} className="text-green-700" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-900">{name || 'Ubicación'}</p>
            <p className="text-xs text-gray-500">{lat.toFixed(4)}, {lng.toFixed(4)}</p>
            <p className="text-xs text-green-600 mt-0.5">Ver en Maps →</p>
          </div>
        </a>
      )
    }

    if (msg.type === 'call') {
      const missed = msg.callDuration === -1 || msg.callDuration == null
      const Icon = missed ? PhoneMissed : PhoneCall
      return (
        <div className={`flex items-center gap-3 rounded-2xl px-4 py-3 max-w-[220px] ${isMe ? 'bg-[#DCF8C6]' : 'bg-white'}`}>
          <Icon size={18} className={missed ? 'text-red-500' : 'text-green-600'} />
          <div>
            <p className="text-sm font-medium text-gray-900">
              {missed ? 'Llamada perdida' : `Llamada${msg.callDuration ? ` · ${msg.callDuration}s` : ''}`}
            </p>
            <p className="text-xs text-gray-400">{isMe ? 'Saliente' : 'Entrante'}</p>
          </div>
        </div>
      )
    }

    return (
      <div className={`rounded-2xl px-3 py-2 max-w-[280px] sm:max-w-[340px] shadow-sm ${isMe ? 'bg-[#DCF8C6] rounded-tr-sm' : 'bg-white rounded-tl-sm'}`}>
        {msg.photos?.length > 0 && (
          <div className={`grid gap-1 mb-1.5 ${msg.photos.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
            {msg.photos.map((url, i) =>
              /\.(mp4|mov|webm|ogg)(\?|$)/i.test(url) ? (
                <video key={i} src={url} controls className="rounded-lg max-h-48 w-full" />
              ) : (
                <img key={i} src={url} alt="" className="rounded-lg object-cover max-h-48 w-full cursor-pointer"
                  onClick={() => window.open(url, '_blank')} />
              )
            )}
          </div>
        )}
        {msg.text && <p className="text-sm leading-relaxed text-gray-900 whitespace-pre-wrap">{msg.text}</p>}
        <p className="text-[10px] text-gray-400 text-right mt-1">{formatTime(msg.createdAt as Date)}</p>
      </div>
    )
  }

  return (
    <div className="relative flex flex-col h-[calc(100vh-200px)] min-h-[400px] overflow-hidden rounded-xl border border-gray-200">
      {/* Header estilo WA */}
      <div className="flex items-center justify-between px-4 py-3 bg-[#075E54]">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
            {initials}
          </div>
          <div>
            <p className="text-sm font-semibold text-white">{client.name}</p>
            <p className="text-xs text-white/70">
              {hasWhatsApp
                ? (client.whatsappPhone || 'WhatsApp conectado')
                : 'Sin WhatsApp vinculado'}
            </p>
          </div>
        </div>
        {hasWhatsApp && client.whatsappPhone && (
          <button onClick={handleCall}
            className="p-2 rounded-full hover:bg-white/10 transition-colors text-white"
            title="Llamar por WhatsApp">
            <Phone size={18} />
          </button>
        )}
      </div>

      {/* Área de mensajes con fondo WA */}
      <div
        className="flex-1 overflow-y-auto p-4 space-y-2"
        style={{ background: '#ECE5DD' }}
      >
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-3 py-12">
            <div className="w-16 h-16 rounded-full bg-[#075E54] flex items-center justify-center">
              <span className="text-white text-2xl font-bold">W</span>
            </div>
            <p className="text-sm text-gray-500">Sin mensajes aún</p>
          </div>
        )}
        {messages.map(msg => {
          const isMe = msg.source === 'internal'
          return (
            <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
              <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} gap-0.5`}>
                {!isMe && (
                  <span className="text-[10px] text-gray-500 px-1">{client.name}</span>
                )}
                {renderMessage(msg)}
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {/* Preview fotos pendientes */}
      {pendingPreviews.length > 0 && (
        <div className="px-3 py-2 flex gap-2 flex-wrap bg-white border-t border-gray-100">
          {pendingPreviews.map((src, i) => (
            <div key={i} className="relative w-14 h-14">
              <img src={src} alt="" className="w-full h-full object-cover rounded-lg border border-gray-200" />
              <button onClick={() => removePending(i)}
                className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5">
                <X size={10} />
              </button>
            </div>
          ))}
          <p className="w-full text-xs text-gray-400 mt-0.5">{pendingPreviews.length} foto{pendingPreviews.length > 1 ? 's' : ''} seleccionada{pendingPreviews.length > 1 ? 's' : ''}</p>
        </div>
      )}

      {/* Modal ubicación */}
      {showLocationModal && (
        <div className="absolute inset-0 bg-black/40 z-20 flex items-end justify-center p-4">
          <div className="bg-white rounded-2xl p-5 w-full max-w-sm space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Enviar ubicación</h3>
              <button onClick={() => setShowLocationModal(false)} className="text-gray-400 hover:text-gray-700"><X size={18} /></button>
            </div>
            <button onClick={handleGetGps} disabled={gettingGps}
              className="w-full flex items-center justify-center gap-2 py-2.5 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 transition-colors">
              {gettingGps ? <div className="w-4 h-4 border-2 border-gray-500 border-t-transparent rounded-full animate-spin" /> : <Navigation size={16} />}
              Usar mi ubicación GPS
            </button>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Latitud</label>
                <input value={locationInput.lat} onChange={e => setLocationInput(p => ({ ...p, lat: e.target.value }))}
                  placeholder="-12.0464" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-gray-400" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Longitud</label>
                <input value={locationInput.lng} onChange={e => setLocationInput(p => ({ ...p, lng: e.target.value }))}
                  placeholder="-77.0428" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-gray-400" />
              </div>
            </div>
            <input value={locationInput.name} onChange={e => setLocationInput(p => ({ ...p, name: e.target.value }))}
              placeholder="Nombre del lugar (opcional)"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-gray-400" />
            <button onClick={handleSendLocation} disabled={sending || !locationInput.lat || !locationInput.lng}
              className="w-full bg-[#075E54] hover:bg-[#064d45] disabled:opacity-50 text-white font-semibold py-2.5 rounded-lg text-sm transition-colors">
              {sending ? 'Enviando...' : 'Enviar ubicación'}
            </button>
          </div>
        </div>
      )}

      {/* Barra de input estilo WA */}
      <div className="bg-[#F0F2F5] px-3 py-2 flex items-end gap-2 relative border-t border-gray-200">
        {/* Templates */}
        <div className="relative">
          <button type="button" onClick={() => setShowTemplates(v => !v)}
            className="p-2 text-gray-500 hover:text-[#075E54] transition-colors rounded-full hover:bg-gray-200"
            title="Plantillas">
            <Zap size={20} />
          </button>
          {showTemplates && templates.length > 0 && (
            <div className="absolute bottom-12 left-0 w-72 bg-white border border-gray-200 rounded-xl shadow-xl z-10 overflow-hidden">
              <div className="px-4 py-2 border-b border-gray-100 flex items-center justify-between">
                <p className="text-xs font-semibold text-gray-600">Respuestas rápidas</p>
                <button onClick={() => setShowTemplates(false)}><X size={14} className="text-gray-400" /></button>
              </div>
              {templates.map(t => (
                <button key={t.id} type="button"
                  onClick={() => { setText(t.body); setShowTemplates(false) }}
                  className="w-full text-left px-4 py-3 hover:bg-gray-50 border-b border-gray-100 last:border-0">
                  <p className="text-xs font-semibold text-[#075E54]">/{t.name}</p>
                  <p className="text-xs text-gray-500 line-clamp-2 mt-0.5">{t.body}</p>
                </button>
              ))}
            </div>
          )}
          {showTemplates && templates.length === 0 && (
            <div className="absolute bottom-12 left-0 w-64 bg-white border border-gray-200 rounded-xl shadow-xl z-10 p-4">
              <p className="text-xs text-gray-500">Sin plantillas. Créalas en Configuración → Plantillas.</p>
            </div>
          )}
        </div>

        {/* Adjuntar */}
        <button type="button" onClick={() => fileInputRef.current?.click()}
          className="p-2 text-gray-500 hover:text-[#075E54] transition-colors rounded-full hover:bg-gray-200"
          title="Adjuntar fotos">
          <Paperclip size={20} />
        </button>
        <input ref={fileInputRef} type="file" multiple accept="image/*,video/*"
          className="hidden" onChange={e => handleFiles(e.target.files)} />

        {/* Ubicación */}
        <button type="button" onClick={() => setShowLocationModal(true)}
          className="p-2 text-gray-500 hover:text-[#075E54] transition-colors rounded-full hover:bg-gray-200"
          title="Enviar ubicación">
          <MapPin size={20} />
        </button>

        {/* Textarea */}
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
          rows={1}
          placeholder="Escribe un mensaje"
          className="flex-1 bg-white border-0 rounded-full px-4 py-2.5 text-sm text-gray-900 focus:outline-none resize-none shadow-sm"
          style={{ maxHeight: '100px', overflowY: 'auto' }}
        />

        {/* Enviar */}
        <button onClick={handleSend}
          disabled={sending || (!text.trim() && pendingFiles.length === 0)}
          className="p-2.5 bg-[#075E54] hover:bg-[#064d45] disabled:opacity-40 text-white rounded-full transition-colors flex-shrink-0 shadow-sm">
          {sending
            ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            : <Send size={16} />}
        </button>
      </div>
    </div>
  )
}
