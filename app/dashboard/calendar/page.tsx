'use client'

import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '@/context/AuthContext'
import { getTasks, updateTask, getAppointments, createAppointment, deleteAppointment, getAppointmentRequests } from '@/lib/firestore'
import type { Task, Appointment, AppointmentRequest } from '@/types'
import { ChevronLeft, ChevronRight, CheckSquare, AlertCircle, CalendarPlus, Clock, Trash2, X, Check, UserCheck } from 'lucide-react'
import toast from 'react-hot-toast'
import { Spinner } from '@/components/ui/primitives'

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

const inputClass = 'w-full bg-[#F4F5F7] dark:bg-[#1A2540] border border-[#E3E6EC] dark:border-[#1A2540] rounded-md px-4 py-2.5 text-[#0C1224] dark:text-[#E8ECF4] focus:outline-none focus:border-[#0D7A65] focus:ring-1 focus:ring-[#0D7A65]/10 text-sm transition-colors'

export default function CalendarPage() {
  const { profile } = useAuth()
  const [tasks, setTasks] = useState<Task[]>([])
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [requests, setRequests] = useState<AppointmentRequest[]>([])
  const [processingRequest, setProcessingRequest] = useState<string | null>(null)
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
    const [t, a, r] = await Promise.all([
      getTasks(profile.orgId, uid),
      getAppointments(profile.orgId, uid),
      getAppointmentRequests(profile.orgId, 'pending'),
    ])
    setTasks(t)
    setAppointments(a)
    setRequests(r)
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

  const handleRequestAction = async (requestId: string, orgId: string, action: 'confirm' | 'reject') => {
    if (!profile?.orgId) return
    setProcessingRequest(requestId)
    try {
      const res = await fetch('/api/bot/confirm-slot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId, orgId: profile.orgId, action }),
      })
      if (!res.ok) throw new Error('Error procesando solicitud')
      setRequests(prev => prev.filter(r => r.id !== requestId))
      toast.success(action === 'confirm' ? 'Cita confirmada y notificada al cliente' : 'Cita rechazada')
      if (action === 'confirm') {
        load()
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error')
    } finally {
      setProcessingRequest(null)
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
          <h1 className="text-2xl font-bold text-[#0C1224] dark:text-[#E8ECF4]">Calendario</h1>
          <p className="text-[#68748D] dark:text-[#9BA5B7] text-sm mt-1">
            {tasksDueThisMonth.length} tareas · {apptsThisMonth.length} citas este mes
            {overdue.length > 0 && <span className="text-red-500 ml-2">· {overdue.length} vencidas</span>}
          </p>
        </div>
        <button
          onClick={() => openNewAppt()}
          className="flex items-center gap-2 bg-[#0C1224] hover:bg-[#1B2B4B] shadow-lg text-white px-4 py-2.5 rounded-md text-sm font-bold transition-all self-start sm:self-auto"
        >
          <CalendarPlus size={16} /> Nueva cita
        </button>
      </div>

      {/* ── Solicitudes pendientes del bot ── */}
      {requests.length > 0 && (
        <div className="mb-6 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <UserCheck size={16} className="text-amber-600" />
            <span className="font-semibold text-amber-700 dark:text-amber-400 text-sm">
              {requests.length} solicitud{requests.length > 1 ? 'es' : ''} de cita pendiente{requests.length > 1 ? 's' : ''}
            </span>
          </div>
          <div className="space-y-2">
            {requests.map(r => (
              <div key={r.id} className="flex items-center justify-between bg-white dark:bg-[#0C1224] rounded-lg px-4 py-2.5 border border-amber-100 dark:border-amber-900">
                <div>
                  <p className="text-sm font-medium text-[#0C1224] dark:text-[#E8ECF4]">
                    {r.clientName || r.clientPhone}
                  </p>
                  <p className="text-xs text-[#6B7280]">📅 {r.slotLabel}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleRequestAction(r.id, r.orgId, 'confirm')}
                    disabled={processingRequest === r.id}
                    className="flex items-center gap-1 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                  >
                    <Check size={13} /> Confirmar
                  </button>
                  <button
                    onClick={() => handleRequestAction(r.id, r.orgId, 'reject')}
                    disabled={processingRequest === r.id}
                    className="flex items-center gap-1 bg-red-500 hover:bg-red-600 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                  >
                    <X size={13} /> Rechazar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <Spinner />
      ) : (
        <div className="bg-white dark:bg-[#0F1829] border border-[#E3E6EC] dark:border-[#1A2540] rounded-lg shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-[#E3E6EC] dark:border-[#1A2540]">
            <button onClick={() => setCurrent(new Date(year, month - 1, 1))} className="p-2 hover:bg-[#F4F5F7] dark:hover:bg-[#1A2540] rounded-lg transition-colors">
              <ChevronLeft size={18} className="text-[#68748D] dark:text-[#9BA5B7]" />
            </button>
            <h2 className="font-bold text-[#0C1224] dark:text-[#E8ECF4] capitalize">{monthName}</h2>
            <button onClick={() => setCurrent(new Date(year, month + 1, 1))} className="p-2 hover:bg-[#F4F5F7] dark:hover:bg-[#1A2540] rounded-lg transition-colors">
              <ChevronRight size={18} className="text-[#68748D] dark:text-[#9BA5B7]" />
            </button>
          </div>

          <div className="flex items-center gap-4 px-6 py-2 border-b border-[#E3E6EC] dark:border-[#1A2540] bg-[#F4F5F7] dark:bg-[#1A2540]/50 text-xs text-[#68748D] dark:text-[#9BA5B7]">
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-[#0D7A65]/10 inline-block" /> Cita</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-[#E3E6EC] dark:bg-[#1A2540] inline-block" /> Tarea</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-red-100 inline-block" /> Vencida</span>
          </div>

          <div className="grid grid-cols-7 border-b border-[#E3E6EC] dark:border-[#1A2540]">
            {[['L','Lun'], ['M','Mar'], ['X','Mié'], ['J','Jue'], ['V','Vie'], ['S','Sáb'], ['D','Dom']].map(([short, full]) => (
              <div key={full} className="text-center text-xs font-medium text-[#9BA5B7] dark:text-[#68748D] py-2">
                <span className="sm:hidden">{short}</span>
                <span className="hidden sm:inline">{full}</span>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7">
            {cells.map((day, idx) => {
              if (!day) return <div key={`empty-${idx}`} className="min-h-14 sm:min-h-24 border-b border-r border-[#E3E6EC] dark:border-[#1A2540] bg-[#F4F5F7]/50 dark:bg-[#1A2540]/20" />
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
                  className={`min-h-14 sm:min-h-24 border-b border-r border-[#E3E6EC] dark:border-[#1A2540] p-1 sm:p-2 cursor-pointer group hover:bg-[#F4F5F7]/20 transition-colors ${isWeekend ? 'bg-[#F4F5F7]/30 dark:bg-[#1A2540]/10' : ''}`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className={`w-6 h-6 flex items-center justify-center text-xs font-medium rounded-full ${isToday ? 'bg-[#0C1224] text-white' : 'text-[#68748D] dark:text-[#9BA5B7]'}`}>
                      {day}
                    </div>
                    {total === 0 && <span className="text-blue-300 text-xs opacity-0 group-hover:opacity-100 transition-opacity">+</span>}
                  </div>
                  <div className="space-y-1">
                    {dayAppts.slice(0, 2).map(a => (
                      <div key={a.id} className="text-xs px-1.5 py-0.5 rounded bg-[#F4F5F7] text-blue-700 flex items-center gap-1 truncate">
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
                            : 'bg-[#F4F5F7] dark:bg-[#1A2540] text-[#0C1224] dark:text-[#9BA5B7] hover:bg-[#E3E6EC] dark:hover:bg-[#1A2540]'
                          }`}
                        >
                          <CheckSquare size={9} className="flex-shrink-0 opacity-60" />
                          <span className="truncate">{t.title}</span>
                        </div>
                      )
                    })}
                    {total > 2 && <p className="text-xs text-[#9BA5B7] dark:text-[#68748D] text-center">+{total - 2} más</p>}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Lista citas del mes */}
      {apptsThisMonth.length > 0 && (
        <div className="bg-white dark:bg-[#0F1829] border border-[#E3E6EC] dark:border-[#1A2540] rounded-lg shadow-sm p-5">
          <h2 className="font-bold text-[#0C1224] dark:text-[#E8ECF4] text-sm mb-4">Citas este mes</h2>
          <div className="space-y-2">
            {apptsThisMonth
              .sort((a, b) => (getTs(a.startDate)?.getTime() ?? 0) - (getTs(b.startDate)?.getTime() ?? 0))
              .map(a => {
                const start = getTs(a.startDate)
                const end = a.endDate ? getTs(a.endDate) : null
                return (
                  <div key={a.id} className="flex items-center justify-between py-2 border-b border-slate-50 dark:border-[#1A2540] last:border-0">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-2 h-2 rounded-full bg-blue-400 flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-[#0C1224] dark:text-[#E8ECF4] truncate">{a.title}</p>
                        {a.clientName && <p className="text-xs text-[#9BA5B7] dark:text-[#68748D]">{a.clientName}</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0 ml-4">
                      {start && (
                        <span className="text-xs text-[#9BA5B7] dark:text-[#68748D]">
                          {start.toLocaleDateString('es', { day: 'numeric', month: 'short' })} · {toTimeStr(start)}{end ? ` - ${toTimeStr(end)}` : ''}
                        </span>
                      )}
                      <button onClick={() => handleDeleteAppt(a.id)} className="text-[#9BA5B7] dark:text-[#68748D] hover:text-red-500 transition-colors">
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
        <div className="bg-white dark:bg-[#0F1829] border border-[#E3E6EC] dark:border-[#1A2540] rounded-lg shadow-sm p-5">
          <h2 className="font-bold text-[#0C1224] dark:text-[#E8ECF4] text-sm mb-4">Tareas pendientes este mes</h2>
          <div className="space-y-2">
            {tasksDueThisMonth
              .filter(t => !t.completed)
              .sort((a, b) => (getTs(a.dueDate)?.getTime() ?? 0) - (getTs(b.dueDate)?.getTime() ?? 0))
              .slice(0, 10)
              .map(t => {
                const due = getTs(t.dueDate)
                const isOverdue = due && due < today
                return (
                  <div key={t.id} className="flex items-center justify-between py-2 border-b border-slate-50 dark:border-[#1A2540] last:border-0">
                    <button onClick={() => toggleTask(t)} className="flex items-center gap-2 flex-1 min-w-0 text-left">
                      <div className={`w-4 h-4 rounded border flex-shrink-0 ${isOverdue ? 'border-red-300' : 'border-[#E3E6EC] dark:border-slate-600'}`} />
                      <span className="text-sm text-[#0C1224] dark:text-[#E8ECF4] truncate">{t.title}</span>
                    </button>
                    {due && (
                      <span className={`text-xs flex-shrink-0 ml-3 ${isOverdue ? 'text-red-500 font-medium' : 'text-[#9BA5B7] dark:text-[#68748D]'}`}>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => setSelectedDay(null)}>
          <div className="w-full max-w-sm bg-white dark:bg-[#0F1829] rounded-lg shadow-sm" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#E3E6EC] dark:border-[#1A2540]">
              <h3 className="font-bold text-[#0C1224] dark:text-[#E8ECF4] capitalize">
                {new Date(year, month, selectedDay).toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' })}
              </h3>
              <div className="flex items-center gap-2">
                <button onClick={() => openNewAppt(selectedDay)} className="text-xs bg-[#0C1224] hover:bg-[#1B2B4B] text-white px-3 py-1.5 rounded-md font-medium transition-colors">
                  + Cita
                </button>
                <button onClick={() => setSelectedDay(null)} className="text-[#9BA5B7] dark:text-[#68748D] hover:text-[#0C1224] dark:hover:text-slate-200"><X size={18} /></button>
              </div>
            </div>
            <div className="p-5 space-y-2 max-h-80 overflow-y-auto">
              {dayItems.appts.map(a => {
                const start = getTs(a.startDate)
                const end = a.endDate ? getTs(a.endDate) : null
                return (
                  <div key={a.id} className="flex items-start justify-between gap-2 p-3 bg-[#F4F5F7] rounded-lg">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-blue-800">{a.title}</p>
                      {a.clientName && <p className="text-xs text-[#0D7A65]">{a.clientName}</p>}
                      {a.description && <p className="text-xs text-[#0D7A65] mt-1">{a.description}</p>}
                      {start && <p className="text-xs text-[#0D7A65] mt-1">{toTimeStr(start)}{end ? ` - ${toTimeStr(end)}` : ''}</p>}
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
                    t.completed ? 'bg-green-50' : isOverdue ? 'bg-red-50' : 'bg-[#F4F5F7] dark:bg-[#1A2540] hover:bg-[#F4F5F7] dark:hover:bg-[#1A2540]'
                  }`}>
                    <div className={`w-4 h-4 rounded border flex-shrink-0 mt-0.5 ${t.completed ? 'bg-green-500 border-green-500' : isOverdue ? 'border-red-300' : 'border-[#E3E6EC] dark:border-slate-600'}`} />
                    <span className={`text-sm ${t.completed ? 'line-through text-[#9BA5B7]' : isOverdue ? 'text-red-700' : 'text-[#0C1224] dark:text-[#E8ECF4]'}`}>{t.title}</span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Modal nueva cita */}
      {showApptModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => setShowApptModal(false)}>
          <div className="w-full sm:max-w-md bg-white dark:bg-[#0F1829] rounded-lg shadow-sm max-h-[90dvh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#E3E6EC] dark:border-[#1A2540] sticky top-0 bg-white dark:bg-[#0F1829] z-10">
              <h2 className="text-lg font-bold text-[#0C1224] dark:text-[#E8ECF4]">Nueva cita</h2>
              <button onClick={() => setShowApptModal(false)} className="text-[#9BA5B7] hover:text-[#0C1224] dark:hover:text-slate-200"><X size={20} /></button>
            </div>
            <form onSubmit={handleCreateAppt} className="p-6 space-y-4">
              <input
                required
                value={apptForm.title}
                onChange={e => setApptForm(f => ({ ...f, title: e.target.value }))}
                className={inputClass}
                placeholder="Título de la cita *"
              />
              <input
                value={apptForm.clientName}
                onChange={e => setApptForm(f => ({ ...f, clientName: e.target.value }))}
                className={inputClass}
                placeholder="Cliente (opcional)"
              />
              <textarea
                value={apptForm.description}
                onChange={e => setApptForm(f => ({ ...f, description: e.target.value }))}
                className={inputClass + ' resize-none'}
                rows={2}
                placeholder="Descripción (opcional)"
              />
              <div>
                <label className="text-xs font-bold text-[#68748D] dark:text-[#9BA5B7] mb-1 block">Fecha</label>
                <input
                  required
                  type="date"
                  value={apptForm.startDate}
                  onChange={e => setApptForm(f => ({ ...f, startDate: e.target.value }))}
                  className={inputClass}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-[#68748D] dark:text-[#9BA5B7] mb-1 block">Hora inicio</label>
                  <input
                    type="time"
                    value={apptForm.startTime}
                    onChange={e => setApptForm(f => ({ ...f, startTime: e.target.value }))}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-[#68748D] dark:text-[#9BA5B7] mb-1 block">Hora fin</label>
                  <input
                    type="time"
                    value={apptForm.endTime}
                    onChange={e => setApptForm(f => ({ ...f, endTime: e.target.value }))}
                    className={inputClass}
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={saving}
                className="w-full bg-[#0C1224] hover:bg-[#1B2B4B] shadow-lg disabled:opacity-50 text-white font-bold py-2.5 rounded-md transition-all text-sm"
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
