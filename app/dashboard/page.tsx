'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { getClients, getTasks, getDeals } from '@/lib/firestore'
import type { Deal, Task } from '@/types'
import Link from 'next/link'
import { Users, CheckSquare, TrendingUp, Clock, AlertCircle, DollarSign, Rocket, UserPlus } from 'lucide-react'

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

interface StatCardProps {
  title: string
  value: string | number
  sub?: string
  icon: React.ComponentType<{ size?: number; className?: string }>
  trend?: number
  colorClass: string
  alert?: boolean
}

function StatCard({ title, value, sub, icon: Icon, trend, colorClass, alert }: StatCardProps) {
  return (
    <div className={`bg-white dark:bg-slate-900 p-5 rounded-2xl border shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5 ${alert ? 'border-red-200 dark:border-red-900' : 'border-slate-100 dark:border-slate-800'}`}>
      <div className="flex justify-between items-start mb-4">
        <div className={`p-2.5 rounded-xl bg-opacity-10 ${colorClass}`}>
          <Icon size={20} />
        </div>
        {trend !== undefined && (
          <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${trend >= 0 ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'}`}>
            {trend >= 0 ? '↑' : '↓'} {Math.abs(trend)}%
          </span>
        )}
        {alert && (
          <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400">
            Urgente
          </span>
        )}
      </div>
      <p className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider">{title}</p>
      <h4 className="text-2xl font-black mt-1 text-slate-900 dark:text-white">{value}</h4>
      {sub && (
        <p className={`text-xs mt-1 truncate ${alert ? 'text-red-500 font-medium' : 'text-slate-400 dark:text-slate-500'}`}>{sub}</p>
      )}
    </div>
  )
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
        const pipelineValue = deals.filter(d => d.stage !== 'closed_lost').reduce((s, d) => s + (d.value ?? 0), 0)
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

  const overdueTasks = stats.tasks.filter(t => {
    if (t.completed || !t.dueDate) return false
    const due = (t.dueDate as unknown as { seconds: number })?.seconds
      ? new Date((t.dueDate as unknown as { seconds: number }).seconds * 1000)
      : new Date(t.dueDate as unknown as string)
    return due < new Date()
  })

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 dark:text-white">Panel General</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm font-medium">
            Bienvenido, <span className="text-blue-600 font-bold">{profile?.displayName?.split(' ')[0]}</span>
          </p>
        </div>
        <Link
          href="/dashboard/clients"
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold shadow-lg shadow-blue-500/20 transition-all hover:scale-105"
        >
          <UserPlus size={16} /> Nuevo Cliente
        </Link>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* Onboarding */}
          {stats.clients === 0 && (
            <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
              <div className="flex items-center gap-3 mb-5">
                <div className="p-2.5 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
                  <Rocket size={20} className="text-blue-600" />
                </div>
                <div>
                  <h2 className="font-black text-slate-900 dark:text-white">Bienvenido a NEXO CRM</h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Sigue estos pasos para empezar</p>
                </div>
              </div>
              <div className="space-y-2">
                {[
                  { step: 1, label: 'Agrega tus primeros clientes', href: '/dashboard/clients', action: 'Ir a Clientes' },
                  { step: 2, label: 'Invita a tu equipo', href: '/dashboard/users', action: 'Ir a Usuarios' },
                  { step: 3, label: 'Conecta WhatsApp Business', href: '/dashboard/settings', action: 'Configuración' },
                ].map(({ step, label, href, action }) => (
                  <div key={step} className="flex items-center justify-between py-3 px-4 bg-slate-50 dark:bg-slate-800 rounded-xl">
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-black flex-shrink-0">{step}</span>
                      <span className="text-sm text-slate-700 dark:text-slate-300 font-medium">{label}</span>
                    </div>
                    <Link href={href} className="text-xs font-bold text-blue-600 hover:text-blue-700 transition-colors">
                      {action} →
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Stat cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
            <StatCard
              title="Clientes Totales"
              value={stats.clients}
              sub={stats.newClientsThisMonth > 0 ? `+${stats.newClientsThisMonth} este mes` : undefined}
              icon={Users}
              trend={stats.newClientsThisMonth > 0 ? 8 : undefined}
              colorClass="text-blue-600 bg-blue-100 dark:bg-blue-900/30"
            />
            <StatCard
              title="Tareas Pendientes"
              value={stats.pendingTasks}
              sub={stats.overdueTasks > 0 ? `${stats.overdueTasks} vencidas` : 'Al día'}
              icon={stats.overdueTasks > 0 ? AlertCircle : CheckSquare}
              colorClass={stats.overdueTasks > 0 ? 'text-red-600 bg-red-100 dark:bg-red-900/30' : 'text-emerald-600 bg-emerald-100 dark:bg-emerald-900/30'}
              alert={stats.overdueTasks > 0}
            />
            <StatCard
              title="Valor en Pipeline"
              value={`$${stats.pipelineValue.toLocaleString()}`}
              sub={`${stats.deals.filter(d => d.stage !== 'closed_lost' && d.stage !== 'closed_won').length} oportunidades abiertas`}
              icon={TrendingUp}
              trend={12}
              colorClass="text-purple-600 bg-purple-100 dark:bg-purple-900/30"
            />
            <StatCard
              title="Ganado Este Mes"
              value={`$${stats.wonThisMonth.toLocaleString()}`}
              sub={`${stats.deals.filter(d => d.stage === 'closed_won').length} deals cerrados`}
              icon={DollarSign}
              trend={15}
              colorClass="text-amber-600 bg-amber-100 dark:bg-amber-900/30"
            />
          </div>

          {/* Pipeline por etapa */}
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-6">
              <Clock size={16} className="text-slate-400" />
              <h2 className="font-black text-slate-900 dark:text-white text-sm uppercase tracking-wider">Pipeline por etapa</h2>
            </div>
            <div className="space-y-4">
              {STAGES.map(stage => {
                const stageDeals = stats.deals.filter(d => d.stage === stage.id)
                const value = stageDeals.reduce((s, d) => s + (d.value ?? 0), 0)
                const maxVal = Math.max(...STAGES.map(s =>
                  stats.deals.filter(d => d.stage === s.id).reduce((acc, d) => acc + (d.value ?? 0), 0)
                ), 1)
                const pct = Math.round((value / maxVal) * 100)
                return (
                  <div key={stage.id} className="flex items-center gap-4">
                    <div className="w-24 text-xs font-bold text-slate-500 dark:text-slate-400 text-right flex-shrink-0">{stage.name}</div>
                    <div className="flex-1 bg-slate-100 dark:bg-slate-800 rounded-full h-2">
                      <div className="h-2 rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: stage.color }} />
                    </div>
                    <div className="w-20 text-xs font-bold text-slate-600 dark:text-slate-300">
                      {stageDeals.length > 0 ? `$${value.toLocaleString()}` : <span className="text-slate-300 dark:text-slate-600">—</span>}
                    </div>
                    <div className="w-6 text-xs text-slate-400 text-right">{stageDeals.length}</div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Tareas vencidas */}
          {overdueTasks.length > 0 && (
            <div className="bg-white dark:bg-slate-900 border border-red-200 dark:border-red-900/50 rounded-2xl p-6 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <AlertCircle size={16} className="text-red-500" />
                <h2 className="font-black text-slate-900 dark:text-white text-sm uppercase tracking-wider">Tareas Vencidas</h2>
              </div>
              <div className="space-y-2">
                {overdueTasks.slice(0, 5).map(task => {
                  const due = (task.dueDate as unknown as { seconds: number })?.seconds
                    ? new Date((task.dueDate as unknown as { seconds: number }).seconds * 1000)
                    : new Date(task.dueDate as unknown as string)
                  return (
                    <div key={task.id} className="flex items-center justify-between py-2.5 px-4 bg-red-50 dark:bg-red-900/10 rounded-xl">
                      <p className="text-sm text-slate-800 dark:text-slate-200 font-medium">{task.title}</p>
                      <span className="text-xs text-red-500 font-bold ml-4 flex-shrink-0">{due.toLocaleDateString('es')}</span>
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
