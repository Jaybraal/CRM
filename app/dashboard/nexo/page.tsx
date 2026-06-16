'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useAuth } from '@/context/AuthContext'
import {
  collection, query, orderBy, limit, onSnapshot,
  addDoc, updateDoc, doc, serverTimestamp
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { getOrgUsers, getDeals } from '@/lib/firestore'
import type { AppUser, Deal } from '@/types'
import {
  MessageSquare, Plus, Search, Send, Hash, Users,
  KanbanSquare, RefreshCw, X, AtSign, UserPlus,
  ChevronDown, Tag, MessageCircle
} from 'lucide-react'
import toast from 'react-hot-toast'

interface NexoChannel {
  id: string
  name: string
  type: 'group' | 'deal' | 'direct'
  dealId?: string
  dealName?: string
  clientName?: string
  lastMessage?: string
  lastMessageAt?: unknown
  members: string[]
  createdBy: string
}

interface NexoMessage {
  id: string
  senderId: string
  senderName: string
  text: string
  createdAt: unknown
}

const AVATAR_COLORS = ['#3b82f6','#7c3aed','#16a34a','#d97706','#db2777','#0891b2']

function Avatar({ name, size = 32 }: { name: string; size?: number }) {
  const initials = name.trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?'
  const color = AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length]
  return (
    <div
      className="rounded-md flex items-center justify-center flex-shrink-0 text-white font-bold select-none"
      style={{ width: size, height: size, backgroundColor: color, fontSize: size * 0.35 }}
    >
      {initials}
    </div>
  )
}

function formatTime(ts: unknown) {
  if (!ts) return ''
  const d = (ts as { seconds?: number })?.seconds
    ? new Date((ts as { seconds: number }).seconds * 1000)
    : new Date(ts as string)
  const diff = Date.now() - d.getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'ahora'
  if (mins < 60) return `${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h`
  return d.toLocaleDateString('es', { day: '2-digit', month: 'short' })
}

function ChannelRow({ ch, active, onClick }: { ch: NexoChannel; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-4 py-2.5 flex items-center gap-3 transition-colors ${
        active
          ? 'bg-[#0D7A65]/10/60 dark:bg-[#0D7A65]/10 border-r-2 border-r-blue-600'
          : 'hover:bg-[#F4F5F7] dark:hover:bg-[#1A2540]'
      }`}
    >
      <div className="flex-shrink-0">
        {ch.type === 'deal'
          ? <Tag size={15} className={active ? 'text-amber-500' : 'text-amber-400'} />
          : ch.type === 'direct'
          ? <MessageCircle size={15} className={active ? 'text-emerald-600' : 'text-emerald-400'} />
          : <Hash size={15} className={active ? 'text-[#0D7A65]' : 'text-[#9BA5B7]'} />
        }
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm truncate ${active ? 'font-bold text-blue-700 dark:text-[#0D7A65]' : 'font-medium text-[#0C1224] dark:text-[#9BA5B7]'}`}>
          {ch.name}
        </p>
        {ch.lastMessage && (
          <p className="text-xs text-[#9BA5B7] truncate">{ch.lastMessage}</p>
        )}
      </div>
    </button>
  )
}

type NewChannelType = 'group' | 'deal' | 'direct'

