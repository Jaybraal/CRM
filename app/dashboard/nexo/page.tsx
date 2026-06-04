'use client'

import { useEffect, useRef, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import {
  collection, query, orderBy, limit, onSnapshot,
  addDoc, updateDoc, doc, serverTimestamp
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import {
  MessageSquare, Plus, Search, Send, Hash, Users, Tag,
  Bell, KanbanSquare, RefreshCw, ChevronRight, X, AtSign
} from 'lucide-react'
import toast from 'react-hot-toast'

interface NexoChannel {
  id: string
  name: string
  type: 'group' | 'deal' | 'direct'
  dealName?: string
  clientName?: string
  lastMessage?: string
  lastMessageAt?: any
  members: string[]
  createdBy: string
}

interface NexoMessage {
  id: string
  senderId: string
  senderName: string
  text: string
  createdAt: any
}

const AVATAR_COLORS = ['#3b82f6','#7c3aed','#16a34a','#d97706','#db2777','#0891b2']

function Avatar({ name, size = 32 }: { name: string; size?: number }) {
  const initials = name.trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?'
  const color = AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length]
  return (
    <div
      className="rounded-xl flex items-center justify-center flex-shrink-0 text-white font-bold"
      style={{ width: size, height: size, backgroundColor: color, fontSize: size * 0.35 }}
    >
      {initials}
    </div>
  )
}

function formatTime(ts: any) {
  if (!ts) return ''
  const d = ts?.seconds ? new Date(ts.seconds * 1000) : new Date(ts)
  const diff = Date.now() - d.getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'ahora'
  if (mins < 60) return `${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h`
  return d.toLocaleDateString('es', { day: '2-digit', month: 'short' })
}

export default function NexoPage() {
  const { profile } = useAuth()
  const [channels, setChannels] = useState<NexoChannel[]>([])
  const [activeChannel, setActiveChannel] = useState<NexoChannel | null>(null)
  const [messages, setMessages] = useState<NexoMessage[]>([])
  const [text, setText] = useState('')
  const [search, setSearch] = useState('')
  const [sending, setSending] = useState(false)
  const [loadingChannels, setLoadingChannels] = useState(true)
  const [showNewChannel, setShowNewChannel] = useState(false)
  const [newChannelName, setNewChannelName] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (!profile?.orgId) return
    const q = query(
      collection(db, 'organizations', profile.orgId, 'nexo_connect'),
      orderBy('updatedAt', 'desc'),
      limit(30)
    )
    const unsub = onSnapshot(q, snap => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() })) as NexoChannel[]
      setChannels(list)
      setLoadingChannels(false)
      if (!activeChannel && list.length > 0) setActiveChannel(list[0])
    }, () => setLoadingChannels(false))
    return () => unsub()
  }, [profile?.orgId])

  useEffect(() => {
    if (!profile?.orgId || !activeChannel) return
    setMessages([])
    const q = query(
      collection(db, 'organizations', profile.orgId, 'nexo_connect', activeChannel.id, 'messages'),
      orderBy('createdAt', 'asc'),
      limit(80)
    )
    const unsub = onSnapshot(q, snap => {
      setMessages(snap.docs.map(d => ({ id: d.id, ...d.data() })) as NexoMessage[])
    })
    return () => unsub()
  }, [profile?.orgId, activeChannel?.id])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function sendMessage() {
    if (!text.trim() || !profile?.orgId || !activeChannel || sending) return
    setSending(true)
    try {
      await addDoc(
        collection(db, 'organizations', profile.orgId, 'nexo_connect', activeChannel.id, 'messages'),
        {
          senderId: profile.uid,
          senderName: profile.displayName,
          text: text.trim(),
          createdAt: serverTimestamp(),
        }
      )
      await updateDoc(doc(db, 'organizations', profile.orgId, 'nexo_connect', activeChannel.id), {
        lastMessage: text.trim(),
        lastMessageAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
      setText('')
      textareaRef.current?.focus()
    } catch {
      toast.error('Error al enviar')
    } finally {
      setSending(false)
    }
  }

  async function createChannel() {
    if (!newChannelName.trim() || !profile?.orgId) return
    try {
      const ref = await addDoc(collection(db, 'organizations', profile.orgId, 'nexo_connect'), {
        name: newChannelName.trim().toLowerCase().replace(/\s+/g, '-'),
        type: 'group',
        members: [profile.uid],
        createdBy: profile.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
      setNewChannelName('')
      setShowNewChannel(false)
      toast.success('Canal creado')
    } catch {
      toast.error('Error al crear canal')
    }
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const filteredChannels = channels.filter(c =>
    !search || c.name.toLowerCase().includes(search.toLowerCase())
  )

  const groups  = filteredChannels.filter(c => c.type === 'group')
  const deals   = filteredChannels.filter(c => c.type === 'deal')
  const directs = filteredChannels.filter(c => c.type === 'direct')

  const ChannelIcon = ({ type }: { type: NexoChannel['type'] }) =>
    type === 'deal' ? <Tag size={15} className="text-amber-400" /> :
    type === 'direct' ? <Users size={15} className="text-emerald-400" /> :
    <Hash size={15} className="text-slate-400" />

  return (
    <div className="flex flex-1 overflow-hidden h-full bg-white dark:bg-slate-900">

      {/* ── Channel sidebar ── */}
      <div className="w-72 lg:w-80 flex-shrink-0 border-r border-slate-200 dark:border-slate-800 flex flex-col bg-slate-50 dark:bg-slate-900">

        <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <MessageSquare size={18} className="text-blue-600" />
              <h2 className="font-black text-slate-900 dark:text-white text-base">Nexo Connect</h2>
            </div>
            <button
              onClick={() => setShowNewChannel(true)}
              className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
            >
              <Plus size={16} />
            </button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
            <input
              type="text"
              placeholder="Buscar canal..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-2 bg-slate-100 dark:bg-slate-800 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-700 dark:text-slate-200"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto py-2">
          {loadingChannels ? (
            <div className="flex items-center justify-center h-20 gap-2 text-slate-400 text-sm">
              <RefreshCw size={14} className="animate-spin" /> Cargando...
            </div>
          ) : (
            <>
              {/* Group channels */}
              {groups.length > 0 && (
                <div className="mb-1">
                  <p className="px-4 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    Canales
                  </p>
                  {groups.map(ch => (
                    <ChannelRow key={ch.id} ch={ch} active={activeChannel?.id === ch.id} onClick={() => setActiveChannel(ch)} />
                  ))}
                </div>
              )}

              {/* Deal channels */}
              {deals.length > 0 && (
                <div className="mb-1">
                  <p className="px-4 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    Hilos de Deals
                  </p>
                  {deals.map(ch => (
                    <ChannelRow key={ch.id} ch={ch} active={activeChannel?.id === ch.id} onClick={() => setActiveChannel(ch)} />
                  ))}
                </div>
              )}

              {/* Direct messages */}
              {directs.length > 0 && (
                <div className="mb-1">
                  <p className="px-4 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    Mensajes directos
                  </p>
                  {directs.map(ch => (
                    <ChannelRow key={ch.id} ch={ch} active={activeChannel?.id === ch.id} onClick={() => setActiveChannel(ch)} />
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* New channel modal inline */}
        {showNewChannel && (
          <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-bold text-slate-700 dark:text-slate-200">Nuevo canal</span>
              <button onClick={() => setShowNewChannel(false)} className="text-slate-400 hover:text-slate-600">
                <X size={14} />
              </button>
            </div>
            <div className="flex gap-2">
              <input
                autoFocus
                type="text"
                placeholder="nombre-del-canal"
                value={newChannelName}
                onChange={e => setNewChannelName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && createChannel()}
                className="flex-1 px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={createChannel}
                className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
              >
                Crear
              </button>
            </div>
          </div>
        )}

        <div className="p-3 border-t border-slate-200 dark:border-slate-800 flex items-center gap-3 bg-white dark:bg-slate-900">
          <Avatar name={profile?.displayName || 'U'} size={32} />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate">{profile?.displayName}</p>
            <p className="text-[10px] text-emerald-500 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" /> En línea
            </p>
          </div>
          <button className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
            <Bell size={15} />
          </button>
        </div>
      </div>

      {/* ── Main chat area ── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {activeChannel ? (
          <>
            {/* Chat header */}
            <div className="px-6 py-4 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between flex-shrink-0 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                  {activeChannel.type === 'deal'
                    ? <Tag size={17} className="text-amber-500" />
                    : activeChannel.type === 'direct'
                    ? <Users size={17} className="text-blue-500" />
                    : <Hash size={17} className="text-blue-500" />
                  }
                </div>
                <div>
                  <h3 className="font-black text-slate-900 dark:text-white text-sm">
                    {activeChannel.type === 'group' ? '#' : ''}{activeChannel.name}
                  </h3>
                  {activeChannel.dealName && (
                    <a className="text-xs text-blue-600 hover:underline flex items-center gap-1" href="/dashboard/pipeline">
                      <KanbanSquare size={10} /> Ver deal en Pipeline →
                    </a>
                  )}
                  {activeChannel.clientName && (
                    <p className="text-xs text-slate-400">{activeChannel.clientName}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
                  <Search size={16} />
                </button>
                <button className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
                  <Bell size={16} />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-50/60 dark:bg-slate-950/60">
              {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-40 text-slate-400 gap-2">
                  <Hash size={28} className="opacity-30" />
                  <p className="text-sm">Sin mensajes aún. ¡Sé el primero!</p>
                </div>
              )}
              {messages.map((msg, i) => {
                const isMe = msg.senderId === profile?.uid
                const showAvatar = !isMe && (i === 0 || messages[i - 1]?.senderId !== msg.senderId)
                return (
                  <div key={msg.id} className={`flex gap-3 ${isMe ? 'flex-row-reverse' : ''}`}>
                    {!isMe && (
                      <div className="w-8 flex-shrink-0 flex items-end">
                        {showAvatar && <Avatar name={msg.senderName} size={30} />}
                      </div>
                    )}
                    <div className={`max-w-[70%] ${isMe ? 'items-end' : 'items-start'} flex flex-col`}>
                      {showAvatar && !isMe && (
                        <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1 ml-1">
                          {msg.senderName}
                        </span>
                      )}
                      <div className={`px-4 py-2.5 rounded-2xl shadow-sm text-sm leading-relaxed ${
                        isMe
                          ? 'bg-blue-600 text-white rounded-tr-sm'
                          : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-tl-sm'
                      }`}>
                        {msg.text}
                      </div>
                      <span className={`text-[10px] text-slate-400 mt-1 ${isMe ? 'mr-1' : 'ml-1'}`}>
                        {formatTime(msg.createdAt)}
                      </span>
                    </div>
                  </div>
                )
              })}
              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div className="p-4 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex-shrink-0">
              <div className="flex gap-2 items-end">
                <div className="flex-1 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500">
                  <textarea
                    ref={textareaRef}
                    rows={1}
                    placeholder={`Mensaje en #${activeChannel.name}... (Enter para enviar)`}
                    value={text}
                    onChange={e => setText(e.target.value)}
                    onKeyDown={handleKey}
                    className="w-full px-4 py-3 bg-transparent text-sm resize-none focus:outline-none text-slate-800 dark:text-slate-100 max-h-32"
                    style={{ minHeight: 44 }}
                  />
                </div>
                <button
                  onClick={sendMessage}
                  disabled={!text.trim() || sending}
                  className="p-3 bg-blue-600 text-white rounded-2xl hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-sm"
                >
                  <Send size={18} />
                </button>
              </div>
              <div className="flex items-center gap-3 mt-2 px-1">
                <p className="text-xs text-slate-400">
                  <AtSign size={11} className="inline mr-1" />
                  Menciona compañeros con @nombre
                </p>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center bg-slate-50 dark:bg-slate-950 text-slate-400">
            <div className="text-center">
              <MessageSquare size={48} className="mx-auto mb-4 opacity-20" />
              <p className="font-semibold">Selecciona un canal para chatear</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function ChannelRow({ ch, active, onClick }: { ch: NexoChannel; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-4 py-2.5 flex items-center gap-3 transition-colors ${
        active
          ? 'bg-blue-100/60 dark:bg-blue-900/20 border-r-2 border-r-blue-600'
          : 'hover:bg-slate-100 dark:hover:bg-slate-800'
      }`}
    >
      <div className="flex-shrink-0">
        {ch.type === 'deal'
          ? <Tag size={15} className="text-amber-500" />
          : ch.type === 'direct'
          ? <Users size={15} className="text-emerald-500" />
          : <Hash size={15} className={active ? 'text-blue-600' : 'text-slate-400'} />
        }
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm truncate ${active ? 'font-bold text-blue-700 dark:text-blue-400' : 'font-medium text-slate-700 dark:text-slate-300'}`}>
          {ch.name}
        </p>
        {ch.lastMessage && (
          <p className="text-xs text-slate-400 truncate">{ch.lastMessage}</p>
        )}
      </div>
    </button>
  )
}
