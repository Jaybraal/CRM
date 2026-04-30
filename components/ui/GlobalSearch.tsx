'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { getClients, getTasks, getDeals } from '@/lib/firestore'
import type { Client, Task, Deal } from '@/types'
import { Search, Users, CheckSquare, FolderKanban, X } from 'lucide-react'

export default function GlobalSearch() {
  const { profile } = useAuth()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [clients, setClients] = useState<Client[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [deals, setDeals] = useState<Deal[]>([])
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Load data once when search opens
  const loadData = useCallback(async () => {
    if (!profile?.orgId || clients.length > 0) return
    setLoading(true)
    const [c, t, d] = await Promise.all([
      getClients(profile.orgId),
      getTasks(profile.orgId),
      getDeals(profile.orgId),
    ])
    setClients(c)
    setTasks(t)
    setDeals(d)
    setLoading(false)
  }, [profile?.orgId, clients.length])

  // Keyboard shortcut Cmd+K / Ctrl+K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen(v => !v)
      }
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  useEffect(() => {
    if (open) {
      loadData()
      setTimeout(() => inputRef.current?.focus(), 50)
    } else {
      setQuery('')
    }
  }, [open, loadData])

  const q = query.toLowerCase().trim()

  const filteredClients = q.length >= 1
    ? clients.filter(c => c.name.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q) || c.phone?.includes(q)).slice(0, 5)
    : []

  const filteredTasks = q.length >= 1
    ? tasks.filter(t => t.title.toLowerCase().includes(q)).slice(0, 3)
    : []

  const filteredDeals = q.length >= 1
    ? deals.filter(d => {
        const client = clients.find(c => c.id === d.clientId)
        return d.notes?.toLowerCase().includes(q) || client?.name.toLowerCase().includes(q)
      }).slice(0, 3)
    : []

  const hasResults = filteredClients.length + filteredTasks.length + filteredDeals.length > 0

  const navigate = (href: string) => {
    router.push(href)
    setOpen(false)
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 w-full px-3 py-2 text-sm text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-colors"
        title="Buscar (Ctrl+K)"
      >
        <Search size={16} />
        <span className="flex-1 text-left">Buscar...</span>
        <span className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 px-1.5 py-0.5 rounded font-mono">⌘K</span>
      </button>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] px-4 bg-black/50 backdrop-blur-sm" onClick={() => setOpen(false)}>
      <div
        className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100 dark:border-slate-800">
          <Search size={18} className="text-slate-400 dark:text-slate-500 flex-shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Buscar clientes, tareas, oportunidades..."
            className="flex-1 text-sm text-slate-900 dark:text-white bg-transparent outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500"
          />
          {query && (
            <button onClick={() => setQuery('')} className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300">
              <X size={16} />
            </button>
          )}
          <kbd className="text-xs text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">ESC</kbd>
        </div>

        {/* Results */}
        <div className="max-h-96 overflow-y-auto">
          {loading && (
            <div className="flex justify-center py-8">
              <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {!loading && q && !hasResults && (
            <div className="py-10 text-center text-sm text-slate-400 dark:text-slate-500">Sin resultados para "{query}"</div>
          )}

          {!loading && !q && (
            <div className="py-8 text-center text-sm text-slate-400 dark:text-slate-500">Escribe para buscar...</div>
          )}

          {filteredClients.length > 0 && (
            <div>
              <div className="px-4 py-2 text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
                Clientes
              </div>
              {filteredClients.map(c => (
                <button
                  key={c.id}
                  onClick={() => navigate(`/dashboard/clients/${c.id}`)}
                  className="flex items-center gap-3 w-full px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800 text-left border-b border-slate-100 dark:border-slate-800/50 transition-colors"
                >
                  <div className="w-8 h-8 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center flex-shrink-0">
                    <Users size={14} className="text-slate-500 dark:text-slate-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{c.name}</p>
                    <p className="text-xs text-slate-400 dark:text-slate-500 truncate">{c.email || c.phone || c.status}</p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {filteredTasks.length > 0 && (
            <div>
              <div className="px-4 py-2 text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
                Tareas
              </div>
              {filteredTasks.map(t => (
                <button
                  key={t.id}
                  onClick={() => navigate('/dashboard/tasks')}
                  className="flex items-center gap-3 w-full px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800 text-left border-b border-slate-100 dark:border-slate-800/50 transition-colors"
                >
                  <div className="w-8 h-8 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center flex-shrink-0">
                    <CheckSquare size={14} className={t.completed ? 'text-green-500' : 'text-slate-500 dark:text-slate-400'} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{t.title}</p>
                    <p className="text-xs text-slate-400 dark:text-slate-500">{t.completed ? 'Completada' : 'Pendiente'}</p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {filteredDeals.length > 0 && (
            <div>
              <div className="px-4 py-2 text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
                Oportunidades
              </div>
              {filteredDeals.map(d => {
                const client = clients.find(c => c.id === d.clientId)
                return (
                  <button
                    key={d.id}
                    onClick={() => navigate('/dashboard/pipeline')}
                    className="flex items-center gap-3 w-full px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800 text-left border-b border-slate-100 dark:border-slate-800/50 transition-colors"
                  >
                    <div className="w-8 h-8 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center flex-shrink-0">
                      <FolderKanban size={14} className="text-slate-500 dark:text-slate-400" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{client?.name || 'Sin cliente'}</p>
                      <p className="text-xs text-slate-400 dark:text-slate-500">{d.stage} {d.value ? `· $${d.value.toLocaleString()}` : ''}</p>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer hint */}
        <div className="px-4 py-2.5 border-t border-slate-100 dark:border-slate-800 flex gap-4 text-xs text-slate-400 dark:text-slate-500">
          <span><kbd className="bg-slate-100 dark:bg-slate-800 px-1 rounded">↵</kbd> seleccionar</span>
          <span><kbd className="bg-slate-100 dark:bg-slate-800 px-1 rounded">ESC</kbd> cerrar</span>
        </div>
      </div>
    </div>
  )
}
