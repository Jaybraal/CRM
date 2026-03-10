'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { getTasks, createTask, updateTask, deleteTask, getClients } from '@/lib/firestore'
import type { Task, Client } from '@/types'
import Modal from '@/components/ui/Modal'
import { Plus, CheckCircle, Circle, Trash2, CalendarDays, AlertCircle } from 'lucide-react'
import toast from 'react-hot-toast'

const inputClass = 'w-full bg-white border border-gray-300 rounded-lg px-4 py-2.5 text-gray-900 focus:outline-none focus:border-gray-500'
const labelClass = 'block text-sm font-medium text-gray-700 mb-1.5'

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
    const [t, c] = await Promise.all([
      getTasks(profile.orgId, profile.role === 'agent' ? profile.uid : undefined),
      getClients(profile.orgId),
    ])
    setTasks(t); setClients(c); setLoading(false)
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
        title: form.title,
        description: form.description,
        clientId: form.clientId || undefined,
        dueDate: form.dueDate ? new Date(form.dueDate) : undefined,
        assignedTo: profile.uid,
        completed: false,
      })
      toast.success('Tarea creada')
      setShowForm(false)
      setForm({ title: '', description: '', clientId: '', dueDate: '' })
      load()
    } catch {
      toast.error('Error al crear')
    }
  }

  const getClientName = (id?: string) => clients.find(c => c.id === id)?.name

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tareas</h1>
          <p className="text-gray-500 text-sm mt-1">
            {tasks.filter(t => !t.completed).length} pendientes
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-gray-900 hover:bg-gray-800 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
        >
          <Plus size={18} /> Nueva tarea
        </button>
      </div>

      {/* Filtros */}
      <div className="flex gap-2 flex-wrap">
        {(['all', 'pending', 'overdue', 'done'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              filter === f
                ? f === 'overdue' ? 'bg-red-600 text-white' : 'bg-gray-900 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {f === 'overdue' && <AlertCircle size={13} />}
            {{ all: 'Todas', pending: 'Pendientes', overdue: `Vencidas${overdueCount > 0 ? ` (${overdueCount})` : ''}`, done: 'Completadas' }[f]}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-gray-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
          <p className="text-gray-400">No hay tareas en esta vista.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(task => (
            <div
              key={task.id}
              className={`bg-white border rounded-xl p-4 flex items-start gap-4 transition-colors ${
                task.completed ? 'border-gray-100 opacity-60' : isOverdue(task) ? 'border-red-200 bg-red-50' : 'border-gray-200'
              }`}
            >
              <button onClick={() => toggleTask(task)} className="mt-0.5 flex-shrink-0 text-gray-300 hover:text-gray-500 transition-colors">
                {task.completed ? <CheckCircle size={20} className="text-green-500" /> : <Circle size={20} />}
              </button>
              <div className="flex-1 min-w-0">
                <p className={`font-medium ${task.completed ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                  {task.title}
                </p>
                {task.description && (
                  <p className="text-sm text-gray-400 mt-0.5">{task.description}</p>
                )}
                <div className="flex flex-wrap gap-3 mt-2 text-xs text-gray-400">
                  {task.clientId && getClientName(task.clientId) && (
                    <span>Cliente: <span className="text-gray-600">{getClientName(task.clientId)}</span></span>
                  )}
                  {task.dueDate && (
                    <span className={`flex items-center gap-1 ${isOverdue(task) ? 'text-red-600 font-medium' : ''}`}>
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
              <button
                onClick={() => handleDelete(task.id)}
                className="text-gray-300 hover:text-red-500 hover:bg-red-50 p-1.5 rounded-lg transition-colors"
              >
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
            <input required value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              className={inputClass} placeholder="Descripción corta de la tarea" />
          </div>
          <div>
            <label className={labelClass}>Descripción</label>
            <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              rows={2} className={`${inputClass} resize-none`} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Cliente</label>
              <select value={form.clientId} onChange={e => setForm(f => ({ ...f, clientId: e.target.value }))}
                className={inputClass}>
                <option value="">Ninguno</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Fecha límite</label>
              <input type="date" value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))}
                className={inputClass} />
            </div>
          </div>
          <button type="submit" className="w-full bg-gray-900 hover:bg-gray-800 text-white font-semibold py-2.5 rounded-lg transition-colors">
            Crear tarea
          </button>
        </form>
      </Modal>
    </div>
  )
}
