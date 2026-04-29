'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { getClients, getTasks, getDeals } from '@/lib/firestore'
import type { Deal, Task } from '@/types'
import Link from 'next/link'
import { Users, CheckSquare, TrendingUp, Clock, AlertCircle, DollarSign, Rocket, ArrowRight } from 'lucide-react'

const STAGES = [
  { id: 'new', name: 'Nuevo', color: '#6b7280' },
  { id: 'contacted', name: 'Contactado', color: '#3b82f6' },
  { id: 'negotiation', name: 'Negociación', color: '#f59e0b' },
  { id: 'closed_won', name: 'Ganado', color: '#10b981' },
  { id: 'closed_lost', name: 'Perdido', color: '#ef4444' },
]

interface Stats {
  clients: number
  newClientsThisMonth: number
  pendingTasks: number
  overdueTasks: number
  pipelineValue: number
  wonThisMonth: number
  deals: Deal[]
  tasks: Task[]
}

const statCards = (stats: Stats) => [
  {
    label: 'Clientes totales',
    value: stats.clients,
    sub: stats.newClientsThisMonth > 0 ? `+${stats.newClientsThisMonth} este mes` : 'Sin altas este mes',
    icon: Users,
    gradient: 'from-indigo-500 to-blue-600',
    bg: 'bg-indigo-50',
    iconBg: 'bg-gradient-to-br from-indigo-500 to-blue-600',
    textColor: 'text-indigo-600',
    subColor: 'text-indigo-500',
    alert: false,
  },
  {
    label: 'Tareas pendientes',
    value: stats.pendingTasks,
    sub: stats.overdueTasks > 0 ? `${stats.overdueTasks} vencidas` : 'Todo al día',
    icon: stats.overdueTasks > 0 ? AlertCircle : CheckSquare,
    gradient: 'from-amber-500 to-orange-500',
    bg: stats.overdueTasks > 0 ? 'bg-red-50' : 'bg-amber-50',
    iconBg: stats.overdueTasks > 0 ? 'bg-gradient-to-br from-red-500 to-rose-600' : 'bg-gradient-to-br from-amber-500 to-orange-500',
    textColor: stats.overdueTasks > 0 ? 'text-red-600' : 'text-amber-600',
    subColor: stats.overdueTasks > 0 ? 'text-red-500 font-semibold' : 'text-amber-500',
    alert: stats.overdueTasks > 0,
  },
  {
    label: 'Valor en pipeline',
    value: `$${stats.pipelineValue.toLocaleString()}`,
    sub: `${stats.deals.filter(d => d.stage !== 'closed_lost' && d.stage !== 'closed_won').length} oportunidades abiertas`,
    icon: TrendingUp,
    gradient: 'from-violet-500 to-purple-600',
    bg: 'bg-violet-50',
    iconBg: 'bg-gradient-to-br from-violet-500 to-purple-600',
    textColor: 'text-violet-600',
    subColor: 'text-violet-500',
    alert: false,
  },
  {
    label: 'Ganado este mes',
    value: `$${stats.wonThisMonth.toLocaleString()}`,
    sub: `${stats.deals.filter(d => d.stage === 'closed_won').length} deals cerrados`,
    icon: DollarSign,
    gradient: 'from-emerald-500 to-green-600',
    bg: 'bg-emerald-50',
    iconBg: 'bg-gradient-to-br from-emerald-500 to-green-600',
    textColor: 'text-emerald-600',
    subColor: 'text-emerald-500',
    alert: false,
  },
]

