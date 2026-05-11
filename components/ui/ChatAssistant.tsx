'use client'

import { useState, useRef, useEffect } from 'react'
import { MessageCircle, X, Send, Bot, CheckCircle2, UserPlus, Search } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'

interface Message {
  role: 'user' | 'assistant'
  content: string
  toolsUsed?: string[]
}

const TOOL_LABELS: Record<string, { label: string; icon: React.ReactNode }> = {
  crear_tarea:          { label: 'Tarea creada',       icon: <CheckCircle2 size={11} /> },
  crear_lead:           { label: 'Lead creado',        icon: <UserPlus size={11} /> },
  buscar_clientes:      { label: 'Buscó clientes',     icon: <Search size={11} /> },
  ver_tareas:           { label: 'Tareas consultadas', icon: <CheckCircle2 size={11} /> },
  ver_pipeline:         { label: 'Pipeline consultado',icon: <Search size={11} /> },
  ver_citas:            { label: 'Citas consultadas',  icon: <Search size={11} /> },
  ver_resumen_clientes: { label: 'Resumen clientes',   icon: <Search size={11} /> },
  completar_tarea:      { label: 'Tarea completada',   icon: <CheckCircle2 size={11} /> },
  mover_deal:           { label: 'Deal movido',        icon: <CheckCircle2 size={11} /> },
  agendar_cita:         { label: 'Cita agendada',      icon: <UserPlus size={11} /> },
}

export default function ChatAssistant() {
  const { profile } = useAuth()
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  async function send() {
    const text = input.trim()
    if (!text || loading) return

    const updated: Message[] = [...messages, { role: 'user', content: text }]
    setMessages(updated)
    setInput('')
    setLoading(true)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: updated.map(m => ({ role: m.role, content: m.content })),
          orgId: profile?.orgId,
          uid: profile?.uid,
        }),
      })
      const data = await res.json()
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: data.reply ?? data.error, toolsUsed: data.toolsUsed },
      ])
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Error al conectar con Alex.' }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {open && (
        <div className="fixed bottom-20 right-4 sm:right-6 z-50 w-80 sm:w-96 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3 bg-blue-600 text-white flex-shrink-0">
            <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center">
              <Bot size={15} />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold leading-none">Alex</p>
              <p className="text-[10px] text-blue-200 mt-0.5">Asistente IA · NexoCRM</p>
            </div>
            <button onClick={() => setOpen(false)} className="hover:opacity-70 transition-opacity">
              <X size={18} />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 max-h-80">
            {messages.length === 0 && (
              <div className="text-center mt-4 space-y-2">
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Hola <span className="font-semibold">{profile?.displayName?.split(' ')[0]}</span>, soy Alex.
                </p>
                <p className="text-[11px] text-slate-400">Puedo crear tareas, agregar leads, buscar clientes y más.</p>
              </div>
            )}

            {messages.map((m, i) => (
              <div key={i} className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
                {/* Tool badges */}
                {m.toolsUsed?.length ? (
                  <div className="flex flex-wrap gap-1 mb-1">
                    {m.toolsUsed.map(t => (
                      <span key={t} className="flex items-center gap-1 text-[10px] bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 px-2 py-0.5 rounded-full font-medium">
                        {TOOL_LABELS[t]?.icon}
                        {TOOL_LABELS[t]?.label ?? t}
                      </span>
                    ))}
                  </div>
                ) : null}
                <div className={`max-w-[82%] px-3 py-2 rounded-xl text-xs leading-relaxed whitespace-pre-wrap ${
                  m.role === 'user'
                    ? 'bg-blue-600 text-white rounded-br-none'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-bl-none'
                }`}>
                  {m.content}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="bg-slate-100 dark:bg-slate-800 px-3 py-2.5 rounded-xl rounded-bl-none">
                  <div className="flex gap-1 items-center">
                    <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:0ms]" />
                    <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:150ms]" />
                    <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:300ms]" />
                  </div>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="flex items-center gap-2 px-3 py-3 border-t border-slate-100 dark:border-slate-800 flex-shrink-0">
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
              placeholder="Escríbele a Alex..."
              className="flex-1 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 outline-none focus:border-blue-500 text-slate-700 dark:text-slate-200 placeholder-slate-400"
            />
            <button
              onClick={send}
              disabled={!input.trim() || loading}
              className="p-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-xl transition-colors flex-shrink-0"
            >
              <Send size={15} />
            </button>
          </div>
        </div>
      )}

      {/* FAB */}
      <button
        onClick={() => setOpen(o => !o)}
        className="fixed bottom-4 right-4 sm:right-6 z-50 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl shadow-lg shadow-blue-500/30 flex items-center justify-center transition-all hover:scale-105 active:scale-95"
        style={{ width: 52, height: 52 }}
      >
        {open ? <X size={22} /> : <MessageCircle size={22} />}
      </button>
    </>
  )
}
