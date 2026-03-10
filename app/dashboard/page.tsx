'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { getClients, getTasks, getDeals } from '@/lib/firestore'
import type { Deal, Task } from '@/types'
import Link from 'next/link'
import { Users, CheckSquare, TrendingUp, Clock, AlertCircle, DollarSign, Rocket } from 'lucide-react'

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

  const cards = [
    {
      label: 'Clientes totales',
      value: stats.clients,
      sub: stats.newClientsThisMonth > 0 ? `+${stats.newClientsThisMonth} este mes` : undefined,
      icon: Users,
      alert: false,
    },
    {
      label: 'Tareas pendientes',
      value: stats.pendingTasks,
      sub: stats.overdueTasks > 0 ? `${stats.overdueTasks} vencidas` : 'Al día',
      icon: stats.overdueTasks > 0 ? AlertCircle : CheckSquare,
      alert: stats.overdueTasks > 0,
    },
    {
      label: 'Valor en pipeline',
      value: `$${stats.pipelineValue.toLocaleString()}`,
      sub: `${stats.deals.filter(d => d.stage !== 'closed_lost' && d.stage !== 'closed_won').length} oportunidades abiertas`,
      icon: TrendingUp,
      alert: false,
    },
    {
      label: 'Ganado este mes',
      value: `$${stats.wonThisMonth.toLocaleString()}`,
      sub: `${stats.deals.filter(d => d.stage === 'closed_won').length} deals cerrados`,
      icon: DollarSign,
      alert: false,
    },
  ]

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Bienvenido, {profile?.displayName?.split(' ')[0]}
        </h1>
        <p className="text-gray-500 mt-1 text-sm">Resumen de tu actividad</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-gray-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* Onboarding para nuevos usuarios */}
          {stats.clients === 0 && (
            <div className="bg-white border border-gray-200 rounded-xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-gray-100 rounded-lg"><Rocket size={20} className="text-gray-700" /></div>
                <div>
                  <h2 className="font-semibold text-gray-900">Bienvenido a tu CRM</h2>
                  <p className="text-sm text-gray-500">Sigue estos pasos para empezar</p>
                </div>
              </div>
              <div className="space-y-3">
                {[
                  { step: 1, label: 'Agrega tus primeros clientes', href: '/dashboard/clients', action: 'Ir a Clientes' },
                  { step: 2, label: 'Invita a tu equipo', href: '/dashboard/users', action: 'Ir a Usuarios' },
                  { step: 3, label: 'Conecta WhatsApp Business', href: '/dashboard/settings', action: 'Ir a Configuración' },
                ].map(({ step, label, href, action }) => (
                  <div key={step} className="flex items-center justify-between py-3 px-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 bg-gray-200 text-gray-700 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">{step}</span>
                      <span className="text-sm text-gray-700">{label}</span>
                    </div>
                    <Link href={href} className="text-xs font-medium text-gray-900 underline underline-offset-2 hover:no-underline">
                      {action} →
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          )}
          {/* Stats cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {cards.map(card => (
              <div
                key={card.label}
                className={`bg-white border rounded-xl p-5 flex items-center gap-4 ${card.alert ? 'border-red-200 bg-red-50' : 'border-gray-200'}`}
              >
                <div className={`p-2.5 rounded-lg ${card.alert ? 'bg-red-100' : 'bg-gray-100'}`}>
                  <card.icon size={20} className={card.alert ? 'text-red-600' : 'text-gray-600'} />
                </div>
                <div className="min-w-0">
                  <p className="text-xl font-bold text-gray-900">{card.value}</p>
                  <p className="text-xs text-gray-500 mt-0.5 truncate">{card.label}</p>
                  {card.sub && (
                    <p className={`text-xs mt-0.5 truncate ${card.alert ? 'text-red-600 font-medium' : 'text-gray-400'}`}>
                      {card.sub}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Pipeline por etapa */}
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <div className="flex items-center gap-2 mb-5">
              <Clock size={16} className="text-gray-400" />
              <h2 className="font-semibold text-gray-900 text-sm">Pipeline por etapa</h2>
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
                    <div className="w-24 text-xs text-gray-500 text-right flex-shrink-0">{stage.name}</div>
                    <div className="flex-1 bg-gray-100 rounded-full h-2">
                      <div
                        className="h-2 rounded-full transition-all"
                        style={{ width: `${pct}%`, backgroundColor: stage.color }}
                      />
                    </div>
                    <div className="w-20 text-xs text-gray-600 font-medium">
                      {stageDeals.length > 0 ? `$${value.toLocaleString()}` : <span className="text-gray-300">—</span>}
                    </div>
                    <div className="w-6 text-xs text-gray-400 text-right">{stageDeals.length}</div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Tareas vencidas */}
          {stats.tasks.filter(t => !t.completed && t.dueDate && new Date((t.dueDate as unknown as { seconds: number })?.seconds ? (t.dueDate as unknown as { seconds: number }).seconds * 1000 : t.dueDate as unknown as number) < new Date()).length > 0 && (
            <div className="bg-white border border-red-200 rounded-xl p-6">
              <div className="flex items-center gap-2 mb-4">
                <AlertCircle size={16} className="text-red-500" />
                <h2 className="font-semibold text-gray-900 text-sm">Tareas vencidas</h2>
              </div>
              <div className="space-y-2">
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
                      <div key={task.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                        <p className="text-sm text-gray-800">{task.title}</p>
                        <span className="text-xs text-red-500 font-medium ml-4 flex-shrink-0">
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
