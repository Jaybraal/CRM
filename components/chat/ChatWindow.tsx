'use client'

import { useEffect, useRef, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { subscribeToMessages, sendMessage, getWhatsAppTemplates } from '@/lib/firestore'
import { uploadMultiplePhotos } from '@/lib/storage'
import type { Client, Message, WhatsAppTemplate } from '@/types'
import { Send, Paperclip, X, MapPin, Phone, PhoneCall, PhoneMissed, Navigation, Plus } from 'lucide-react'
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
  const [templateQuery, setTemplateQuery] = useState('')
  const [showTemplates, setShowTemplates] = useState(false)
  const [showActions, setShowActions] = useState(false)
  const [showLocationModal, setShowLocationModal] = useState(false)
  const [locationName, setLocationName] = useState('')
  const [locationCoords, setLocationCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [gettingGps, setGettingGps] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (!profile?.orgId) return
    const unsub = subscribeToMessages(profile.orgId, client.id, setMessages)
    getWhatsAppTemplates(profile.orgId).then(setTemplates)
    return unsub
  }, [profile?.orgId, client.id])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = Math.min(ta.scrollHeight, 120) + 'px'
  }, [text])

  const filteredTemplates = templates.filter(t =>
    templateQuery === '' || t.name.toLowerCase().includes(templateQuery.toLowerCase())
  )

  const handleTextChange = (val: string) => {
    setText(val)
    // Detect "/" at start of message or after space to trigger templates
    const slashMatch = val.match(/(^|\s)\/(\S*)$/)
    if (slashMatch) {
      setTemplateQuery(slashMatch[2])
      setShowTemplates(true)
    } else {
      setShowTemplates(false)
      setTemplateQuery('')
    }
  }

  const applyTemplate = (t: WhatsAppTemplate) => {
    // Replace the /query part with the template body
    const newText = text.replace(/(^|\s)\/\S*$/, (match) => {
      const prefix = match.startsWith('/') ? '' : match.charAt(0)
      return prefix + t.body
    })
    setText(newText || t.body)
    setShowTemplates(false)
    setTemplateQuery('')
    textareaRef.current?.focus()
  }

  const handleFiles = (files: FileList | null) => {
    if (!files) return
    const arr = Array.from(files)
    setPendingFiles(prev => [...prev, ...arr])
    arr.forEach(f => {
      const reader = new FileReader()
      reader.onload = e => setPendingPreviews(prev => [...prev, e.target?.result as string])
      reader.readAsDataURL(f)
    })
    setShowActions(false)
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

      const msgId = await sendMessage(profile.orgId, client.id, {
        type: photoUrls.length > 0 ? 'image' : 'text',
        text: text.trim() || undefined,
        photos: photoUrls,
        senderId: profile.uid,
        senderName: profile.displayName,
        source: 'internal',
        status: 'sending',
      })

      if (hasWhatsApp && client.whatsappPhone) {
        const jid = client.whatsappJid || client.whatsappPhone
        await Promise.all(photoUrls.map(url =>
          fetch('/api/whatsapp/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ orgId: profile.orgId, to: jid, photoUrls: [url], type: 'image' }),
          })
        ))
        if (text.trim()) {
          const waRes = await fetch('/api/whatsapp/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ orgId: profile.orgId, to: jid, text: text.trim(), type: 'text' }),
          })
          if (!waRes.ok) {
            toast.error('Mensaje guardado pero falló en WhatsApp', { duration: 4000 })
          } else {
            // Guardar el msgId de Baileys en el mensaje de Firestore para rastrear ticks
            const waData = await waRes.json().catch(() => ({}))
            if (waData.msgId && msgId) {
              const { updateDoc, doc } = await import('firebase/firestore')
              const { db } = await import('@/lib/firebase')
              await updateDoc(
                doc(db, `organizations/${profile.orgId}/clients/${client.id}/messages/${msgId}`),
                { whatsappMsgId: waData.msgId, status: 'sent' }
              )
            }
          }
        }
      }

      setText('')
      setPendingFiles([])
      setPendingPreviews([])
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('handleSend error:', msg)
      toast.error(msg, { duration: 8000 })
    } finally {
      setSending(false)
    }
  }

  const handleGetGps = () => {
    if (!navigator.geolocation) { toast.error('GPS no disponible en este dispositivo'); return }
    setGettingGps(true)
    navigator.geolocation.getCurrentPosition(
      pos => {
        setLocationCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        setGettingGps(false)
        toast.success('Ubicación obtenida')
      },
      () => { toast.error('No se pudo obtener ubicación'); setGettingGps(false) }
    )
  }

  const handleSendLocation = async () => {
    if (!locationCoords) { toast.error('Usa el botón GPS primero'); return }
    if (!profile?.orgId) return
    setSending(true)
    try {
      const { lat, lng } = locationCoords
      await sendMessage(profile.orgId, client.id, {
        type: 'location',
        text: '📍 Ubicación compartida',
        photos: [],
        location: { lat, lng, name: locationName },
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
            location: { lat, lng, name: locationName },
          }),
        })
      }
      setShowLocationModal(false)
      setLocationName('')
      setLocationCoords(null)
    } catch {
      toast.error('Error al enviar ubicación')
    } finally {
      setSending(false)
    }
  }

  const handleCall = async () => {
    if (!profile?.orgId) return

    // Si es contacto LID (número interno de WA), no se puede llamar via wa.me
    if (client.isLid && !client.phone) {
      toast('Para llamar a este contacto, abre WhatsApp en tu teléfono y llama desde el chat directamente.\n\nEste contacto usa privacidad de número (LID).', {
        duration: 6000,
        icon: '📱',
      })
      return
    }

    const callNumber = (client.phone || client.whatsappPhone)?.replace(/\D/g, '')
    if (!callNumber) { toast.error('Sin número de WhatsApp para llamar'); return }
    window.open(`https://wa.me/${callNumber}`, '_blank')
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

  const MessageTicks = ({ status }: { status?: string }) => {
    if (!status || status === 'sending') {
      return <span className="text-[10px] text-gray-400 ml-0.5">⏱</span>
    }
    if (status === 'sent') {
      return <span className="text-[10px] text-gray-400 ml-0.5">✓</span>
    }
    if (status === 'delivered') {
      return <span className="text-[10px] text-gray-400 ml-0.5">✓✓</span>
    }
    if (status === 'read') {
      return <span className="text-[10px] text-blue-500 ml-0.5">✓✓</span>
    }
    return null
  }

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
      <div className={`rounded-2xl px-3 py-2 max-w-[75vw] sm:max-w-[340px] shadow-sm ${isMe ? 'bg-[#DCF8C6] rounded-tr-sm' : 'bg-white rounded-tl-sm'}`}>
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
        <div className="flex items-center justify-end gap-0.5 mt-1">
          <span className="text-[10px] text-gray-400">{formatTime(msg.createdAt as Date)}</span>
          {isMe && <MessageTicks status={msg.status} />}
        </div>
      </div>
    )
  }

  return (
    <div className="relative flex flex-col h-[calc(100dvh-130px)] sm:h-[calc(100vh-200px)] min-h-[400px] overflow-hidden rounded-xl border border-gray-200">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-[#075E54] flex-shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
            {initials}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white truncate">{client.name}</p>
            <p className="text-xs text-white/70 truncate">
              {hasWhatsApp
                ? (client.phone || client.whatsappPhone
                    ? `+${(client.phone || client.whatsappPhone)!.replace(/\D/g, '')}`
                    : 'WhatsApp conectado')
                : 'Sin WhatsApp vinculado'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {hasWhatsApp && (client.phone || client.whatsappPhone) && (
            <button onClick={handleCall}
              className="p-2 rounded-full hover:bg-white/10 transition-colors text-white"
              title="Llamar por WhatsApp">
              <Phone size={18} />
            </button>
          )}
        </div>
      </div>

      {/* Hint plantillas */}
      {templates.length > 0 && (
        <div className="bg-[#075E54]/10 px-4 py-1.5 flex items-center gap-2 flex-shrink-0 border-b border-[#075E54]/10">
          <span className="text-[11px] text-[#075E54] font-medium">Escribe <kbd className="bg-white/80 border border-[#075E54]/20 rounded px-1 font-mono">/</kbd> para respuestas rápidas</span>
        </div>
      )}

      {/* Mensajes */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2" style={{ background: '#ECE5DD' }}>
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-3 py-12">
            <div className="w-16 h-16 rounded-full bg-[#075E54] flex items-center justify-center">
              <span className="text-white text-2xl font-bold">W</span>
            </div>
            <p className="text-sm text-gray-500">Sin mensajes aún</p>
            {templates.length > 0 && (
              <p className="text-xs text-gray-400">Escribe <span className="font-mono font-bold">/</span> para ver plantillas</p>
            )}
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
        <div className="px-3 py-2 flex gap-2 flex-wrap bg-white border-t border-gray-100 flex-shrink-0">
          {pendingPreviews.map((src, i) => (
            <div key={i} className="relative w-14 h-14">
              <img src={src} alt="" className="w-full h-full object-cover rounded-lg border border-gray-200" />
              <button onClick={() => removePending(i)}
                className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5">
                <X size={10} />
              </button>
            </div>
          ))}
          <p className="w-full text-xs text-gray-400 mt-0.5">{pendingPreviews.length} foto{pendingPreviews.length > 1 ? 's' : ''}</p>
        </div>
      )}

      {/* Popup plantillas (activado por "/") */}
      {showTemplates && (
        <div className="absolute bottom-[72px] left-0 right-0 mx-3 bg-white border border-gray-200 rounded-2xl shadow-2xl z-20 overflow-hidden max-h-56 flex flex-col">
          <div className="px-4 py-2.5 border-b border-gray-100 flex items-center justify-between bg-gray-50">
            <p className="text-xs font-semibold text-gray-600">
              Respuestas rápidas{templateQuery ? ` · "${templateQuery}"` : ''}
            </p>
            <button onClick={() => { setShowTemplates(false); setTemplateQuery('') }}>
              <X size={14} className="text-gray-400" />
            </button>
          </div>
          <div className="overflow-y-auto">
            {filteredTemplates.length === 0 ? (
              <p className="text-xs text-gray-400 px-4 py-3">Sin resultados para &ldquo;{templateQuery}&rdquo;</p>
            ) : (
              filteredTemplates.map(t => (
                <button key={t.id} type="button"
                  onClick={() => applyTemplate(t)}
                  className="w-full text-left px-4 py-3 hover:bg-[#075E54]/5 active:bg-[#075E54]/10 border-b border-gray-100 last:border-0 transition-colors">
                  <p className="text-sm font-semibold text-[#075E54]">/{t.name}</p>
                  <p className="text-xs text-gray-500 line-clamp-2 mt-0.5">{t.body}</p>
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {/* Modal ubicación */}
      {showLocationModal && (
        <div className="absolute inset-0 bg-black/40 z-20 flex items-end justify-center p-4">
          <div className="bg-white rounded-2xl p-5 w-full max-w-sm space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Enviar ubicación</h3>
              <button onClick={() => { setShowLocationModal(false); setLocationCoords(null); setLocationName('') }}
                className="text-gray-400 hover:text-gray-700"><X size={18} /></button>
            </div>

            {/* Paso 1: obtener GPS */}
            <button onClick={handleGetGps} disabled={gettingGps}
              className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium transition-colors ${
                locationCoords
                  ? 'bg-green-50 border border-green-200 text-green-700'
                  : 'bg-[#075E54] text-white hover:bg-[#064d45]'
              }`}>
              {gettingGps
                ? <><div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" /> Obteniendo ubicación...</>
                : locationCoords
                  ? <><Navigation size={16} /> ✓ Ubicación obtenida — toca para actualizar</>
                  : <><Navigation size={16} /> Usar mi ubicación GPS</>
              }
            </button>

            {locationCoords && (
              <p className="text-xs text-gray-500 text-center -mt-2">
                {locationCoords.lat.toFixed(5)}, {locationCoords.lng.toFixed(5)}
              </p>
            )}

            {/* Paso 2: nombre opcional */}
            <input
              value={locationName}
              onChange={e => setLocationName(e.target.value)}
              placeholder="Nombre del lugar (opcional, ej: Oficina central)"
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none focus:border-[#075E54]"
            />

            <button onClick={handleSendLocation} disabled={sending || !locationCoords}
              className="w-full bg-[#075E54] hover:bg-[#064d45] disabled:opacity-40 text-white font-semibold py-3 rounded-xl text-sm transition-colors">
              {sending ? 'Enviando...' : 'Enviar ubicación'}
            </button>
          </div>
        </div>
      )}

      {/* Menú acciones (adjuntar/ubicación) */}
      {showActions && (
        <div className="absolute bottom-[72px] left-3 bg-white rounded-2xl shadow-xl border border-gray-200 z-10 overflow-hidden">
          <button type="button" onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-3 w-full px-5 py-3.5 hover:bg-gray-50 active:bg-gray-100 transition-colors text-sm text-gray-700">
            <Paperclip size={18} className="text-[#075E54]" />
            Adjuntar fotos
          </button>
          <button type="button" onClick={() => { setShowLocationModal(true); setShowActions(false) }}
            className="flex items-center gap-3 w-full px-5 py-3.5 hover:bg-gray-50 active:bg-gray-100 transition-colors text-sm text-gray-700 border-t border-gray-100">
            <MapPin size={18} className="text-[#075E54]" />
            Enviar ubicación
          </button>
        </div>
      )}

      {/* Barra de input */}
      <div className="bg-[#F0F2F5] px-2 py-2 flex items-end gap-2 border-t border-gray-200 flex-shrink-0">
        <input ref={fileInputRef} type="file" multiple accept="image/*,video/*"
          className="hidden" onChange={e => handleFiles(e.target.files)} />

        {/* Botón + para acciones */}
        <button type="button"
          onClick={() => setShowActions(v => !v)}
          className={`p-2.5 rounded-full transition-colors flex-shrink-0 ${showActions ? 'bg-[#075E54] text-white' : 'text-gray-500 hover:bg-gray-200'}`}
          title="Más opciones">
          <Plus size={20} className={showActions ? 'rotate-45 transition-transform' : 'transition-transform'} />
        </button>

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={text}
          onChange={e => handleTextChange(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Escape') { setShowTemplates(false); setShowActions(false) }
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
          }}
          rows={1}
          placeholder="Escribe un mensaje"
          className="flex-1 bg-white border-0 rounded-2xl px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none resize-none shadow-sm"
          style={{ maxHeight: '120px', overflowY: 'auto' }}
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
