'use client'

import { useEffect, useRef, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { subscribeToMessages, sendMessage, getWhatsAppTemplates, getClients } from '@/lib/firestore'
import { uploadMultiplePhotos, uploadPhoto, uploadBlob } from '@/lib/storage'
import type { Client, Message, WhatsAppTemplate } from '@/types'
import { Send, Paperclip, X, MapPin, Phone, PhoneCall, PhoneMissed, Navigation, Plus, Mic, Square, Play, Pause, FileText, Download, Forward, StickyNote, Search, Printer, Reply, ChevronDown, ShoppingBag } from 'lucide-react'
import { getCatalog } from '@/lib/firestore'
import type { CatalogItem } from '@/types'
import type { Client as ClientType } from '@/types'
import toast from 'react-hot-toast'
import { updateDoc, doc } from 'firebase/firestore'
import { db } from '@/lib/firebase'

interface Props {
  client: Client
  hasWhatsApp: boolean
  fitParent?: boolean
  channel?: 'whatsapp' | 'instagram'
}

export default function ChatWindow({ client, hasWhatsApp, fitParent, channel = 'whatsapp' }: Props) {
  const isInstagram = channel === 'instagram'
  const { profile } = useAuth()
  const [messages, setMessages] = useState<Message[]>([])
  const [text, setText] = useState('')
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const [pendingPreviews, setPendingPreviews] = useState<{ src: string; isVideo: boolean }[]>([])
  const [sending, setSending] = useState(false)
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>([])
  const [templateQuery, setTemplateQuery] = useState('')
  const [showTemplates, setShowTemplates] = useState(false)
  const [showActions, setShowActions] = useState(false)
  const [showLocationModal, setShowLocationModal] = useState(false)
  const [forwardMsg, setForwardMsg] = useState<Message | null>(null)
  const [forwardSearch, setForwardSearch] = useState('')
  const [allClients, setAllClients] = useState<ClientType[]>([])
  const [locationName, setLocationName] = useState('')
  const [locationCoords, setLocationCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [gettingGps, setGettingGps] = useState(false)
  const [listenerError, setListenerError] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [showSearch, setShowSearch] = useState(false)
  const [replyToMsg, setReplyToMsg] = useState<Message | null>(null)
  const [noteMode, setNoteMode] = useState(false)
  const [showCatalog, setShowCatalog] = useState(false)
  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>([])
  const [catalogSearch, setCatalogSearch] = useState('')

  // Voice recording
  const [isRecording, setIsRecording] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [playingAudio, setPlayingAudio] = useState(false)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const recordTimerRef = useRef<NodeJS.Timeout | null>(null)
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null)

  const bottomRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (!profile?.orgId) return
    let unsub: (() => void) | null = null
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null

    const orgId = profile.orgId
    const subscribe = () => {
      unsub = subscribeToMessages(
        orgId,
        client.id,
        (msgs) => {
          setMessages(msgs)
          setListenerError(false)
          if (msgs.length > 0) {
            updateDoc(doc(db, `organizations/${orgId}/clients/${client.id}`), { unreadCount: 0 }).catch(() => {})
          }
        },
        (error) => {
          setListenerError(true)
          console.error('[Chat] Listener caído, reconectando en 5s...', (error as { code?: string }).code ?? error.message)
          reconnectTimer = setTimeout(() => {
            if (unsub) unsub()
            subscribe()
          }, 5000)
        }
      )
    }

    subscribe()
    getWhatsAppTemplates(profile.orgId).then(setTemplates)
    getClients(profile.orgId).then(setAllClients)

    return () => {
      if (unsub) unsub()
      if (reconnectTimer) clearTimeout(reconnectTimer)
    }
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

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl)
      if (recordTimerRef.current) clearInterval(recordTimerRef.current)
    }
  }, [])

  const filteredTemplates = templates.filter(t =>
    templateQuery === '' || t.name.toLowerCase().includes(templateQuery.toLowerCase())
  )

  const displayMessages = searchQuery
    ? messages.filter(m => m.text?.toLowerCase().includes(searchQuery.toLowerCase()))
    : messages

  const exportToPDF = () => {
    const getTime = (v: unknown) => {
      if (!v) return ''
      const d = v instanceof Date ? v : new Date((v as { seconds: number }).seconds * 1000)
      return d.toLocaleString('es', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
    }
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Chat - ${client.name}</title>
<style>body{font-family:sans-serif;max-width:700px;margin:0 auto;padding:20px;color:#111}
h1{font-size:16px;color:#075E54}p.sub{color:#888;font-size:11px}hr{border:none;border-top:1px solid #eee;margin:12px 0}
.wrap{display:flex;margin:4px 0}.wrap.me{justify-content:flex-end}
.msg{padding:8px 12px;border-radius:12px;max-width:65%;font-size:13px}
.me .msg{background:#DCF8C6}.them .msg{background:#f0f0f0}
.note .msg{background:#FFF9C4;border-left:3px solid #F59E0B;font-style:italic}
.lbl{font-size:10px;color:#888;margin-bottom:2px}.time{font-size:10px;color:#aaa;margin-top:3px;text-align:right}
@media print{body{padding:10px}}</style></head><body>
<h1>Chat con ${client.name}</h1>
<p class="sub">Exportado ${new Date().toLocaleString('es')}</p><hr/>
${messages.map(m => {
  const isMe = m.source === 'internal'
  const isNote = m.isNote
  const cls = isNote ? 'note' : isMe ? 'me' : ''
  const label = isNote ? '📝 Nota interna' : isMe ? m.senderName : client.name
  const content = m.type === 'image' ? '[📷 Imagen]' : m.type === 'video' ? '[🎥 Video]' : m.type === 'audio' ? '[🎤 Audio]' : m.type === 'location' ? '[📍 Ubicación]' : (m.text || '')
  return `<div class="wrap ${cls}"><div><div class="lbl">${label}</div><div class="msg">${content.replace(/</g, '&lt;')}<div class="time">${getTime(m.createdAt)}</div></div></div></div>`
}).join('')}</body></html>`
    const w = window.open('', '_blank')
    if (w) { w.document.write(html); w.document.close(); setTimeout(() => w.print(), 300) }
  }

  const handleTextChange = (val: string) => {
    setText(val)
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
      const isVideo = f.type.startsWith('video/')
      if (isVideo) {
        const src = URL.createObjectURL(f)
        setPendingPreviews(prev => [...prev, { src, isVideo: true }])
      } else {
        const reader = new FileReader()
        reader.onload = e => setPendingPreviews(prev => [...prev, { src: e.target?.result as string, isVideo: false }])
        reader.readAsDataURL(f)
      }
    })
    setShowActions(false)
  }

  const removePending = (idx: number) => {
    setPendingFiles(prev => prev.filter((_, i) => i !== idx))
    setPendingPreviews(prev => {
      const p = prev[idx]
      if (p?.isVideo) URL.revokeObjectURL(p.src)
      return prev.filter((_, i) => i !== idx)
    })
  }

  // --- Voice recording ---
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })

      // Detectar el mejor formato soportado (iOS usa audio/mp4, Android/Chrome usa audio/webm)
      const preferredTypes = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/ogg;codecs=opus',
        'audio/mp4',
        'audio/aac',
      ]
      const mimeType = preferredTypes.find(t => {
        try { return MediaRecorder.isTypeSupported(t) } catch { return false }
      }) || ''

      const mediaRecorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream)
      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data)
      }

      mediaRecorder.onstop = () => {
        const actualMime = mediaRecorder.mimeType || mimeType || 'audio/webm'
        const blob = new Blob(audioChunksRef.current, { type: actualMime })
        setAudioBlob(blob)
        const url = URL.createObjectURL(blob)
        setAudioUrl(url)
        stream.getTracks().forEach(t => t.stop())
      }

      mediaRecorder.start()
      setIsRecording(true)
      setRecordingTime(0)
      recordTimerRef.current = setInterval(() => setRecordingTime(t => t + 1), 1000)
    } catch {
      toast.error('No se pudo acceder al micrófono')
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
    }
    setIsRecording(false)
    if (recordTimerRef.current) {
      clearInterval(recordTimerRef.current)
      recordTimerRef.current = null
    }
  }

  const cancelRecording = () => {
    stopRecording()
    setAudioBlob(null)
    if (audioUrl) URL.revokeObjectURL(audioUrl)
    setAudioUrl(null)
    setRecordingTime(0)
  }

  const togglePlayback = () => {
    if (!audioUrl) return
    if (!audioPlayerRef.current) {
      audioPlayerRef.current = new Audio(audioUrl)
      audioPlayerRef.current.onended = () => setPlayingAudio(false)
    }
    if (playingAudio) {
      audioPlayerRef.current.pause()
      setPlayingAudio(false)
    } else {
      audioPlayerRef.current.play()
      setPlayingAudio(true)
    }
  }

  const sendVoiceNote = async () => {
    if (!audioBlob || !profile?.orgId) return
    setSending(true)
    try {
      const audioFileUrl = await uploadBlob(profile.orgId, `chat/${client.id}`, audioBlob, audioBlob.type || 'audio/webm')

      const msgId = await sendMessage(profile.orgId, client.id, {
        type: 'audio',
        text: '🎤 Nota de voz',
        photos: [audioFileUrl],
        senderId: profile.uid,
        senderName: profile.displayName ?? '',
        source: 'internal',
        status: 'sending',
      })

      if (hasWhatsApp && client.whatsappPhone) {
        const jid = client.whatsappJid || client.whatsappPhone
        const msgRef = msgId ? doc(db, `organizations/${profile.orgId}/clients/${client.id}/messages/${msgId}`) : null
        const waRes = await fetch('/api/whatsapp/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orgId: profile.orgId, to: jid, audioUrl: audioFileUrl, type: 'audio' }),
        })
        if (waRes.ok) {
          const waData = await waRes.json().catch(() => ({}))
          if (waData.msgId && msgRef) {
            await updateDoc(msgRef, { whatsappMsgId: waData.msgId, status: 'sent' })
          }
        } else {
          if (msgRef) await updateDoc(msgRef, { status: 'sent' })
          toast.error('Audio guardado pero falló en WhatsApp', { duration: 4000 })
        }
      }

      cancelRecording()
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      toast.error(msg, { duration: 8000 })
    } finally {
      setSending(false)
    }
  }

  const formatRecordTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

  const openCatalog = async () => {
    setShowActions(false)
    if (catalogItems.length === 0 && profile?.orgId) {
      const items = await getCatalog(profile.orgId).catch(() => [])
      setCatalogItems(items.filter(i => i.available))
    }
    setCatalogSearch('')
    setShowCatalog(true)
  }

  const sendCatalogItem = async (item: CatalogItem) => {
    if (!profile?.orgId) return
    setShowCatalog(false)
    setSending(true)
    try {
      const caption = `*${item.title}*${item.price != null ? `\n💰 $${item.price.toLocaleString('es')}` : ''}${item.description ? `\n${item.description}` : ''}`
      const photoUrl = item.photos[0] || null

      await sendMessage(profile.orgId, client.id, {
        type: photoUrl ? 'image' : 'text',
        text: caption,
        photos: photoUrl ? [photoUrl] : [],
        senderId: profile.uid,
        senderName: profile.displayName ?? '',
        source: 'internal',
        status: 'sending',
      })

      if (!isInstagram && hasWhatsApp && client.whatsappPhone) {
        const jid = client.whatsappJid || client.whatsappPhone
        if (photoUrl) {
          await fetch('/api/whatsapp/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ orgId: profile.orgId, to: jid, photoUrls: [photoUrl], type: 'image' }),
          })
        }
        if (caption) {
          await fetch('/api/whatsapp/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ orgId: profile.orgId, to: jid, text: caption, type: 'text' }),
          })
        }
      } else if (isInstagram && client.instagramId) {
        if (photoUrl) {
          await fetch('/api/instagram/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ orgId: profile.orgId, recipientId: client.instagramId, imageUrl: photoUrl }),
          })
        }
        await fetch('/api/instagram/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orgId: profile.orgId, recipientId: client.instagramId, text: caption }),
        })
      }
    } catch { toast.error('Error al enviar producto') }
    setSending(false)
  }

  const handleSend = async () => {
    if (!text.trim() && pendingFiles.length === 0) return
    if (!profile?.orgId) return
    setSending(true)
    try {
      let photoUrls: string[] = []
      const hasVideos = pendingFiles.some(f => f.type.startsWith('video/'))

      if (pendingFiles.length > 0) {
        photoUrls = await uploadMultiplePhotos(profile.orgId, `chat/${client.id}`, pendingFiles)
      }

      const msgType = hasVideos ? 'video' : photoUrls.length > 0 ? 'image' : 'text'

      const msgPayload: Parameters<typeof sendMessage>[2] = {
        type: msgType,
        text: text.trim() || '',
        photos: photoUrls,
        senderId: profile.uid,
        senderName: profile.displayName ?? '',
        source: 'internal',
        status: 'sending',
      }
      if (noteMode) msgPayload.isNote = true
      if (replyToMsg) msgPayload.replyTo = { id: replyToMsg.id, text: replyToMsg.text, senderName: replyToMsg.senderName, type: replyToMsg.type }

      const msgId = await sendMessage(profile.orgId, client.id, msgPayload)

      const msgRef = msgId ? doc(db, `organizations/${profile.orgId}/clients/${client.id}/messages/${msgId}`) : null

      if (!noteMode && isInstagram && client.instagramId) {
        // Enviar por Instagram
        if (photoUrls.length > 0) {
          for (const url of photoUrls) {
            await fetch('/api/instagram/send', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ orgId: profile.orgId, recipientId: client.instagramId, imageUrl: url }),
            })
          }
        }
        if (text.trim()) {
          const igRes = await fetch('/api/instagram/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ orgId: profile.orgId, recipientId: client.instagramId, text: text.trim() }),
          })
          if (!igRes.ok) {
            const igErr = await igRes.json().catch(() => ({}))
            toast.error(igErr.error || 'Falló el envío por Instagram', { duration: 6000 })
          } else {
            const igData = await igRes.json().catch(() => ({}))
            if (igData.msgId && msgRef) {
              await updateDoc(msgRef, { instagramMsgId: igData.msgId, status: 'sent' })
            }
          }
        }
      } else if (!noteMode && hasWhatsApp && client.whatsappPhone) {
        const jid = client.whatsappJid || client.whatsappPhone

        // Send files (images and videos)
        if (photoUrls.length > 0) {
          let lastMsgId: string | null = null
          for (let i = 0; i < photoUrls.length; i++) {
            const url = photoUrls[i]
            const isVideo = pendingFiles[i]?.type?.startsWith('video/')
            const res = await fetch('/api/whatsapp/send', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                orgId: profile.orgId,
                to: jid,
                photoUrls: isVideo ? undefined : [url],
                videoUrl: isVideo ? url : undefined,
                type: isVideo ? 'video' : 'image',
              }),
            })
            const data = await res.json().catch(() => ({}))
            if (data.msgId) lastMsgId = data.msgId
          }
          if (lastMsgId && msgRef) {
            await updateDoc(msgRef, { whatsappMsgId: lastMsgId, status: 'sent' })
          }
        }

        // Send text
        if (text.trim()) {
          const waRes = await fetch('/api/whatsapp/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ orgId: profile.orgId, to: jid, text: text.trim(), type: 'text' }),
          })
          if (!waRes.ok) {
            const waErr = await waRes.json().catch(() => ({}))
            toast.error(waErr.error || 'Falló el envío por WhatsApp', { duration: 6000 })
          } else {
            const waData = await waRes.json().catch(() => ({}))
            if (waData.msgId && msgRef && photoUrls.length === 0) {
              await updateDoc(msgRef, { whatsappMsgId: waData.msgId, status: 'sent' })
            }
          }
        }

        // If no WA response updated status, mark as sent anyway
        if (msgRef && photoUrls.length === 0 && !text.trim()) {
          await updateDoc(msgRef, { status: 'sent' }).catch(() => {})
        }
      } else {
        // No WhatsApp — mark as sent immediately (internal message)
        if (msgRef) await updateDoc(msgRef, { status: 'sent' }).catch(() => {})
      }

      setText('')
      if (textareaRef.current) {
        textareaRef.current.value = ''
        textareaRef.current.style.height = 'auto'
      }
      setPendingFiles([])
      setPendingPreviews(prev => {
        prev.forEach(p => { if (p.isVideo) URL.revokeObjectURL(p.src) })
        return []
      })
      setNoteMode(false)
      setReplyToMsg(null)
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
      () => { toast.error('No se pudo obtener ubicación'); setGettingGps(false) },
      { timeout: 10000, maximumAge: 60000 }
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
        senderName: profile.displayName ?? '',
        source: 'internal',
      })
      const waTarget = client.whatsappJid || client.whatsappPhone
      if (hasWhatsApp && waTarget) {
        await fetch('/api/whatsapp/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orgId: profile.orgId,
            to: waTarget,
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
    if (client.isLid && !client.phone) {
      toast('Para llamar a este contacto, abre WhatsApp en tu teléfono y llama desde el chat directamente.\n\nEste contacto usa privacidad de número (LID).', {
        duration: 5000,
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
        senderName: profile.displayName ?? '',
        source: 'internal',
      })
    } catch { /* ignore */ }
  }

  const handleForward = async (targetClient: ClientType) => {
    if (!forwardMsg || !profile?.orgId) return
    try {
      await sendMessage(profile.orgId, targetClient.id, {
        type: forwardMsg.type || 'text',
        text: forwardMsg.text,
        photos: forwardMsg.photos || [],
        location: forwardMsg.location,
        senderId: profile.uid,
        senderName: profile.displayName ?? '',
        source: 'internal',
        status: 'sent',
      })
      toast.success(`Reenviado a ${targetClient.name}`)
      setForwardMsg(null)
      setForwardSearch('')
    } catch { toast.error('Error al reenviar') }
  }

  const formatTime = (date: Date | { seconds: number } | undefined) => {
    if (!date) return ''
    const d = date instanceof Date ? date : new Date((date as { seconds: number }).seconds * 1000)
    return d.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })
  }

  const initials = client.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()

  const MessageTicks = ({ status }: { status?: string }) => {
    if (!status || status === 'sending') {
      return <span className="text-[10px] text-gray-400 ml-0.5 animate-pulse">●</span>
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

  const isAudioUrl = (url: string) => /\.(webm|ogg|mp3|m4a|aac|wav|opus)(\?|$)/i.test(url)

  const renderMessage = (msg: Message) => {
    const isMe = msg.source === 'internal'

    // Nota interna
    if (msg.isNote) {
      return (
        <div className="rounded-xl px-3 py-2 max-w-[75vw] sm:max-w-[340px] bg-amber-50 border border-amber-200 shadow-sm">
          <div className="flex items-center gap-1 mb-1">
            <StickyNote size={11} className="text-amber-500" />
            <span className="text-[10px] text-amber-600 font-semibold">Nota interna · {msg.senderName}</span>
          </div>
          <p className="text-sm text-gray-800 whitespace-pre-wrap">{msg.text}</p>
          <span className="text-[10px] text-gray-400 block text-right mt-1">{formatTime(msg.createdAt as Date)}</span>
        </div>
      )
    }

    // Bloque de reply (cita) que aparece dentro del mensaje
    const ReplyBlock = msg.replyTo ? (
      <div className={`rounded-lg px-2 py-1.5 mb-1.5 text-xs border-l-2 ${isMe ? 'bg-[#c5e8b0] border-green-500' : 'bg-gray-100 border-gray-400'}`}>
        <p className="font-semibold text-gray-700">{msg.replyTo.senderName}</p>
        <p className="text-gray-500 truncate">{msg.replyTo.text || `[${msg.replyTo.type || 'media'}]`}</p>
      </div>
    ) : null

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

    // Audio/voice message
    if (msg.type === 'audio' || (msg.photos?.length === 1 && isAudioUrl(msg.photos[0]))) {
      return (
        <div className={`rounded-2xl px-3 py-2 max-w-[75vw] sm:max-w-[340px] shadow-sm ${isMe ? 'bg-[#DCF8C6] rounded-tr-sm' : 'bg-white rounded-tl-sm'}`}>
          <div className="flex items-center gap-2 py-1">
            <Mic size={16} className="text-green-600 flex-shrink-0" />
            <audio src={msg.photos?.[0]} controls className="h-8 flex-1 min-w-0" style={{ maxWidth: '240px' }} />
          </div>
          {msg.text && msg.text !== '🎤 Nota de voz' && <p className="text-sm leading-relaxed text-gray-900 whitespace-pre-wrap mt-1">{msg.text}</p>}
          <div className="flex items-center justify-end gap-0.5 mt-1">
            <span className="text-[10px] text-gray-400">{formatTime(msg.createdAt as Date)}</span>
            {isMe && <MessageTicks status={msg.status} />}
          </div>
        </div>
      )
    }

    // Document message
    if (msg.type === 'document' && msg.photos?.length === 1) {
      return (
        <div className={`rounded-2xl px-3 py-2 max-w-[75vw] sm:max-w-[300px] shadow-sm ${isMe ? 'bg-[#DCF8C6] rounded-tr-sm' : 'bg-white rounded-tl-sm'}`}>
          <a href={msg.photos[0]} target="_blank" rel="noopener noreferrer" download={msg.text || 'archivo'}
            className="flex items-center gap-2 py-1 hover:opacity-80 transition-opacity">
            <div className={`p-2 rounded-lg ${isMe ? 'bg-green-300/40' : 'bg-gray-100'}`}>
              <FileText size={18} className="text-gray-700" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{msg.text || 'Documento'}</p>
              <p className="text-xs text-blue-500 flex items-center gap-1"><Download size={10} /> Descargar</p>
            </div>
          </a>
          <div className="flex items-center justify-end gap-0.5 mt-1">
            <span className="text-[10px] text-gray-400">{formatTime(msg.createdAt as Date)}</span>
            {isMe && <MessageTicks status={msg.status} />}
          </div>
        </div>
      )
    }

    return (
      <div className={`group relative rounded-2xl px-3 py-2 max-w-[75vw] sm:max-w-[340px] shadow-sm ${isMe ? 'bg-[#DCF8C6] rounded-tr-sm' : 'bg-white rounded-tl-sm'}`}>
        <div className="absolute -top-2 -right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-0.5">
          <button onClick={() => setReplyToMsg(msg)}
            className="bg-white border border-gray-200 rounded-full p-1 shadow-sm" title="Responder">
            <Reply size={12} className="text-gray-500" />
          </button>
          <button onClick={() => setForwardMsg(msg)}
            className="bg-white border border-gray-200 rounded-full p-1 shadow-sm" title="Reenviar">
            <Forward size={12} className="text-gray-500" />
          </button>
        </div>
        {ReplyBlock}
        {msg.photos?.length > 0 && (
          <div className={`grid gap-1 mb-1.5 ${msg.photos.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
            {msg.photos.map((url, i) =>
              /\.(mp4|mov|webm|ogg|3gp)(\?|$)/i.test(url) && !isAudioUrl(url) ? (
                <video key={i} src={url} controls className="rounded-lg max-h-48 w-full" />
              ) : isAudioUrl(url) ? (
                <audio key={i} src={url} controls className="w-full" />
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
    <div className={`relative flex flex-col overflow-hidden ${fitParent ? 'h-full' : 'h-[calc(100dvh-130px)] sm:h-[calc(100vh-200px)] min-h-[400px] rounded-xl border border-gray-200'}`}>
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
          <button onClick={() => { setShowSearch(v => !v); setSearchQuery('') }}
            className="p-2 rounded-full hover:bg-white/10 transition-colors text-white" title="Buscar en chat">
            <Search size={17} />
          </button>
          <button onClick={exportToPDF}
            className="p-2 rounded-full hover:bg-white/10 transition-colors text-white" title="Exportar chat PDF">
            <Printer size={17} />
          </button>
          {hasWhatsApp && (client.phone || client.whatsappPhone) && (
            <button onClick={handleCall}
              className="p-2 rounded-full hover:bg-white/10 transition-colors text-white"
              title="Llamar por WhatsApp">
              <Phone size={18} />
            </button>
          )}
        </div>
      </div>

      {/* Barra de búsqueda */}
      {showSearch && (
        <div className="bg-white border-b border-gray-200 px-3 py-2 flex items-center gap-2 flex-shrink-0">
          <Search size={14} className="text-gray-400 flex-shrink-0" />
          <input
            autoFocus
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Buscar en esta conversación..."
            className="flex-1 text-sm text-gray-900 placeholder-gray-400 focus:outline-none"
          />
          {searchQuery && (
            <span className="text-xs text-gray-400">{displayMessages.length} resultado{displayMessages.length !== 1 ? 's' : ''}</span>
          )}
          <button onClick={() => { setShowSearch(false); setSearchQuery('') }} className="text-gray-400 hover:text-gray-700">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Hint plantillas */}
      {templates.length > 0 && (
        <div className="bg-[#075E54]/10 px-4 py-1.5 flex items-center gap-2 flex-shrink-0 border-b border-[#075E54]/10">
          <span className="text-[11px] text-[#075E54] font-medium">Escribe <kbd className="bg-white/80 border border-[#075E54]/20 rounded px-1 font-mono">/</kbd> para respuestas rápidas</span>
        </div>
      )}

      {/* Banner error de conexión */}
      {listenerError && (
        <div className="bg-red-500 text-white text-xs text-center px-4 py-1.5 flex-shrink-0">
          Sin conexión en tiempo real · Reconectando...
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
        {displayMessages.map(msg => {
          const isMe = msg.source === 'internal'
          return (
            <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
              <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} gap-0.5`}>
                {!isMe && !msg.isNote && (
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
          {pendingPreviews.map((p, i) => (
            <div key={i} className="relative w-14 h-14">
              {p.isVideo ? (
                <video src={p.src} className="w-full h-full object-cover rounded-lg border border-gray-200" muted />
              ) : (
                <img src={p.src} alt="" className="w-full h-full object-cover rounded-lg border border-gray-200" />
              )}
              <button onClick={() => removePending(i)}
                className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5">
                <X size={10} />
              </button>
            </div>
          ))}
          <p className="w-full text-xs text-gray-400 mt-0.5">{pendingPreviews.length} archivo{pendingPreviews.length > 1 ? 's' : ''}</p>
        </div>
      )}

      {/* Popup plantillas */}
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
            <button onClick={handleGetGps} disabled={gettingGps}
              className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium transition-colors ${
                locationCoords
                  ? 'bg-green-50 border border-green-200 text-green-700'
                  : 'bg-[#075E54] text-white hover:bg-[#064d45]'
              }`}>
              {gettingGps
                ? <><div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" /> Obteniendo ubicación...</>
                : locationCoords
                  ? <><Navigation size={16} /> ✓ Ubicación obtenida</>
                  : <><Navigation size={16} /> Usar mi ubicación GPS</>
              }
            </button>
            {locationCoords && <p className="text-xs text-gray-500 text-center -mt-2">{locationCoords.lat.toFixed(5)}, {locationCoords.lng.toFixed(5)}</p>}
            <input value={locationName} onChange={e => setLocationName(e.target.value)}
              placeholder="Nombre del lugar (opcional)"
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none focus:border-[#075E54]" />
            <button onClick={handleSendLocation} disabled={sending || !locationCoords}
              className="w-full bg-[#075E54] hover:bg-[#064d45] disabled:opacity-40 text-white font-semibold py-3 rounded-xl text-sm transition-colors">
              {sending ? 'Enviando...' : 'Enviar ubicación'}
            </button>
          </div>
        </div>
      )}

      {/* Menú acciones */}
      {showActions && (
        <div className="absolute bottom-[72px] left-3 bg-white rounded-2xl shadow-xl border border-gray-200 z-10 overflow-hidden">
          <button type="button" onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-3 w-full px-5 py-3.5 hover:bg-gray-50 active:bg-gray-100 transition-colors text-sm text-gray-700">
            <Paperclip size={18} className="text-[#075E54]" />
            Adjuntar archivos
          </button>
          <button type="button" onClick={() => { setShowLocationModal(true); setShowActions(false) }}
            className="flex items-center gap-3 w-full px-5 py-3.5 hover:bg-gray-50 active:bg-gray-100 transition-colors text-sm text-gray-700 border-t border-gray-100">
            <MapPin size={18} className="text-[#075E54]" />
            Enviar ubicación
          </button>
          <button type="button" onClick={openCatalog}
            className="flex items-center gap-3 w-full px-5 py-3.5 hover:bg-gray-50 active:bg-gray-100 transition-colors text-sm text-gray-700 border-t border-gray-100">
            <ShoppingBag size={18} className="text-[#075E54]" />
            Enviar producto
          </button>
          <button type="button" onClick={() => { setNoteMode(v => !v); setShowActions(false) }}
            className="flex items-center gap-3 w-full px-5 py-3.5 hover:bg-amber-50 active:bg-amber-100 transition-colors text-sm text-amber-700 border-t border-gray-100">
            <StickyNote size={18} className="text-amber-500" />
            Nota interna
          </button>
        </div>
      )}

      {/* Modal catálogo */}
      {showCatalog && (
        <div className="absolute inset-0 z-20 bg-white flex flex-col">
          <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200">
            <button onClick={() => setShowCatalog(false)} className="p-1.5 hover:bg-gray-100 rounded-lg">
              <X size={18} className="text-gray-600" />
            </button>
            <h3 className="font-semibold text-gray-900 flex-1">Enviar producto</h3>
          </div>
          <div className="px-3 py-2 border-b border-gray-100">
            <input
              value={catalogSearch}
              onChange={e => setCatalogSearch(e.target.value)}
              placeholder="Buscar producto..."
              className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400"
            />
          </div>
          <div className="flex-1 overflow-y-auto p-3">
            {catalogItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <ShoppingBag size={32} className="text-gray-300 mb-2" />
                <p className="text-sm text-gray-500">No hay productos disponibles</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {catalogItems
                  .filter(i => !catalogSearch || i.title.toLowerCase().includes(catalogSearch.toLowerCase()))
                  .map(item => (
                    <button
                      key={item.id}
                      onClick={() => sendCatalogItem(item)}
                      className="bg-white border border-gray-200 rounded-xl overflow-hidden text-left hover:border-gray-400 hover:shadow-sm transition-all active:scale-95"
                    >
                      <div className="aspect-square bg-gray-50">
                        {item.photos[0] ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={item.photos[0]} alt={item.title} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <ShoppingBag size={20} className="text-gray-300" />
                          </div>
                        )}
                      </div>
                      <div className="p-2">
                        <p className="text-xs font-semibold text-gray-900 truncate">{item.title}</p>
                        {item.price != null && (
                          <p className="text-xs font-bold text-gray-700 mt-0.5">${item.price.toLocaleString('es')}</p>
                        )}
                      </div>
                    </button>
                  ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Banner reply */}
      {replyToMsg && (
        <div className="bg-gray-50 border-t border-gray-200 px-4 py-2 flex items-center gap-3 flex-shrink-0">
          <Reply size={14} className="text-[#075E54] flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-semibold text-[#075E54]">{replyToMsg.senderName}</p>
            <p className="text-xs text-gray-500 truncate">{replyToMsg.text || `[${replyToMsg.type || 'media'}]`}</p>
          </div>
          <button onClick={() => setReplyToMsg(null)} className="text-gray-400 hover:text-gray-700">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Banner modo nota */}
      {noteMode && (
        <div className="bg-amber-50 border-t border-amber-200 px-4 py-1.5 flex items-center gap-2 flex-shrink-0">
          <StickyNote size={13} className="text-amber-500" />
          <span className="text-xs text-amber-700 font-medium flex-1">Modo nota interna · no se enviará por WhatsApp</span>
          <button onClick={() => setNoteMode(false)} className="text-amber-400 hover:text-amber-700"><X size={13} /></button>
        </div>
      )}

      {/* Barra de input */}
      <div className={`px-2 py-2 flex items-end gap-2 border-t border-gray-200 flex-shrink-0 ${noteMode ? 'bg-amber-50' : 'bg-[#F0F2F5]'}`}>
        <input ref={fileInputRef} type="file" multiple accept="image/*,video/*"
          className="hidden" onChange={e => handleFiles(e.target.files)} />

        {/* Voice recording UI */}
        {isRecording || audioBlob ? (
          <div className="flex items-center gap-2 flex-1 bg-white rounded-2xl px-3 py-2 shadow-sm">
            {isRecording ? (
              <>
                <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
                <span className="text-sm text-red-600 font-medium flex-1">{formatRecordTime(recordingTime)}</span>
                <button onClick={cancelRecording} className="p-1.5 text-gray-400 hover:text-gray-700 rounded-full hover:bg-gray-100">
                  <X size={18} />
                </button>
                <button onClick={stopRecording} className="p-2 bg-red-500 text-white rounded-full hover:bg-red-600">
                  <Square size={14} />
                </button>
              </>
            ) : audioBlob ? (
              <>
                <button onClick={togglePlayback} className="p-1.5 text-[#075E54] hover:bg-gray-100 rounded-full">
                  {playingAudio ? <Pause size={18} /> : <Play size={18} />}
                </button>
                <span className="text-sm text-gray-600 flex-1">{formatRecordTime(recordingTime)}</span>
                <button onClick={cancelRecording} className="p-1.5 text-gray-400 hover:text-red-500 rounded-full hover:bg-gray-100">
                  <X size={18} />
                </button>
                <button onClick={sendVoiceNote} disabled={sending}
                  className="p-2 bg-[#075E54] text-white rounded-full hover:bg-[#064d45] disabled:opacity-40">
                  {sending ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Send size={14} />}
                </button>
              </>
            ) : null}
          </div>
        ) : (
          <>
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

            {/* Mic or Send */}
            {!text.trim() && pendingFiles.length === 0 ? (
              <button onClick={startRecording}
                className="p-2.5 text-gray-500 hover:text-[#075E54] hover:bg-gray-200 rounded-full transition-colors flex-shrink-0"
                title="Grabar nota de voz">
                <Mic size={20} />
              </button>
            ) : (
              <button onClick={handleSend}
                disabled={sending}
                className="p-2.5 bg-[#075E54] hover:bg-[#064d45] disabled:opacity-40 text-white rounded-full transition-colors flex-shrink-0 shadow-sm">
                {sending
                  ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  : <Send size={16} />}
              </button>
            )}
          </>
        )}
      </div>

      {/* Modal reenviar mensaje */}
      {forwardMsg && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40" onClick={() => { setForwardMsg(null); setForwardSearch('') }}>
          <div className="w-full max-w-sm bg-white rounded-xl shadow-xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900 text-sm">Reenviar a...</h3>
              <input
                autoFocus
                value={forwardSearch}
                onChange={e => setForwardSearch(e.target.value)}
                placeholder="Buscar contacto..."
                className="mt-2 w-full bg-gray-100 rounded-full px-4 py-2 text-sm focus:outline-none"
              />
            </div>
            <div className="max-h-72 overflow-y-auto p-2">
              {allClients
                .filter(c => c.id !== client.id && (!forwardSearch || c.name.toLowerCase().includes(forwardSearch.toLowerCase())))
                .slice(0, 20)
                .map(c => (
                  <button key={c.id} onClick={() => handleForward(c)}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-gray-50 text-left transition-colors">
                    <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-600 flex-shrink-0">
                      {c.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{c.name}</p>
                      <p className="text-xs text-gray-400 truncate">{c.phone || c.whatsappPhone || ''}</p>
                    </div>
                  </button>
                ))}
              {allClients.filter(c => c.id !== client.id && (!forwardSearch || c.name.toLowerCase().includes(forwardSearch.toLowerCase()))).length === 0 && (
                <p className="text-center text-sm text-gray-400 py-6">Sin contactos</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
