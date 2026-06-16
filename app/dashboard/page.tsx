'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { getClients, getTasks, getDeals } from '@/lib/firestore'
import type { Deal, Task } from '@/types'
import Link from 'next/link'
import { Users, CheckSquare, TrendingUp, Clock, AlertCircle, DollarSign, Rocket, UserPlus } from 'lucide-react'
import { PageHeader, Card, StatCard, Spinner, Button } from '@/components/ui/primitives'

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
      <PageHeader
        title="Panel General"
        subtitle={<>Bienvenido, <span className="text-[#0D7A65] font-bold">{profile?.displayName?.split(' ')[0]}</span></>}
      >
        <Link href="/dashboard/clients">
          <Button><UserPlus size={16} /> Nuevo Cliente</Button>
        </Link>
      </PageHeader>

      {loading ? (
        <Spinner />
      ) : (
        <>
          {/* Onboarding */}
          {stats.clients === 0 && (
            <Card>
              <div className="flex items-center gap-3 mb-5">
                <div className="p-2.5 bg-[#F4F5F7] dark:bg-[#0D7A65]/10 rounded-md">
                  <Rocket size={20} className="text-[#0D7A65]" />
                </div>
                <div>
                  <h2 className="font-bold text-[#0C1224] dark:text-[#E8ECF4]">Bienvenido a NEXO CRM</h2>
                  <p className="text-sm text-[#68748D] dark:text-[#9BA5B7]">Sigue estos pasos para empezar</p>
                </div>
              </div>
              <div className="space-y-2">
                {[
                  { step: 1, label: 'Agrega tus primeros clientes', href: '/dashboard/clients', action: 'Ir a Clientes' },
                  { step: 2, label: 'Invita a tu equipo', href: '/dashboard/users', action: 'Ir a Usuarios' },
                  { step: 3, label: 'Conecta WhatsApp Business', href: '/dashboard/settings', action: 'Configuración' },
                ].map(({ step, label, href, action }) => (
                  <div key={step} className="flex items-center justify-between py-3 px-4 bg-[#F4F5F7] dark:bg-[#1A2540] rounded-md">
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 bg-[#0C1224] text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">{step}</span>
                      <span className="text-sm text-[#0C1224] dark:text-[#9BA5B7] font-medium">{label}</span>
                    </div>
                    <Link href={href} className="text-xs font-bold text-[#0D7A65] hover:text-blue-700 transition-colors">
                      {action} →
                    </Link>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Stat cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
            <StatCard
              title="Clientes Totales"
              value={stats.clients}
              sub={stats.newClientsThisMonth > 0 ? `+${stats.newClientsThisMonth} este mes` : undefined}
              icon={Users}
              colorClass="text-[#0D7A65] bg-[#0D7A65]/10 dark:bg-[#0D7A65]/10"
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
              colorClass="text-purple-600 bg-purple-100 dark:bg-purple-900/30"
            />
            <StatCard
              title="Ganado Este Mes"
              value={`$${stats.wonThisMonth.toLocaleString()}`}
              sub={`${stats.deals.filter(d => d.stage === 'closed_won').length} deals cerrados`}
              icon={DollarSign}
              colorClass="text-amber-600 bg-amber-100 dark:bg-amber-900/30"
            />
          </div>

          {/* Pipeline por etapa */}
          <Card padded={false} className="p-6">
            <div className="flex items-center gap-2 mb-6">
              <Clock size={16} className="text-[#9BA5B7]" />
              <h2 className="font-bold text-[#0C1224] dark:text-[#E8ECF4] text-sm uppercase tracking-wider">Pipeline por etapa</h2>
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
                    <div className="w-24 text-xs font-bold text-[#68748D] dark:text-[#9BA5B7] text-right flex-shrink-0">{stage.name}</div>
                    <div className="flex-1 bg-[#F4F5F7] dark:bg-[#1A2540] rounded-full h-2">
                      <div className="h-2 rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: stage.color }} />
                    </div>
                    <div className="w-20 text-xs font-bold text-[#68748D] dark:text-[#9BA5B7]">
                      {stageDeals.length > 0 ? `$${value.toLocaleString()}` : <span className="text-[#9BA5B7] dark:text-[#68748D]">—</span>}
                    </div>
                    <div className="w-6 text-xs text-[#9BA5B7] text-right">{stageDeals.length}</div>
                  </div>
                )
              })}
            </div>
          </Card>

          {/* Tareas vencidas */}
          {overdueTasks.length > 0 && (
            <Card padded={false} className="p-6 border-red-200 dark:border-red-900/50">
              <div className="flex items-center gap-2 mb-4">
                <AlertCircle size={16} className="text-red-500" />
                <h2 className="font-bold text-[#0C1224] dark:text-[#E8ECF4] text-sm uppercase tracking-wider">Tareas Vencidas</h2>
              </div>
              <div className="space-y-2">
                {overdueTasks.slice(0, 5).map(task => {
                  const due = (task.dueDate as unknown as { seconds: number })?.seconds
                    ? new Date((task.dueDate as unknown as { seconds: number }).seconds * 1000)
                    : new Date(task.dueDate as unknown as string)
                  return (
                    <div key={task.id} className="flex items-center justify-between py-2.5 px-4 bg-red-50 dark:bg-red-900/10 rounded-md">
                      <p className="text-sm text-[#0C1224] dark:text-[#E8ECF4] font-medium">{task.title}</p>
                      <span className="text-xs text-red-500 font-bold ml-4 flex-shrink-0">{due.toLocaleDateString('es')}</span>
                    </div>
                  )
                })}
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
