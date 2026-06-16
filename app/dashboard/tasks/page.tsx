'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { getTasks, createTask, updateTask, deleteTask, getClients } from '@/lib/firestore'
import type { Task, Client } from '@/types'
import Modal from '@/components/ui/Modal'
import { Plus, CheckCircle, Circle, Trash2, CalendarDays, AlertCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import { Spinner } from '@/components/ui/primitives'

const inputClass = 'w-full bg-[#F4F5F7] dark:bg-[#1A2540] border border-[#E3E6EC] dark:border-[#1A2540] rounded-md px-4 py-2.5 text-[#0C1224] dark:text-[#E8ECF4] focus:outline-none focus:border-[#0D7A65] focus:ring-1 focus:ring-[#0D7A65]/10 text-sm transition-colors'
const labelClass = 'block text-sm font-bold text-[#0C1224] dark:text-[#9BA5B7] mb-1.5'

export default function TasksPage() {
  const { profile } = useAuth()
  const [tasks, setTasks] = useState<Task[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [filter, setFilter] = useState<'all' | 'pending' | 'overdue' | 'done'>('all')
  const [form, setForm] = useState({ title: '', description: '', clientId: '', dueDate: '' })

  const load = async () => {
    if (!profile?.orgId) { setLoading(false); return }
    try {
      const [t, c] = await Promise.all([
        getTasks(profile.orgId, profile.role === 'agent' ? profile.uid : undefined),
        getClients(profile.orgId),
      ])
      setTasks(t); setClients(c)
    } catch (e) { console.error(e) }
    setLoading(false)
  }

  useEffect(() => { load() }, [profile])

  const isOverdue = (task: Task) => {
    if (task.completed || !task.dueDate) return false
    const due = (task.dueDate as unknown as { seconds: number })?.seconds
      ? new Date((task.dueDate as unknown as { seconds: number }).seconds * 1000)
      : new Date(task.dueDate as unknown as string)
    return due < new Date()
  }

  const filtered = tasks.filter(t => {
    if (filter === 'pending') return !t.completed
    if (filter === 'done') return t.completed
    if (filter === 'overdue') return isOverdue(t)
    return true
  })

  const overdueCount = tasks.filter(isOverdue).length

  const toggleTask = async (task: Task) => {
    if (!profile?.orgId) return
    await updateTask(profile.orgId, task.id, { completed: !task.completed })
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, completed: !t.completed } : t))
  }

  const handleDelete = async (id: string) => {
    if (!profile?.orgId) return
    await deleteTask(profile.orgId, id)
    toast.success('Tarea eliminada')
    load()
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profile?.orgId) return
    try {
      await createTask(profile.orgId, {
        title: form.title, description: form.description,
        clientId: form.clientId || undefined,
        dueDate: form.dueDate ? new Date(form.dueDate) : undefined,
        assignedTo: profile.uid, completed: false,
      })
      toast.success('Tarea creada')
      setShowForm(false)
      setForm({ title: '', description: '', clientId: '', dueDate: '' })
      load()
    } catch { toast.error('Error al crear') }
  }

  const getClientName = (id?: string) => clients.find(c => c.id === id)?.name

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#0C1224] dark:text-[#E8ECF4]">Tareas</h1>
          <p className="text-[#68748D] dark:text-[#9BA5B7] text-sm mt-1">
            <span className="text-[#0D7A65] font-bold">{tasks.filter(t => !t.completed).length}</span> pendientes
          </p>
        </div>
        <button onClick={() => setShowForm(true)} className="flex items-center gap-2 bg-[#0C1224] hover:bg-[#1B2B4B] text-white px-4 py-2.5 rounded-md text-sm font-bold shadow-lg transition-all self-start sm:self-auto">
          <Plus size={17} /> Nueva tarea
        </button>
      </div>

      {/* Filtros */}
      <div className="flex gap-2 flex-wrap">
        {(['all', 'pending', 'overdue', 'done'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-bold transition-colors ${
              filter === f
                ? f === 'overdue' ? 'bg-red-600 text-white shadow-lg' : 'bg-[#0C1224] text-white shadow-lg'
                : 'bg-white dark:bg-[#1A2540] text-[#68748D] dark:text-[#9BA5B7] border border-[#E3E6EC] dark:border-[#1A2540] hover:border-blue-300'
            }`}>
            {f === 'overdue' && <AlertCircle size={13} />}
            {{ all: 'Todas', pending: 'Pendientes', overdue: `Vencidas${overdueCount > 0 ? ` (${overdueCount})` : ''}`, done: 'Completadas' }[f]}
          </button>
        ))}
      </div>

      {loading ? (
        <Spinner />
      ) : filtered.length === 0 ? (
        <div className="bg-white dark:bg-[#0F1829] border border-[#E3E6EC] dark:border-[#1A2540] rounded-lg p-16 text-center shadow-sm">
          <p className="text-[#9BA5B7] dark:text-[#68748D]">No hay tareas en esta vista.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(task => (
            <div key={task.id} className={`bg-white dark:bg-[#0F1829] border rounded-lg p-4 flex items-start gap-4 transition-all hover:shadow-sm ${
              task.completed ? 'border-[#E3E6EC] dark:border-[#1A2540] opacity-60' : isOverdue(task) ? 'border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/10' : 'border-[#E3E6EC] dark:border-[#1A2540]'
            }`}>
              <button onClick={() => toggleTask(task)} className="mt-0.5 flex-shrink-0 text-[#9BA5B7] hover:text-[#0D7A65] transition-colors">
                {task.completed ? <CheckCircle size={20} className="text-emerald-500" /> : <Circle size={20} />}
              </button>
              <div className="flex-1 min-w-0">
                <p className={`font-bold text-sm ${task.completed ? 'line-through text-[#9BA5B7]' : 'text-[#0C1224] dark:text-[#E8ECF4]'}`}>
                  {task.title}
                </p>
                {task.description && <p className="text-xs text-[#9BA5B7] dark:text-[#68748D] mt-0.5">{task.description}</p>}
                <div className="flex flex-wrap gap-3 mt-2 text-xs text-[#9BA5B7]">
                  {task.clientId && getClientName(task.clientId) && (
                    <span>Cliente: <span className="text-[#68748D] dark:text-[#9BA5B7] font-medium">{getClientName(task.clientId)}</span></span>
                  )}
                  {task.dueDate && (
                    <span className={`flex items-center gap-1 font-medium ${isOverdue(task) ? 'text-red-600' : 'text-[#68748D] dark:text-[#9BA5B7]'}`}>
                      {isOverdue(task) ? <AlertCircle size={11} /> : <CalendarDays size={11} />}
                      {(() => {
                        const due = (task.dueDate as unknown as { seconds: number })?.seconds
                          ? new Date((task.dueDate as unknown as { seconds: number }).seconds * 1000)
                          : new Date(task.dueDate as unknown as string)
                        return due.toLocaleDateString('es')
                      })()}
                    </span>
                  )}
                </div>
              </div>
              <button onClick={() => handleDelete(task.id)} className="text-[#9BA5B7] hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 p-1.5 rounded-md transition-colors">
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
      )}

      <Modal open={showForm} onClose={() => setShowForm(false)} title="Nueva tarea" size="sm">
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className={labelClass}>Título *</label>
            <input required value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className={inputClass} placeholder="Descripción corta de la tarea" />
          </div>
          <div>
            <label className={labelClass}>Descripción</label>
            <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} className={`${inputClass} resize-none`} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Cliente</label>
              <select value={form.clientId} onChange={e => setForm(f => ({ ...f, clientId: e.target.value }))} className={inputClass}>
                <option value="">Ninguno</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Fecha límite</label>
              <input type="date" value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} className={inputClass} />
            </div>
          </div>
          <button type="submit" className="w-full bg-[#0C1224] hover:bg-[#1B2B4B] text-white font-bold py-2.5 rounded-md transition-colors">
            Crear tarea
          </button>
        </form>
      </Modal>
    </div>
  )
}