export default function DashboardPage() {
  const { profile } = useAuth()
  const [stats, setStats] = useState<Stats>({
    clients: 0, newClientsThisMonth: 0,
    pendingTasks: 0, overdueTasks: 0,
    pipelineValue: 0, wonThisMonth: 0,
    deals: [], tasks: [],
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!profile) return
    if (!profile.orgId) { setLoading(false); return }
    const load = async () => {
      try {
        const [clients, tasks, deals] = await Promise.all([
          getClients(profile.orgId!, profile.role === 'agent' ? profile.uid : undefined),
          getTasks(profile.orgId!, profile.role === 'agent' ? profile.uid : undefined),
          getDeals(profile.orgId!),
        ])

        const now = new Date()
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

        const newClientsThisMonth = clients.filter(c => {
          const d = c.createdAt instanceof Date ? c.createdAt : new Date((c.createdAt as unknown as { seconds: number }).seconds * 1000)
          return d >= startOfMonth
        }).length

        const pendingTasks = tasks.filter(t => !t.completed).length
        const overdueTasks = tasks.filter(t => {
          if (t.completed || !t.dueDate) return false
          const due = t.dueDate instanceof Date ? t.dueDate : new Date((t.dueDate as unknown as { seconds: number }).seconds * 1000)
          return due < now
        }).length

        const pipelineValue = deals
          .filter(d => d.stage !== 'closed_lost')
          .reduce((s, d) => s + (d.value ?? 0), 0)

        const wonThisMonth = deals
          .filter(d => {
            if (d.stage !== 'closed_won') return false
            const updated = d.updatedAt instanceof Date ? d.updatedAt : new Date((d.updatedAt as unknown as { seconds: number }).seconds * 1000)
            return updated >= startOfMonth
          })
          .reduce((s, d) => s + (d.value ?? 0), 0)

        setStats({ clients: clients.length, newClientsThisMonth, pendingTasks, overdueTasks, pipelineValue, wonThisMonth, deals, tasks })
      } catch (e) {
        console.error('Error cargando dashboard:', e)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [profile])

  const cards = statCards(stats)
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Buenos días' : hour < 19 ? 'Buenas tardes' : 'Buenas noches'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <p className="text-sm text-gray-500">{greeting},</p>
          <h1 className="text-2xl font-bold text-gray-900 mt-0.5">
            {profile?.displayName?.split(' ')[0]} 👋
          </h1>
        </div>
        <span className="text-xs text-gray-400 hidden sm:block">
          {new Date().toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' })}
        </span>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-4 border-violet-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* Onboarding */}
          {stats.clients === 0 && (
            <div className="relative overflow-hidden bg-gradient-to-r from-violet-600 to-indigo-700 rounded-2xl p-6 text-white shadow-lg shadow-indigo-200">
              <div className="absolute right-4 top-4 opacity-10">
                <Rocket size={80} />
              </div>
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-white/20 rounded-lg"><Rocket size={20} /></div>
                <div>
                  <h2 className="font-semibold">Bienvenido a tu CRM</h2>
                  <p className="text-sm text-white/70">Completa estos pasos para comenzar</p>
                </div>
              </div>
              <div className="space-y-2">
                {[
                  { step: 1, label: 'Agrega tus primeros clientes', href: '/dashboard/clients' },
                  { step: 2, label: 'Invita a tu equipo', href: '/dashboard/users' },
                  { step: 3, label: 'Conecta WhatsApp Business', href: '/dashboard/settings' },
                ].map(({ step, label, href }) => (
                  <Link key={step} href={href} className="flex items-center justify-between py-2.5 px-3 bg-white/10 hover:bg-white/20 rounded-lg transition-colors group">
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 bg-white/20 text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">{step}</span>
                      <span className="text-sm font-medium">{label}</span>
                    </div>
                    <ArrowRight size={14} className="opacity-50 group-hover:opacity-100 transition-opacity" />
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Stat cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {cards.map(card => (
              <div
                key={card.label}
                className={`rounded-2xl p-5 ${card.bg} border border-black/5`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className={`p-2.5 rounded-xl ${card.iconBg} shadow-md`}>
                    <card.icon size={18} className="text-white" />
                  </div>
                  {card.sub && (
                    <span className={`text-xs font-medium ${card.subColor}`}>{card.sub}</span>
                  )}
                </div>
                <p className={`text-2xl font-bold ${card.textColor} mt-1`}>{card.value}</p>
                <p className="text-xs text-gray-500 mt-0.5">{card.label}</p>
              </div>
            ))}
          </div>

          {/* Pipeline por etapa */}
          <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-5">
              <div className="p-1.5 bg-violet-100 rounded-lg">
                <Clock size={14} className="text-violet-600" />
              </div>
              <h2 className="font-semibold text-gray-900 text-sm">Pipeline por etapa</h2>
              <span className="ml-auto text-xs text-gray-400">{stats.deals.filter(d => d.stage !== 'closed_lost').length} oportunidades</span>
            </div>
            <div className="space-y-3">
              {STAGES.map(stage => {
                const stageDeals = stats.deals.filter(d => d.stage === stage.id)
                const value = stageDeals.reduce((s, d) => s + (d.value ?? 0), 0)
                const maxVal = Math.max(...STAGES.map(s =>
                  stats.deals.filter(d => d.stage === s.id).reduce((acc, d) => acc + (d.value ?? 0), 0)
                ), 1)
                const pct = Math.round((value / maxVal) * 100)

                return (
                  <div key={stage.id} className="flex items-center gap-3">
                    <div className="w-24 text-xs text-gray-500 text-right flex-shrink-0 font-medium">{stage.name}</div>
                    <div className="flex-1 bg-gray-100 rounded-full h-2">
                      <div
                        className="h-2 rounded-full transition-all duration-500"
                        style={{ width: `${pct}%`, backgroundColor: stage.color }}
                      />
                    </div>
                    <div className="w-20 text-xs text-gray-700 font-semibold text-right">
                      {stageDeals.length > 0 ? `$${value.toLocaleString()}` : <span className="text-gray-300 font-normal">—</span>}
                    </div>
                    <div className="w-5 text-xs text-gray-400 text-right">{stageDeals.length > 0 ? stageDeals.length : ''}</div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Tareas vencidas */}
          {stats.tasks.filter(t => !t.completed && t.dueDate && new Date((t.dueDate as unknown as { seconds: number })?.seconds ? (t.dueDate as unknown as { seconds: number }).seconds * 1000 : t.dueDate as unknown as number) < new Date()).length > 0 && (
            <div className="bg-white border border-red-100 rounded-2xl p-6 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <div className="p-1.5 bg-red-100 rounded-lg">
                  <AlertCircle size={14} className="text-red-500" />
                </div>
                <h2 className="font-semibold text-gray-900 text-sm">Tareas vencidas</h2>
                <Link href="/dashboard/tasks" className="ml-auto text-xs text-violet-600 hover:underline flex items-center gap-1">
                  Ver todas <ArrowRight size={11} />
                </Link>
              </div>
              <div className="space-y-1">
                {stats.tasks
                  .filter(t => {
                    if (t.completed || !t.dueDate) return false
                    const due = (t.dueDate as unknown as { seconds: number })?.seconds
                      ? new Date((t.dueDate as unknown as { seconds: number }).seconds * 1000)
                      : new Date(t.dueDate as unknown as string)
                    return due < new Date()
                  })
                  .slice(0, 5)
                  .map(task => {
                    const due = (task.dueDate as unknown as { seconds: number })?.seconds
                      ? new Date((task.dueDate as unknown as { seconds: number }).seconds * 1000)
                      : new Date(task.dueDate as unknown as string)
                    return (
                      <div key={task.id} className="flex items-center justify-between py-2.5 px-3 rounded-xl bg-red-50/60 hover:bg-red-50 transition-colors">
                        <p className="text-sm text-gray-800 truncate">{task.title}</p>
                        <span className="text-xs text-red-500 font-semibold ml-4 flex-shrink-0 bg-red-100 px-2 py-0.5 rounded-full">
                          {due.toLocaleDateString('es')}
                        </span>
                      </div>
                    )
                  })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
