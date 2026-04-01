'use client'

import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '@/context/AuthContext'
import { getTasks, updateTask, getAppointments, createAppointment, deleteAppointment } from '@/lib/firestore'
import type { Task, Appointment } from '@/types'
import { ChevronLeft, ChevronRight, CheckSquare, AlertCircle, CalendarPlus, Clock, Trash2, X } from 'lucide-react'
import toast from 'react-hot-toast'

function getTs(d: unknown): Date | null {
  if (!d) return null
  if (d instanceof Date) return d
  if (typeof d === 'object' && 'seconds' in (d as object)) return new Date((d as { seconds: number }).seconds * 1000)
  return null
}

function toDateInputValue(d: Date) {
  return d.toISOString().slice(0, 10)
}

function toTimeStr(d: Date) {
  return d.toTimeString().slice(0, 5)
}

interface ApptForm {
  title: string
  description: string
  clientName: string
  startDate: string
  startTime: string
  endTime: string
}

const EMPTY_FORM: ApptForm = {
  title: '', description: '', clientName: '',
  startDate: toDateInputValue(new Date()),
  startTime: '09:00', endTime: '10:00',
}

export default function CalendarPage() {
  const { profile } = useAuth()
  const [tasks, setTasks] = useState<Task[]>([])
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)
  const [current, setCurrent] = useState(new Date())
  const [showApptModal, setShowApptModal] = useState(false)
  const [apptForm, setApptForm] = useState<ApptForm>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [selectedDay, setSelectedDay] = useState<number | null>(null)

  const year = current.getFullYear()
  const month = current.getMonth()
  const today = new Date()

  const load = useCallback(async () => {
    if (!profile?.orgId) { setLoading(false); return }
    const uid = profile.role === 'agent' ? profile.uid : undefined
    const [t, a] = await Promise.all([
      getTasks(profile.orgId, uid),
      getAppointments(profile.orgId, uid),
    ])
    setTasks(t)
    setAppointments(a)
    setLoading(false)
  }, [profile])

  useEffect(() => { if (profile) load() }, [profile, load])

  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells: Array<number | null> = [
    ...Array(firstDay === 0 ? 6 : firstDay - 1).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]

  const getTasksForDay = (day: number) =>
    tasks.filter(t => {
      const due = getTs(t.dueDate)
      return due && due.getFullYear() === year && due.getMonth() === month && due.getDate() === day
    })

  const getApptsForDay = (day: number) =>
    appointments.filter(a => {
      const start = getTs(a.startDate)
      return start && start.getFullYear() === year && start.getMonth() === month && start.getDate() === day
    })

  const toggleTask = async (task: Task) => {
    if (!profile?.orgId) return
    await updateTask(profile.orgId, task.id, { completed: !task.completed })
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, completed: !t.completed } : t))
    toast.success(task.completed ? 'Tarea reabierta' : 'Tarea completada')
  }

  const handleDeleteAppt = async (apptId: string) => {
    if (!profile?.orgId) return
    await deleteAppointment(profile.orgId, apptId)
    setAppointments(prev => prev.filter(a => a.id !== apptId))
    toast.success('Cita eliminada')
  }

  const openNewAppt = (day?: number) => {
    const date = day ? new Date(year, month, day) : new Date()
    setApptForm({ ...EMPTY_FORM, startDate: toDateInputValue(date) })
    setSelectedDay(null)
    setShowApptModal(true)
  }

  const handleCreateAppt = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profile?.orgId) return
    setSaving(true)
    try {
      const [h, m] = apptForm.startTime.split(':').map(Number)
      const [yyyy, mm, dd] = apptForm.startDate.split('-').map(Number)
      const startDate = new Date(yyyy, mm - 1, dd, h, m, 0, 0)

      let endDate: Date | undefined
      if (apptForm.endTime) {
        const [eh, em] = apptForm.endTime.split(':').map(Number)
        endDate = new Date(yyyy, mm - 1, dd, eh, em, 0, 0)
      }

      await createAppointment(profile.orgId, {
        title: apptForm.title,
        description: apptForm.description || undefined,
        clientName: apptForm.clientName || undefined,
        assignedTo: profile.uid,
        assignedToName: profile.displayName,
        startDate,
        endDate,
      })
      toast.success('Cita agendada')
      setShowApptModal(false)
      setApptForm(EMPTY_FORM)
      load()
    } catch {
      toast.error('Error al agendar cita')
    } finally {
      setSaving(false)
    }
  }

  const monthName = current.toLocaleDateString('es', { month: 'long', year: 'numeric' })
  const tasksDueThisMonth = tasks.filter(t => {
    const due = getTs(t.dueDate)
    return due && due.getFullYear() === year && due.getMonth() === month
  })
  const apptsThisMonth = appointments.filter(a => {
    const start = getTs(a.startDate)
    return start && start.getFullYear() === year && start.getMonth() === month
  })
  const overdue = tasksDueThisMonth.filter(t => {
    const due = getTs(t.dueDate)
    return !t.completed && due && due < today
  })

  const dayItems = selectedDay !== null ? {
    tasks: getTasksForDay(selectedDay),
    appts: getApptsForDay(selectedDay),
  } : null

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Calendario</h1>
          <p className="text-gray-500 text-sm mt-1">
            {tasksDueThisMonth.length} tareas · {apptsThisMonth.length} citas este mes
            {overdue.length > 0 && <span className="text-red-500 ml-2">· {overdue.length} vencidas</span>}
          </p>
        </div>
        <button
          onClick={() => openNewAppt()}
          className="flex items-center gap-2 bg-gray-900 hover:bg-gray-800 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors self-start sm:self-auto"
        >
          <CalendarPlus size={16} /> Nueva cita
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-gray-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <button onClick={() => setCurrent(new Date(year, month - 1, 1))} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <ChevronLeft size={18} className="text-gray-600" />
            </button>
            <h2 className="font-semibold text-gray-900 capitalize">{monthName}</h2>
            <button onClick={() => setCurrent(new Date(year, month + 1, 1))} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <ChevronRight size={18} className="text-gray-600" />
            </button>
          </div>

          <div className="flex items-center gap-4 px-6 py-2 border-b border-gray-100 bg-gray-50 text-xs text-gray-500">
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-blue-100 inline-block" /> Cita</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-gray-200 inline-block" /> Tarea</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-red-100 inline-block" /> Vencida</span>
          </div>

          <div className="grid grid-cols-7 border-b border-gray-100">
            {[['L','Lun'], ['M','Mar'], ['X','Mié'], ['J','Jue'], ['V','Vie'], ['S','Sáb'], ['D','Dom']].map(([short, full]) => (
              <div key={full} className="text-center text-xs font-medium text-gray-400 py-2">
                <span className="sm:hidden">{short}</span>
                <span className="hidden sm:inline">{full}</span>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7">
            {cells.map((day, idx) => {
              if (!day) return <div key={`empty-${idx}`} className="min-h-14 sm:min-h-24 border-b border-r border-gray-100 bg-gray-50/50" />
              const dayTasks = getTasksForDay(day)
              const dayAppts = getApptsForDay(day)
              const total = dayTasks.length + dayAppts.length
              const isToday = today.getDate() === day && today.getMonth() === month && today.getFullYear() === year
              const isWeekend = (idx % 7) >= 5

              return (
                <div
                  key={day}
                  onClick={() => {
                    if (total > 0) setSelectedDay(day)
                    else openNewAppt(day)
                  }}
                  className={`min-h-14 sm:min-h-24 border-b border-r border-gray-100 p-1 sm:p-2 cursor-pointer group hover:bg-blue-50/20 transition-colors ${isWeekend ? 'bg-gray-50/30' : ''}`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className={`w-6 h-6 flex items-center justify-center text-xs font-medium rounded-full ${isToday ? 'bg-gray-900 text-white' : 'text-gray-600'}`}>
                      {day}
                    </div>
                    {total === 0 && <span className="text-blue-300 text-xs opacity-0 group-hover:opacity-100 transition-opacity">+</span>}
                  </div>
                  <div className="space-y-1">
                    {dayAppts.slice(0, 2).map(a => (
                      <div key={a.id} className="text-xs px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 flex items-center gap-1 truncate">
                        <Clock size={9} className="flex-shrink-0" />
                        <span className="truncate">{a.title}</span>
                      </div>
                    ))}
                    {dayTasks.slice(0, Math.max(0, 2 - dayAppts.length)).map(t => {
                      const isOverdue = !t.completed && getTs(t.dueDate) && getTs(t.dueDate)! < today
                      return (
                        <div
                          key={t.id}
                          onClick={e => { e.stopPropagation(); toggleTask(t) }}
                          className={`text-xs px-1.5 py-0.5 rounded flex items-center gap-1 truncate cursor-pointer ${
                            t.completed ? 'bg-green-50 text-green-700 line-through'
                            : isOverdue ? 'bg-red-50 text-red-700'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          <CheckSquare size={9} className="flex-shrink-0 opacity-60" />
                          <span className="truncate">{t.title}</span>
                        </div>
                      )
                    })}
                    {total > 2 && <p className="text-xs text-gray-400 text-center">+{total - 2} más</p>}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Lista citas del mes */}
      {apptsThisMonth.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h2 className="font-semibold text-gray-900 text-sm mb-4">Citas este mes</h2>
          <div className="space-y-2">
            {apptsThisMonth
              .sort((a, b) => (getTs(a.startDate)?.getTime() ?? 0) - (getTs(b.startDate)?.getTime() ?? 0))
              .map(a => {
                const start = getTs(a.startDate)
                const end = a.endDate ? getTs(a.endDate) : null
                return (
                  <div key={a.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-2 h-2 rounded-full bg-blue-400 flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{a.title}</p>
                        {a.clientName && <p className="text-xs text-gray-400">{a.clientName}</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0 ml-4">
                      {start && (
                        <span className="text-xs text-gray-400">
                          {start.toLocaleDateString('es', { day: 'numeric', month: 'short' })} · {toTimeStr(start)}{end ? ` - ${toTimeStr(end)}` : ''}
                        </span>
                      )}
                      <button onClick={() => handleDeleteAppt(a.id)} className="text-gray-300 hover:text-red-500 transition-colors">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                )
              })}
          </div>
        </div>
      )}

      {/* Tareas pendientes */}
      {tasksDueThisMonth.filter(t => !t.completed).length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h2 className="font-semibold text-gray-900 text-sm mb-4">Tareas pendientes este mes</h2>
          <div className="space-y-2">
            {tasksDueThisMonth
              .filter(t => !t.completed)
              .sort((a, b) => (getTs(a.dueDate)?.getTime() ?? 0) - (getTs(b.dueDate)?.getTime() ?? 0))
              .slice(0, 10)
              .map(t => {
                const due = getTs(t.dueDate)
                const isOverdue = due && due < today
                return (
                  <div key={t.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                    <button onClick={() => toggleTask(t)} className="flex items-center gap-2 flex-1 min-w-0 text-left">
                      <div className={`w-4 h-4 rounded border flex-shrink-0 ${isOverdue ? 'border-red-300' : 'border-gray-300'}`} />
                      <span className="text-sm text-gray-800 truncate">{t.title}</span>
                    </button>
                    {due && (
                      <span className={`text-xs flex-shrink-0 ml-3 ${isOverdue ? 'text-red-500 font-medium' : 'text-gray-400'}`}>
                        {due.toLocaleDateString('es', { day: 'numeric', month: 'short' })}
                      </span>
                    )}
                  </div>
                )
              })}
          </div>
        </div>
      )}

      {/* Panel lateral del día */}
      {selectedDay !== null && dayItems && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={() => setSelectedDay(null)}>
          <div className="w-full max-w-sm bg-white rounded-xl shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900 capitalize">
                {new Date(year, month, selectedDay).toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' })}
              </h3>
              <div className="flex items-center gap-2">
                <button onClick={() => openNewAppt(selectedDay)} className="text-xs bg-gray-900 text-white px-3 py-1.5 rounded-lg font-medium hover:bg-gray-800 transition-colors">
                  + Cita
                </button>
                <button onClick={() => setSelectedDay(null)} className="text-gray-400 hover:text-gray-700"><X size={18} /></button>
              </div>
            </div>
            <div className="p-5 space-y-2 max-h-80 overflow-y-auto">
              {dayItems.appts.map(a => {
                const start = getTs(a.startDate)
                const end = a.endDate ? getTs(a.endDate) : null
                return (
                  <div key={a.id} className="flex items-start justify-between gap-2 p-3 bg-blue-50 rounded-lg">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-blue-800">{a.title}</p>
                      {a.clientName && <p className="text-xs text-blue-500">{a.clientName}</p>}
                      {a.description && <p className="text-xs text-blue-600 mt-1">{a.description}</p>}
                      {start && <p className="text-xs text-blue-400 mt-1">{toTimeStr(start)}{end ? ` - ${toTimeStr(end)}` : ''}</p>}
                    </div>
                    <button onClick={() => handleDeleteAppt(a.id)} className="text-blue-300 hover:text-red-500 transition-colors flex-shrink-0 mt-0.5">
                      <Trash2 size={14} />
                    </button>
                  </div>
                )
              })}
              {dayItems.tasks.map(t => {
                const isOverdue = !t.completed && getTs(t.dueDate) && getTs(t.dueDate)! < today
                return (
                  <button key={t.id} onClick={() => toggleTask(t)} className={`w-full text-left p-3 rounded-lg flex items-start gap-2 transition-colors ${
                    t.completed ? 'bg-green-50' : isOverdue ? 'bg-red-50' : 'bg-gray-50 hover:bg-gray-100'
                  }`}>
                    <div className={`w-4 h-4 rounded border flex-shrink-0 mt-0.5 ${t.completed ? 'bg-green-500 border-green-500' : isOverdue ? 'border-red-300' : 'border-gray-300'}`} />
                    <span className={`text-sm ${t.completed ? 'line-through text-gray-400' : isOverdue ? 'text-red-700' : 'text-gray-800'}`}>{t.title}</span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Modal nueva cita */}
      {showApptModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40" onClick={() => setShowApptModal(false)}>
          <div className="w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-xl shadow-xl max-h-[90dvh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 sticky top-0 bg-white z-10">
              <h2 className="text-lg font-semibold text-gray-900">Nueva cita</h2>
              <button onClick={() => setShowApptModal(false)} className="text-gray-400 hover:text-gray-700"><X size={20} /></button>
            </div>
            <form onSubmit={handleCreateAppt} className="p-6 space-y-4">
              <input
                required
                value={apptForm.title}
                onChange={e => setApptForm(f => ({ ...f, title: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-gray-500"
                placeholder="Título de la cita *"
              />
              <input
                value={apptForm.clientName}
                onChange={e => setApptForm(f => ({ ...f, clientName: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-gray-500"
                placeholder="Cliente (opcional)"
              />
              <textarea
                value={apptForm.description}
                onChange={e => setApptForm(f => ({ ...f, description: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-gray-500 resize-none"
                rows={2}
                placeholder="Descripción (opcional)"
              />
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">Fecha</label>
                <input
                  required
                  type="date"
                  value={apptForm.startDate}
                  onChange={e => setApptForm(f => ({ ...f, startDate: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-gray-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">Hora inicio</label>
                  <input
                    type="time"
                    value={apptForm.startTime}
                    onChange={e => setApptForm(f => ({ ...f, startTime: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-gray-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">Hora fin</label>
                  <input
                    type="time"
                    value={apptForm.endTime}
                    onChange={e => setApptForm(f => ({ ...f, endTime: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-gray-500"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={saving}
                className="w-full bg-gray-900 hover:bg-gray-800 disabled:opacity-50 text-white font-semibold py-2.5 rounded-lg transition-colors text-sm"
              >
                {saving ? 'Agendando...' : 'Agendar cita'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
