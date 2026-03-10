'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { getTasks, updateTask } from '@/lib/firestore'
import type { Task } from '@/types'
import { ChevronLeft, ChevronRight, CheckSquare, AlertCircle } from 'lucide-react'
import toast from 'react-hot-toast'

function getTs(d: unknown): Date | null {
  if (!d) return null
  if (d instanceof Date) return d
  if (typeof d === 'object' && 'seconds' in (d as object)) return new Date((d as { seconds: number }).seconds * 1000)
  return null
}

export default function CalendarPage() {
  const { profile } = useAuth()
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [current, setCurrent] = useState(new Date())

  const year = current.getFullYear()
  const month = current.getMonth()

  useEffect(() => {
    if (!profile) return
    if (!profile.orgId) { setLoading(false); return }
    const uid = profile.role === 'agent' ? profile.uid : undefined
    getTasks(profile.orgId, uid)
      .then(t => { setTasks(t) })
      .catch(e => console.error('Error cargando tareas:', e))
      .finally(() => setLoading(false))
  }, [profile])

  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const today = new Date()

  const getTasksForDay = (day: number) => {
    const date = new Date(year, month, day)
    return tasks.filter(t => {
      const due = getTs(t.dueDate)
      if (!due) return false
      return due.getFullYear() === year && due.getMonth() === month && due.getDate() === day
    })
  }

  const toggleTask = async (task: Task) => {
    if (!profile?.orgId) return
    await updateTask(profile.orgId, task.id, { completed: !task.completed })
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, completed: !t.completed } : t))
    toast.success(task.completed ? 'Tarea reabierta' : 'Tarea completada')
  }

  const monthName = current.toLocaleDateString('es', { month: 'long', year: 'numeric' })

  // Cells: pad with empty cells for first day offset
  const cells: Array<number | null> = [
    ...Array(firstDay === 0 ? 6 : firstDay - 1).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]

  const tasksDueThisMonth = tasks.filter(t => {
    const due = getTs(t.dueDate)
    return due && due.getFullYear() === year && due.getMonth() === month
  })
  const overdue = tasksDueThisMonth.filter(t => {
    const due = getTs(t.dueDate)
    return !t.completed && due && due < today
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Calendario de tareas</h1>
        <p className="text-gray-500 text-sm mt-1">
          {tasksDueThisMonth.length} tareas este mes
          {overdue.length > 0 && <span className="text-red-500 ml-2">· {overdue.length} vencidas</span>}
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-gray-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <button
              onClick={() => setCurrent(new Date(year, month - 1, 1))}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ChevronLeft size={18} className="text-gray-600" />
            </button>
            <h2 className="font-semibold text-gray-900 capitalize">{monthName}</h2>
            <button
              onClick={() => setCurrent(new Date(year, month + 1, 1))}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ChevronRight size={18} className="text-gray-600" />
            </button>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 border-b border-gray-100">
            {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map(d => (
              <div key={d} className="text-center text-xs font-medium text-gray-400 py-2">{d}</div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7">
            {cells.map((day, idx) => {
              if (!day) return <div key={`empty-${idx}`} className="min-h-24 border-b border-r border-gray-100 bg-gray-50/50" />

              const dayTasks = getTasksForDay(day)
              const isToday = today.getDate() === day && today.getMonth() === month && today.getFullYear() === year
              const isWeekend = (idx % 7) >= 5

              return (
                <div
                  key={day}
                  className={`min-h-24 border-b border-r border-gray-100 p-2 ${isWeekend ? 'bg-gray-50/30' : ''}`}
                >
                  <div className={`w-6 h-6 flex items-center justify-center text-xs font-medium rounded-full mb-1 ${
                    isToday ? 'bg-gray-900 text-white' : 'text-gray-600'
                  }`}>
                    {day}
                  </div>
                  <div className="space-y-1">
                    {dayTasks.slice(0, 3).map(t => {
                      const isOverdue = !t.completed && getTs(t.dueDate) && getTs(t.dueDate)! < today
                      return (
                        <button
                          key={t.id}
                          onClick={() => toggleTask(t)}
                          className={`w-full text-left text-xs px-1.5 py-1 rounded flex items-start gap-1 transition-colors ${
                            t.completed
                              ? 'bg-green-50 text-green-700 line-through'
                              : isOverdue
                              ? 'bg-red-50 text-red-700'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          {t.completed
                            ? <CheckSquare size={10} className="flex-shrink-0 mt-0.5" />
                            : isOverdue
                            ? <AlertCircle size={10} className="flex-shrink-0 mt-0.5" />
                            : <CheckSquare size={10} className="flex-shrink-0 mt-0.5 opacity-40" />
                          }
                          <span className="truncate leading-tight">{t.title}</span>
                        </button>
                      )
                    })}
                    {dayTasks.length > 3 && (
                      <p className="text-xs text-gray-400 text-center">+{dayTasks.length - 3} más</p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Upcoming tasks list */}
      {tasksDueThisMonth.filter(t => !t.completed).length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h2 className="font-semibold text-gray-900 text-sm mb-4">Pendientes este mes</h2>
          <div className="space-y-2">
            {tasksDueThisMonth
              .filter(t => !t.completed)
              .sort((a, b) => {
                const da = getTs(a.dueDate)?.getTime() ?? 0
                const db = getTs(b.dueDate)?.getTime() ?? 0
                return da - db
              })
              .slice(0, 10)
              .map(t => {
                const due = getTs(t.dueDate)
                const isOverdue = due && due < today
                return (
                  <div key={t.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                    <button
                      onClick={() => toggleTask(t)}
                      className="flex items-center gap-2 flex-1 min-w-0 text-left"
                    >
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
    </div>
  )
}