export default function NexoPage() {
  const { profile } = useAuth()
  const [channels, setChannels] = useState<NexoChannel[]>([])
  const [activeChannel, setActiveChannel] = useState<NexoChannel | null>(null)
  const [messages, setMessages] = useState<NexoMessage[]>([])
  const [text, setText] = useState('')
  const [search, setSearch] = useState('')
  const [sending, setSending] = useState(false)
  const [loadingChannels, setLoadingChannels] = useState(true)

  // New channel modal
  const [showNewChannel, setShowNewChannel] = useState(false)
  const [newType, setNewType] = useState<NewChannelType>('group')
  const [newName, setNewName] = useState('')
  const [selectedMembers, setSelectedMembers] = useState<string[]>([])
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null)
  const [selectedUser, setSelectedUser] = useState<AppUser | null>(null)
  const [creating, setCreating] = useState(false)

  // Chat search
  const [showSearch, setShowSearch] = useState(false)
  const [msgSearch, setMsgSearch] = useState('')

  // Members panel
  const [showMembers, setShowMembers] = useState(false)
  const [addingMember, setAddingMember] = useState(false)

  // @mentions
  const [mentionQuery, setMentionQuery] = useState<string | null>(null)
  const [mentionAnchor, setMentionAnchor] = useState(0)

  // Data
  const [orgUsers, setOrgUsers] = useState<AppUser[]>([])
  const [deals, setDeals] = useState<Deal[]>([])

  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Load org users and deals on mount
  useEffect(() => {
    if (!profile?.orgId) return
    getOrgUsers(profile.orgId).then(setOrgUsers)
    getDeals(profile.orgId).then(setDeals)
  }, [profile?.orgId])

  // Channels subscription
  useEffect(() => {
    if (!profile?.orgId) return
    const q = query(
      collection(db, 'organizations', profile.orgId, 'nexo_connect'),
      orderBy('updatedAt', 'desc'),
      limit(50)
    )
    const unsub = onSnapshot(q, snap => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() })) as NexoChannel[]
      setChannels(list)
      setLoadingChannels(false)
      if (!activeChannel && list.length > 0) setActiveChannel(list[0])
    }, () => setLoadingChannels(false))
    return () => unsub()
  }, [profile?.orgId])

  // Messages subscription
  useEffect(() => {
    if (!profile?.orgId || !activeChannel) return
    setMessages([])
    setMsgSearch('')
    setShowSearch(false)
    const q = query(
      collection(db, 'organizations', profile.orgId, 'nexo_connect', activeChannel.id, 'messages'),
      orderBy('createdAt', 'asc'),
      limit(100)
    )
    const unsub = onSnapshot(q, snap => {
      setMessages(snap.docs.map(d => ({ id: d.id, ...d.data() })) as NexoMessage[])
    })
    return () => unsub()
  }, [profile?.orgId, activeChannel?.id])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // ── Send message ──
  async function sendMessage() {
    if (!text.trim() || !profile?.orgId || !activeChannel || sending) return
    setSending(true)
    try {
      await addDoc(
        collection(db, 'organizations', profile.orgId, 'nexo_connect', activeChannel.id, 'messages'),
        { senderId: profile.uid, senderName: profile.displayName, text: text.trim(), createdAt: serverTimestamp() }
      )
      await updateDoc(doc(db, 'organizations', profile.orgId, 'nexo_connect', activeChannel.id), {
        lastMessage: text.trim(), lastMessageAt: serverTimestamp(), updatedAt: serverTimestamp(),
      })
      setText('')
      textareaRef.current?.focus()
    } catch { toast.error('Error al enviar') }
    finally { setSending(false) }
  }

  // ── Create channel ──
  async function createChannel() {
    if (!profile?.orgId) return
    if (newType === 'group' && !newName.trim()) return
    if (newType === 'deal' && !selectedDeal) return
    if (newType === 'direct' && !selectedUser) return
    setCreating(true)
    try {
      let data: Partial<NexoChannel> & { createdAt: unknown; updatedAt: unknown }
      const base = { createdBy: profile.uid, createdAt: serverTimestamp(), updatedAt: serverTimestamp() }

      if (newType === 'group') {
        const members = Array.from(new Set([profile.uid, ...selectedMembers]))
        data = { name: newName.trim().toLowerCase().replace(/\s+/g, '-'), type: 'group', members, ...base }
      } else if (newType === 'deal' && selectedDeal) {
        const members = Array.from(new Set([profile.uid, ...selectedMembers]))
        data = { name: selectedDeal.clientId, type: 'deal', dealId: selectedDeal.id, dealName: selectedDeal.notes?.slice(0,30) || selectedDeal.id, members, ...base }
      } else if (newType === 'direct' && selectedUser) {
        const existing = channels.find(c =>
          c.type === 'direct' &&
          c.members.includes(profile.uid) &&
          c.members.includes(selectedUser.uid)
        )
        if (existing) { setActiveChannel(existing); closeNewChannel(); return }
        data = {
          name: selectedUser.displayName || selectedUser.email || 'DM',
          type: 'direct',
          members: [profile.uid, selectedUser.uid],
          ...base
        }
      } else return

      await addDoc(collection(db, 'organizations', profile.orgId, 'nexo_connect'), data)
      toast.success(newType === 'direct' ? 'Conversación iniciada' : 'Canal creado')
      closeNewChannel()
    } catch (e) { toast.error('Error al crear') }
    finally { setCreating(false) }
  }

  function closeNewChannel() {
    setShowNewChannel(false); setNewName(''); setSelectedMembers([]); setSelectedDeal(null); setSelectedUser(null); setNewType('group')
  }

  // ── Add member to active channel ──
  async function addMemberToChannel(uid: string) {
    if (!profile?.orgId || !activeChannel) return
    if (activeChannel.members.includes(uid)) { toast('Ya es miembro'); return }
    const updated = [...activeChannel.members, uid]
    await updateDoc(doc(db, 'organizations', profile.orgId, 'nexo_connect', activeChannel.id), { members: updated })
    setActiveChannel(prev => prev ? { ...prev, members: updated } : prev)
    setChannels(prev => prev.map(c => c.id === activeChannel.id ? { ...c, members: updated } : c))
    toast.success('Miembro añadido')
    setAddingMember(false)
  }

  // ── Textarea: @mention detection ──
  const handleTextChange = useCallback((val: string) => {
    setText(val)
    const cursor = textareaRef.current?.selectionStart ?? val.length
    const before = val.slice(0, cursor)
    const match = before.match(/@(\w*)$/)
    if (match) {
      setMentionQuery(match[1])
      setMentionAnchor(match.index ?? 0)
    } else {
      setMentionQuery(null)
    }
  }, [])

  function insertMention(user: AppUser) {
    const name = user.displayName || user.email || 'usuario'
    const cursor = textareaRef.current?.selectionStart ?? text.length
    const before = text.slice(0, cursor)
    const after = text.slice(cursor)
    const replaced = before.replace(/@\w*$/, `@${name} `)
    setText(replaced + after)
    setMentionQuery(null)
    textareaRef.current?.focus()
  }

  function handleKey(e: React.KeyboardEvent) {
    if (mentionQuery !== null) return // let mention dropdown handle Enter
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
  }

  // ── Derived ──
  const groups  = channels.filter(c => c.type === 'group')
  const dealChs = channels.filter(c => c.type === 'deal')
  const directs = channels.filter(c => c.type === 'direct')

  const filteredMessages = msgSearch
    ? messages.filter(m => m.text.toLowerCase().includes(msgSearch.toLowerCase()))
    : messages

  const mentionUsers = mentionQuery !== null
    ? orgUsers.filter(u =>
        u.uid !== profile?.uid &&
        (u.displayName?.toLowerCase().startsWith(mentionQuery.toLowerCase()) ||
         u.email?.toLowerCase().startsWith(mentionQuery.toLowerCase()))
      ).slice(0, 6)
    : []

  const channelMembers = orgUsers.filter(u => activeChannel?.members.includes(u.uid))
  const nonMembers = orgUsers.filter(u => !activeChannel?.members.includes(u.uid))

  return (
    <div className="flex flex-1 overflow-hidden h-full bg-white dark:bg-[#0F1829]">

      {/* ── Channel sidebar ── */}
      <div className="w-64 lg:w-72 flex-shrink-0 border-r border-[#E3E6EC] dark:border-[#1A2540] flex flex-col bg-[#F4F5F7] dark:bg-[#0F1829]">

        {/* Header */}
        <div className="p-4 border-b border-[#E3E6EC] dark:border-[#1A2540] bg-white dark:bg-[#0F1829]">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <MessageSquare size={17} className="text-[#0D7A65]" />
              <h2 className="font-bold text-[#0C1224] dark:text-[#E8ECF4] text-sm">Nexo Connect</h2>
            </div>
            <button
              onClick={() => setShowNewChannel(true)}
              className="p-1.5 text-[#9BA5B7] hover:text-[#0D7A65] hover:bg-[#F4F5F7] dark:hover:bg-blue-900/20 rounded-lg transition-colors"
              title="Nuevo canal / DM"
            >
              <Plus size={16} />
            </button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9BA5B7]" size={13} />
            <input
              type="text"
              placeholder="Buscar canal..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-[#F4F5F7] dark:bg-[#1A2540] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0D7A65] text-[#0C1224] dark:text-[#E8ECF4]"
            />
          </div>
        </div>

        {/* Channel list */}
        <div className="flex-1 overflow-y-auto py-2">
          {loadingChannels ? (
            <div className="flex items-center justify-center h-20 gap-2 text-[#9BA5B7] text-sm">
              <RefreshCw size={14} className="animate-spin" />
            </div>
          ) : (
            <>
              {groups.length > 0 && (
                <div className="mb-1">
                  <p className="px-4 py-1.5 text-[10px] font-bold text-[#9BA5B7] uppercase tracking-widest">Canales</p>
                  {groups.filter(c => !search || c.name.includes(search.toLowerCase())).map(ch => (
                    <ChannelRow key={ch.id} ch={ch} active={activeChannel?.id === ch.id} onClick={() => setActiveChannel(ch)} />
                  ))}
                </div>
              )}
              {dealChs.length > 0 && (
                <div className="mb-1">
                  <p className="px-4 py-1.5 text-[10px] font-bold text-[#9BA5B7] uppercase tracking-widest">Deals</p>
                  {dealChs.filter(c => !search || c.name.includes(search.toLowerCase())).map(ch => (
                    <ChannelRow key={ch.id} ch={ch} active={activeChannel?.id === ch.id} onClick={() => setActiveChannel(ch)} />
                  ))}
                </div>
              )}
              {directs.length > 0 && (
                <div className="mb-1">
                  <p className="px-4 py-1.5 text-[10px] font-bold text-[#9BA5B7] uppercase tracking-widest">Mensajes directos</p>
                  {directs.filter(c => !search || c.name.toLowerCase().includes(search.toLowerCase())).map(ch => (
                    <ChannelRow key={ch.id} ch={ch} active={activeChannel?.id === ch.id} onClick={() => setActiveChannel(ch)} />
                  ))}
                </div>
              )}
              {!loadingChannels && channels.length === 0 && (
                <div className="flex flex-col items-center justify-center h-32 text-[#9BA5B7] gap-2 px-4 text-center">
                  <MessageSquare size={24} className="opacity-30" />
                  <p className="text-xs">Crea tu primer canal con el botón +</p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Current user */}
        <div className="p-3 border-t border-[#E3E6EC] dark:border-[#1A2540] flex items-center gap-3 bg-white dark:bg-[#0F1829]">
          <Avatar name={profile?.displayName || 'U'} size={30} />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-[#0C1224] dark:text-[#E8ECF4] truncate">{profile?.displayName}</p>
            <p className="text-[10px] text-emerald-500 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" /> En línea
            </p>
          </div>
        </div>
      </div>

      {/* ── Main chat area ── */}
      <div className="flex-1 flex overflow-hidden">
        {activeChannel ? (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Chat header */}
            <div className="px-5 py-3 bg-white dark:bg-[#0F1829] border-b border-[#E3E6EC] dark:border-[#1A2540] flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-md bg-[#F4F5F7] dark:bg-[#1A2540] flex items-center justify-center">
                  {activeChannel.type === 'deal' ? <Tag size={15} className="text-amber-500" />
                    : activeChannel.type === 'direct' ? <MessageCircle size={15} className="text-emerald-500" />
                    : <Hash size={15} className="text-[#0D7A65]" />}
                </div>
                <div>
                  <h3 className="font-bold text-[#0C1224] dark:text-[#E8ECF4] text-sm">
                    {activeChannel.type === 'group' ? '#' : ''}{activeChannel.name}
                  </h3>
                  {activeChannel.dealName && (
                    <a className="text-[11px] text-[#0D7A65] hover:underline flex items-center gap-1" href="/dashboard/pipeline">
                      <KanbanSquare size={10} /> Ver en Pipeline →
                    </a>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1">
                {/* Members count */}
                <button
                  onClick={() => { setShowMembers(!showMembers); setAddingMember(false) }}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${showMembers ? 'bg-[#F4F5F7] text-[#0D7A65] dark:bg-[#0D7A65]/10 dark:text-[#0D7A65]' : 'text-[#9BA5B7] hover:bg-[#F4F5F7] dark:hover:bg-[#1A2540]'}`}
                >
                  <Users size={14} />
                  <span>{activeChannel.members.length}</span>
                </button>
                {/* Search messages */}
                <button
                  onClick={() => { setShowSearch(!showSearch); if (showSearch) setMsgSearch('') }}
                  className={`p-1.5 rounded-lg transition-colors ${showSearch ? 'bg-[#F4F5F7] text-[#0D7A65] dark:bg-[#0D7A65]/10' : 'text-[#9BA5B7] hover:bg-[#F4F5F7] dark:hover:bg-[#1A2540]'}`}
                  title="Buscar mensajes"
                >
                  <Search size={15} />
                </button>
              </div>
            </div>

            {/* Search bar */}
            {showSearch && (
              <div className="px-4 py-2 border-b border-[#E3E6EC] dark:border-[#1A2540] bg-white dark:bg-[#0F1829] flex items-center gap-2">
                <Search size={14} className="text-[#9BA5B7] flex-shrink-0" />
                <input
                  autoFocus
                  type="text"
                  placeholder="Buscar en este canal..."
                  value={msgSearch}
                  onChange={e => setMsgSearch(e.target.value)}
                  className="flex-1 text-sm bg-transparent focus:outline-none text-[#0C1224] dark:text-slate-100"
                />
                {msgSearch && (
                  <span className="text-[11px] text-[#9BA5B7]">{filteredMessages.length} resultado{filteredMessages.length !== 1 ? 's' : ''}</span>
                )}
                <button onClick={() => { setMsgSearch(''); setShowSearch(false) }} className="text-[#9BA5B7] hover:text-[#68748D]">
                  <X size={14} />
                </button>
              </div>
            )}

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-5 space-y-3 bg-[#F4F5F7]/60 dark:bg-slate-950/60">
              {filteredMessages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-40 text-[#9BA5B7] gap-2">
                  <Hash size={28} className="opacity-20" />
                  <p className="text-sm">{msgSearch ? 'Sin resultados' : '¡Sé el primero en escribir!'}</p>
                </div>
              )}
              {filteredMessages.map((msg, i) => {
                const isMe = msg.senderId === profile?.uid
                const prevSame = i > 0 && filteredMessages[i - 1].senderId === msg.senderId
                return (
                  <div key={msg.id} className={`flex gap-2.5 ${isMe ? 'flex-row-reverse' : ''} ${prevSame ? 'mt-0.5' : 'mt-3'}`}>
                    {!isMe && (
                      <div className="w-7 flex-shrink-0 flex items-end">
                        {!prevSame && <Avatar name={msg.senderName} size={28} />}
                      </div>
                    )}
                    <div className={`max-w-[72%] flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                      {!prevSame && !isMe && (
                        <span className="text-[11px] font-bold text-[#68748D] dark:text-[#9BA5B7] mb-0.5 ml-1">{msg.senderName}</span>
                      )}
                      <div className={`px-3.5 py-2 rounded-lg text-sm leading-relaxed ${
                        isMe
                          ? 'bg-[#0C1224] text-white rounded-tr-sm'
                          : 'bg-white dark:bg-[#1A2540] text-[#0C1224] dark:text-slate-100 border border-[#E3E6EC] dark:border-[#1A2540] rounded-tl-sm shadow-sm'
                      }`}>
                        {msg.text.split(/(@\w+)/g).map((part, pi) =>
                          part.startsWith('@')
                            ? <span key={pi} className={`font-bold ${isMe ? 'text-blue-200' : 'text-[#0D7A65]'}`}>{part}</span>
                            : part
                        )}
                      </div>
                      <span className={`text-[10px] text-[#9BA5B7] mt-0.5 ${isMe ? 'mr-1' : 'ml-1'}`}>
                        {formatTime(msg.createdAt)}
                      </span>
                    </div>
                  </div>
                )
              })}
              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div className="p-4 bg-white dark:bg-[#0F1829] border-t border-[#E3E6EC] dark:border-[#1A2540] flex-shrink-0 relative">
              {/* @mention dropdown */}
              {mentionQuery !== null && mentionUsers.length > 0 && (
                <div className="absolute bottom-full left-4 mb-2 bg-white dark:bg-[#1A2540] border border-[#E3E6EC] dark:border-[#1A2540] rounded-md shadow-lg overflow-hidden z-20 w-56">
                  {mentionUsers.map(u => (
                    <button
                      key={u.uid}
                      onMouseDown={e => { e.preventDefault(); insertMention(u) }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-[#F4F5F7] dark:hover:bg-[#1A2540] transition-colors text-left"
                    >
                      <Avatar name={u.displayName || u.email || '?'} size={24} />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-[#0C1224] dark:text-[#E8ECF4] truncate">{u.displayName}</p>
                        <p className="text-[11px] text-[#9BA5B7] truncate">{u.email}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              <div className="flex gap-2 items-end">
                <div className="flex-1 bg-[#F4F5F7] dark:bg-[#1A2540] rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-[#0D7A65]">
                  <textarea
                    ref={textareaRef}
                    rows={1}
                    placeholder={`Mensaje${activeChannel.type === 'group' ? ` en #${activeChannel.name}` : ''}… (Enter para enviar, @ para mencionar)`}
                    value={text}
                    onChange={e => handleTextChange(e.target.value)}
                    onKeyDown={handleKey}
                    className="w-full px-4 py-3 bg-transparent text-sm resize-none focus:outline-none text-[#0C1224] dark:text-slate-100 max-h-32"
                    style={{ minHeight: 44 }}
                  />
                </div>
                <button
                  onClick={sendMessage}
                  disabled={!text.trim() || sending}
                  className="p-3 bg-[#0C1224] text-white rounded-lg hover:bg-[#1B2B4B] disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-sm"
                >
                  <Send size={17} />
                </button>
              </div>
              <p className="text-[11px] text-[#9BA5B7] mt-1.5 px-1">
                <AtSign size={10} className="inline mr-0.5" />Escribe @ para mencionar a alguien
              </p>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center bg-[#F4F5F7] dark:bg-slate-950 text-[#9BA5B7]">
            <div className="text-center">
              <MessageSquare size={40} className="mx-auto mb-3 opacity-20" />
              <p className="text-sm font-medium">Selecciona un canal o inicia un mensaje directo</p>
            </div>
          </div>
        )}

        {/* ── Members panel ── */}
        {activeChannel && showMembers && (
          <div className="w-56 flex-shrink-0 border-l border-[#E3E6EC] dark:border-[#1A2540] bg-white dark:bg-[#0F1829] flex flex-col overflow-hidden">
            <div className="p-4 border-b border-[#E3E6EC] dark:border-[#1A2540] flex items-center justify-between">
              <span className="text-xs font-bold text-[#0C1224] dark:text-[#E8ECF4] uppercase tracking-wide">Miembros ({channelMembers.length})</span>
              <button
                onClick={() => setAddingMember(!addingMember)}
                className="p-1 text-[#9BA5B7] hover:text-[#0D7A65] hover:bg-[#F4F5F7] dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                title="Añadir miembro"
              >
                <UserPlus size={14} />
              </button>
            </div>

            {/* Add member dropdown */}
            {addingMember && nonMembers.length > 0 && (
              <div className="border-b border-[#E3E6EC] dark:border-[#1A2540] p-2 max-h-40 overflow-y-auto">
                {nonMembers.map(u => (
                  <button
                    key={u.uid}
                    onClick={() => addMemberToChannel(u.uid)}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-[#F4F5F7] dark:hover:bg-[#1A2540] transition-colors text-left"
                  >
                    <Avatar name={u.displayName || u.email || '?'} size={22} />
                    <span className="text-xs text-[#0C1224] dark:text-[#9BA5B7] truncate">{u.displayName || u.email}</span>
                  </button>
                ))}
                {nonMembers.length === 0 && (
                  <p className="text-xs text-[#9BA5B7] text-center py-2">Todos ya son miembros</p>
                )}
              </div>
            )}

            {/* Member list */}
            <div className="flex-1 overflow-y-auto p-2">
              {channelMembers.map(u => (
                <div key={u.uid} className="flex items-center gap-2 px-2 py-2 rounded-lg">
                  <Avatar name={u.displayName || u.email || '?'} size={26} />
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-[#0C1224] dark:text-[#E8ECF4] truncate">
                      {u.displayName || u.email}
                      {u.uid === profile?.uid && <span className="text-[10px] text-[#9BA5B7] ml-1">(tú)</span>}
                    </p>
                    <p className="text-[10px] text-[#9BA5B7] capitalize">{u.role}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── New channel / DM modal ── */}
      {showNewChannel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={closeNewChannel}>
          <div className="w-full max-w-md bg-white dark:bg-[#0F1829] rounded-lg shadow-sm overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-[#E3E6EC] dark:border-[#1A2540] flex items-center justify-between">
              <h3 className="font-bold text-[#0C1224] dark:text-[#E8ECF4]">Nuevo canal</h3>
              <button onClick={closeNewChannel} className="text-[#9BA5B7] hover:text-[#68748D]">
                <X size={16} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Type selector */}
              <div className="grid grid-cols-3 gap-2">
                {([
                  { id: 'group', label: 'Canal', icon: Hash },
                  { id: 'deal', label: 'Deal', icon: Tag },
                  { id: 'direct', label: 'Mensaje directo', icon: MessageCircle },
                ] as { id: NewChannelType; label: string; icon: React.ComponentType<{ size?: number; className?: string }> }[]).map(t => (
                  <button
                    key={t.id}
                    onClick={() => setNewType(t.id)}
                    className={`flex flex-col items-center gap-1.5 p-3 rounded-md border-2 transition-colors text-xs font-bold ${
                      newType === t.id
                        ? 'border-[#0D7A65] bg-[#F4F5F7] dark:bg-[#0D7A65]/10 text-[#0D7A65]'
                        : 'border-[#E3E6EC] dark:border-[#1A2540] text-[#68748D] hover:border-[#E3E6EC]'
                    }`}
                  >
                    <t.icon size={18} />
                    {t.label}
                  </button>
                ))}
              </div>

              {/* Group: name */}
              {newType === 'group' && (
                <div>
                  <label className="block text-xs font-bold text-[#68748D] dark:text-[#9BA5B7] mb-1.5">Nombre del canal</label>
                  <div className="flex items-center gap-2 bg-[#F4F5F7] dark:bg-[#1A2540] border border-[#E3E6EC] dark:border-[#1A2540] rounded-md px-3 py-2.5">
                    <Hash size={15} className="text-[#9BA5B7] flex-shrink-0" />
                    <input
                      autoFocus
                      type="text"
                      placeholder="nombre-del-canal"
                      value={newName}
                      onChange={e => setNewName(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && createChannel()}
                      className="flex-1 bg-transparent text-sm focus:outline-none text-[#0C1224] dark:text-slate-100"
                    />
                  </div>
                </div>
              )}

              {/* Deal: pick deal */}
              {newType === 'deal' && (
                <div>
                  <label className="block text-xs font-bold text-[#68748D] dark:text-[#9BA5B7] mb-1.5">Seleccionar deal</label>
                  <div className="max-h-40 overflow-y-auto border border-[#E3E6EC] dark:border-[#1A2540] rounded-md divide-y divide-slate-100 dark:divide-slate-800">
                    {deals.length === 0 && <p className="text-xs text-[#9BA5B7] text-center py-4">Sin deals</p>}
                    {deals.map(d => (
                      <button
                        key={d.id}
                        onClick={() => setSelectedDeal(d)}
                        className={`w-full text-left px-3 py-2.5 flex items-center gap-2 transition-colors ${selectedDeal?.id === d.id ? 'bg-[#F4F5F7] dark:bg-[#0D7A65]/10' : 'hover:bg-[#F4F5F7] dark:hover:bg-[#1A2540]'}`}
                      >
                        <KanbanSquare size={13} className="text-amber-500 flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-[#0C1224] dark:text-[#E8ECF4] truncate">{d.clientId}</p>
                          {d.value !== undefined && <p className="text-xs text-[#9BA5B7]">${d.value.toLocaleString()} · {d.stage}</p>}
                        </div>
                        {selectedDeal?.id === d.id && <span className="ml-auto text-[#0D7A65] text-xs font-bold">✓</span>}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Direct: pick user */}
              {newType === 'direct' && (
                <div>
                  <label className="block text-xs font-bold text-[#68748D] dark:text-[#9BA5B7] mb-1.5">Enviar mensaje a</label>
                  <div className="max-h-48 overflow-y-auto border border-[#E3E6EC] dark:border-[#1A2540] rounded-md divide-y divide-slate-100 dark:divide-slate-800">
                    {orgUsers.filter(u => u.uid !== profile?.uid).length === 0 && (
                      <p className="text-xs text-[#9BA5B7] text-center py-4">Sin otros miembros en la organización</p>
                    )}
                    {orgUsers.filter(u => u.uid !== profile?.uid).map(u => (
                      <button
                        key={u.uid}
                        onClick={() => setSelectedUser(u)}
                        className={`w-full text-left px-3 py-2.5 flex items-center gap-2.5 transition-colors ${selectedUser?.uid === u.uid ? 'bg-[#F4F5F7] dark:bg-[#0D7A65]/10' : 'hover:bg-[#F4F5F7] dark:hover:bg-[#1A2540]'}`}
                      >
                        <Avatar name={u.displayName || u.email || '?'} size={28} />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-[#0C1224] dark:text-[#E8ECF4] truncate">{u.displayName}</p>
                          <p className="text-xs text-[#9BA5B7] capitalize">{u.role} · {u.email}</p>
                        </div>
                        {selectedUser?.uid === u.uid && <span className="ml-auto text-[#0D7A65] text-xs font-bold">✓</span>}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Members picker (group & deal) */}
              {(newType === 'group' || newType === 'deal') && orgUsers.filter(u => u.uid !== profile?.uid).length > 0 && (
                <div>
                  <label className="block text-xs font-bold text-[#68748D] dark:text-[#9BA5B7] mb-1.5">Añadir miembros (opcional)</label>
                  <div className="flex flex-wrap gap-1.5">
                    {orgUsers.filter(u => u.uid !== profile?.uid).map(u => {
                      const sel = selectedMembers.includes(u.uid)
                      return (
                        <button
                          key={u.uid}
                          onClick={() => setSelectedMembers(prev => sel ? prev.filter(id => id !== u.uid) : [...prev, u.uid])}
                          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                            sel ? 'bg-[#0C1224] text-white border-[#0D7A65]' : 'border-[#E3E6EC] dark:border-[#1A2540] text-[#68748D] dark:text-[#9BA5B7] hover:border-blue-300'
                          }`}
                        >
                          <Avatar name={u.displayName || u.email || '?'} size={16} />
                          {u.displayName?.split(' ')[0] || u.email?.split('@')[0]}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="px-5 pb-5">
              <button
                onClick={createChannel}
                disabled={creating || (newType === 'group' && !newName.trim()) || (newType === 'deal' && !selectedDeal) || (newType === 'direct' && !selectedUser)}
                className="w-full bg-[#0C1224] hover:bg-[#1B2B4B] disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold py-2.5 rounded-md transition-colors"
              >
                {creating ? 'Creando...' : newType === 'direct' ? 'Iniciar conversación' : 'Crear canal'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
