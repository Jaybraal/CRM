'use client'

import { useEffect, useRef, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { subscribeToMessages, sendMessage, getWhatsAppTemplates } from '@/lib/firestore'
import { uploadMultiplePhotos } from '@/lib/storage'
import type { Client, Message, WhatsAppTemplate } from '@/types'
import { Send, Paperclip, X, MessageCircle, Zap } from 'lucide-react'
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
        text: text.trim() || undefined,
        photos: photoUrls,
        senderId: profile.uid,
        senderName: profile.displayName,
        source: 'internal',
      })

      if (hasWhatsApp && client.whatsappPhone) {
        const waRes = await fetch('/api/whatsapp/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orgId: profile.orgId,
            to: client.whatsappPhone,
            text: text.trim(),
            photoUrls,
          }),
        })
        if (!waRes.ok) {
          toast.error('Mensaje guardado pero no se pudo enviar por WhatsApp', { duration: 4000 })
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

  const formatTime = (date: Date | { seconds: number } | undefined) => {
    if (!date) return ''
    const d = date instanceof Date ? date : new Date((date as { seconds: number }).seconds * 1000)
    return d.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="flex flex-col h-[calc(100vh-220px)] min-h-[400px] bg-white border border-gray-200 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 bg-gray-50">
        <MessageCircle size={18} className="text-gray-500" />
        <div>
          <p className="text-sm font-semibold text-gray-900">{client.name}</p>
          {client.whatsappPhone ? (
            <p className="text-xs text-gray-500">
              WhatsApp: {client.whatsappPhone}
              {hasWhatsApp
                ? <span className="ml-2 text-green-600 font-medium">● Conectado</span>
                : <span className="ml-2 text-gray-400">● Sin conexión WhatsApp</span>
              }
            </p>
          ) : (
            <p className="text-xs text-gray-400">Sin número WhatsApp vinculado</p>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <div className="flex items-center justify-center h-full">
            <p className="text-sm text-gray-400">Sin mensajes. Sé el primero en escribir.</p>
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
                <div className={`rounded-2xl px-4 py-2.5 ${isInternal ? 'bg-gray-900 text-white rounded-tr-sm' : 'bg-gray-100 text-gray-900 rounded-tl-sm'}`}>
                  {msg.photos?.length > 0 && (
                    <div className={`grid gap-1.5 mb-2 ${msg.photos.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
                      {msg.photos.map((url, i) => (
                        <img
                          key={i}
                          src={url}
                          alt=""
                          className="rounded-lg object-cover max-h-48 w-full cursor-pointer"
                          onClick={() => window.open(url, '_blank')}
                        />
                      ))}
                    </div>
                  )}
                  {msg.text && <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.text}</p>}
                </div>
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

      {/* Input */}
      <div className="p-3 border-t border-gray-100 flex items-end gap-2">
        {/* Plantillas */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowTemplates(v => !v)}
            className="p-2.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0"
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
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="p-2.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0"
        >
          <Paperclip size={18} />
        </button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*"
          className="hidden"
          onChange={e => handleFiles(e.target.files)}
        />
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
