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
        className="flex items-center gap-2 w-full px-3 py-2 text-sm text-[#9BA5B7] dark:text-[#68748D] hover:text-[#68748D] dark:hover:text-[#9BA5B7] hover:bg-[#F4F5F7] dark:hover:bg-[#1A2540] rounded-lg transition-colors"
        title="Buscar (Ctrl+K)"
      >
        <Search size={16} />
        <span className="flex-1 text-left">Buscar...</span>
        <span className="text-xs bg-[#F4F5F7] dark:bg-[#1A2540] text-[#9BA5B7] dark:text-[#68748D] px-1.5 py-0.5 rounded font-mono">⌘K</span>
      </button>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] px-4 bg-black/50 backdrop-blur-sm" onClick={() => setOpen(false)}>
      <div
        className="w-full max-w-lg bg-white dark:bg-[#0F1829] rounded-lg shadow-sm border border-[#E3E6EC] dark:border-[#1A2540] overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-[#E3E6EC] dark:border-[#1A2540]">
          <Search size={18} className="text-[#9BA5B7] dark:text-[#68748D] flex-shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Buscar clientes, tareas, oportunidades..."
            className="flex-1 text-sm text-[#0C1224] dark:text-[#E8ECF4] bg-transparent outline-none placeholder:text-[#9BA5B7] dark:placeholder:text-[#68748D]"
          />
          {query && (
            <button onClick={() => setQuery('')} className="text-[#9BA5B7] dark:text-[#68748D] hover:text-[#68748D] dark:hover:text-[#9BA5B7]">
              <X size={16} />
            </button>
          )}
          <kbd className="text-xs text-[#9BA5B7] dark:text-[#68748D] bg-[#F4F5F7] dark:bg-[#1A2540] px-1.5 py-0.5 rounded">ESC</kbd>
        </div>

        {/* Results */}
        <div className="max-h-96 overflow-y-auto">
          {loading && (
            <div className="flex justify-center py-8">
              <div className="w-5 h-5 border-2 border-[#0D7A65] border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {!loading && q && !hasResults && (
            <div className="py-10 text-center text-sm text-[#9BA5B7] dark:text-[#68748D]">Sin resultados para "{query}"</div>
          )}

          {!loading && !q && (
            <div className="py-8 text-center text-sm text-[#9BA5B7] dark:text-[#68748D]">Escribe para buscar...</div>
          )}

          {filteredClients.length > 0 && (
            <div>
              <div className="px-4 py-2 text-xs font-bold text-[#9BA5B7] dark:text-[#68748D] uppercase tracking-wider bg-[#F4F5F7] dark:bg-[#1A2540]/50 border-b border-[#E3E6EC] dark:border-[#1A2540]">
                Clientes
              </div>
              {filteredClients.map(c => (
                <button
                  key={c.id}
                  onClick={() => navigate(`/dashboard/clients/${c.id}`)}
                  className="flex items-center gap-3 w-full px-4 py-3 hover:bg-[#F4F5F7] dark:hover:bg-[#1A2540] text-left border-b border-[#E3E6EC] dark:border-[#1A2540]/50 transition-colors"
                >
                  <div className="w-8 h-8 bg-[#F4F5F7] dark:bg-[#1A2540] rounded-full flex items-center justify-center flex-shrink-0">
                    <Users size={14} className="text-[#68748D] dark:text-[#9BA5B7]" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[#0C1224] dark:text-[#E8ECF4] truncate">{c.name}</p>
                    <p className="text-xs text-[#9BA5B7] dark:text-[#68748D] truncate">{c.email || c.phone || c.status}</p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {filteredTasks.length > 0 && (
            <div>
              <div className="px-4 py-2 text-xs font-bold text-[#9BA5B7] dark:text-[#68748D] uppercase tracking-wider bg-[#F4F5F7] dark:bg-[#1A2540]/50 border-b border-[#E3E6EC] dark:border-[#1A2540]">
                Tareas
              </div>
              {filteredTasks.map(t => (
                <button
                  key={t.id}
                  onClick={() => navigate('/dashboard/tasks')}
                  className="flex items-center gap-3 w-full px-4 py-3 hover:bg-[#F4F5F7] dark:hover:bg-[#1A2540] text-left border-b border-[#E3E6EC] dark:border-[#1A2540]/50 transition-colors"
                >
                  <div className="w-8 h-8 bg-[#F4F5F7] dark:bg-[#1A2540] rounded-full flex items-center justify-center flex-shrink-0">
                    <CheckSquare size={14} className={t.completed ? 'text-green-500' : 'text-[#68748D] dark:text-[#9BA5B7]'} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[#0C1224] dark:text-[#E8ECF4] truncate">{t.title}</p>
                    <p className="text-xs text-[#9BA5B7] dark:text-[#68748D]">{t.completed ? 'Completada' : 'Pendiente'}</p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {filteredDeals.length > 0 && (
            <div>
              <div className="px-4 py-2 text-xs font-bold text-[#9BA5B7] dark:text-[#68748D] uppercase tracking-wider bg-[#F4F5F7] dark:bg-[#1A2540]/50 border-b border-[#E3E6EC] dark:border-[#1A2540]">
                Oportunidades
              </div>
              {filteredDeals.map(d => {
                const client = clients.find(c => c.id === d.clientId)
                return (
                  <button
                    key={d.id}
                    onClick={() => navigate('/dashboard/pipeline')}
                    className="flex items-center gap-3 w-full px-4 py-3 hover:bg-[#F4F5F7] dark:hover:bg-[#1A2540] text-left border-b border-[#E3E6EC] dark:border-[#1A2540]/50 transition-colors"
                  >
                    <div className="w-8 h-8 bg-[#F4F5F7] dark:bg-[#1A2540] rounded-full flex items-center justify-center flex-shrink-0">
                      <FolderKanban size={14} className="text-[#68748D] dark:text-[#9BA5B7]" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[#0C1224] dark:text-[#E8ECF4] truncate">{client?.name || 'Sin cliente'}</p>
                      <p className="text-xs text-[#9BA5B7] dark:text-[#68748D]">{d.stage} {d.value ? `· $${d.value.toLocaleString()}` : ''}</p>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer hint */}
        <div className="px-4 py-2.5 border-t border-[#E3E6EC] dark:border-[#1A2540] flex gap-4 text-xs text-[#9BA5B7] dark:text-[#68748D]">
          <span><kbd className="bg-[#F4F5F7] dark:bg-[#1A2540] px-1 rounded">↵</kbd> seleccionar</span>
          <span><kbd className="bg-[#F4F5F7] dark:bg-[#1A2540] px-1 rounded">ESC</kbd> cerrar</span>
        </div>
      </div>
    </div>
  )
}
