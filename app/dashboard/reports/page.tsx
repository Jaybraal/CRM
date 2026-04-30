'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { getClients, getDeals, getTasks, getOrgUsers } from '@/lib/firestore'
import type { Client, Deal, Task, AppUser } from '@/types'
import { TrendingUp, Users, CheckSquare, DollarSign, Target, BarChart3 } from 'lucide-react'
import toast from 'react-hot-toast'

interface MonthlyRevenue { month: string; value: number }
interface StageConversion { stage: string; count: number; value: number; color: string }
interface AgentPerf { name: string; clients: number; won: number; wonValue: number; tasksDone: number }

const STAGES = [
  { id: 'new', name: 'Nuevo', color: '#6b7280' },
  { id: 'contacted', name: 'Contactado', color: '#3b82f6' },
  { id: 'negotiation', name: 'Negociación', color: '#f59e0b' },
  { id: 'closed_won', name: 'Ganado', color: '#10b981' },
  { id: 'closed_lost', name: 'Perdido', color: '#ef4444' },
]

function getTs(d: unknown): Date {
  if (!d) return new Date()
  if (d instanceof Date) return d
  if (typeof d === 'object' && 'seconds' in (d as object)) return new Date((d as { seconds: number }).seconds * 1000)
  return new Date(d as string)
}

export default function ReportsPage() {
  const { profile } = useAuth()
  const [clients, setClients] = useState<Client[]>([])
  const [deals, setDeals] = useState<Deal[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [users, setUsers] = useState<AppUser[]>([])
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState<3 | 6 | 12>(6)

  useEffect(() => {
    if (!profile?.orgId) { setLoading(false); return }
    Promise.all([getClients(profile.orgId), getDeals(profile.orgId), getTasks(profile.orgId), getOrgUsers(profile.orgId)])
      .then(([c, d, t, u]) => { setClients(c); setDeals(d); setTasks(t); setUsers(u) })
      .catch(() => toast.error('Error al cargar reportes'))
      .finally(() => setLoading(false))
  }, [profile])

  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

  const monthlyRevenue: MonthlyRevenue[] = (() => {
    const months: MonthlyRevenue[] = []
    for (let i = period - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const label = d.toLocaleDateString('es', { month: 'short', year: '2-digit' })
      const value = deals.filter(deal => {
        if (deal.stage !== 'closed_won') return false
        const t = getTs(deal.updatedAt)
        return t.getFullYear() === d.getFullYear() && t.getMonth() === d.getMonth()
      }).reduce((s, deal) => s + (deal.value ?? 0), 0)
      months.push({ month: label, value })
    }
    return months
  })()

  const maxRevenue = Math.max(...monthlyRevenue.map(m => m.value), 1)

  const stageFunnel: StageConversion[] = STAGES.map(s => ({
    stage: s.name,
    count: deals.filter(d => d.stage === s.id).length,
    value: deals.filter(d => d.stage === s.id).reduce((sum, d) => sum + (d.value ?? 0), 0),
    color: s.color,
  }))
  const maxStageCount = Math.max(...stageFunnel.map(s => s.count), 1)

  const agentPerf: AgentPerf[] = users.filter(u => u.role === 'agent' || u.role === 'manager').map(u => ({
    name: u.displayName,
    clients: clients.filter(c => c.assignedTo === u.uid).length,
    won: deals.filter(d => d.assignedTo === u.uid && d.stage === 'closed_won').length,
    wonValue: deals.filter(d => d.assignedTo === u.uid && d.stage === 'closed_won').reduce((s, d) => s + (d.value ?? 0), 0),
    tasksDone: tasks.filter(t => t.assignedTo === u.uid && t.completed).length,
  }))

  const totalWon = deals.filter(d => d.stage === 'closed_won').reduce((s, d) => s + (d.value ?? 0), 0)
  const wonThisMonth = deals.filter(d => d.stage === 'closed_won' && getTs(d.updatedAt) >= startOfMonth).reduce((s, d) => s + (d.value ?? 0), 0)
  const conversionRate = deals.length > 0 ? Math.round((deals.filter(d => d.stage === 'closed_won').length / deals.length) * 100) : 0
  const taskCompletionRate = tasks.length > 0 ? Math.round((tasks.filter(t => t.completed).length / tasks.length) * 100) : 0
  const newClientsThisMonth = clients.filter(c => getTs(c.createdAt) >= startOfMonth).length

  const kpis = [
    { label: 'Ganado total', value: `$${totalWon.toLocaleString()}`, sub: `$${wonThisMonth.toLocaleString()} este mes`, icon: DollarSign, colorClass: 'text-blue-600 bg-blue-100 dark:bg-blue-900/30' },
    { label: 'Tasa de conversión', value: `${conversionRate}%`, sub: `${deals.filter(d => d.stage === 'closed_won').length} deals ganados`, icon: Target, colorClass: 'text-emerald-600 bg-emerald-100 dark:bg-emerald-900/30' },
    { label: 'Clientes nuevos', value: newClientsThisMonth.toString(), sub: `${clients.length} total`, icon: Users, colorClass: 'text-purple-600 bg-purple-100 dark:bg-purple-900/30' },
    { label: 'Tareas completadas', value: `${taskCompletionRate}%`, sub: `${tasks.filter(t => t.completed).length} / ${tasks.length}`, icon: CheckSquare, colorClass: 'text-amber-600 bg-amber-100 dark:bg-amber-900/30' },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-slate-900 dark:text-white">Reportes</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Métricas de rendimiento de tu equipo</p>
        </div>
        <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
          {([3, 6, 12] as const).map(m => (
            <button key={m} onClick={() => setPeriod(m)}
              className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-colors ${period === m ? 'bg-white dark:bg-slate-700 text-blue-600 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}>
              {m}m
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {kpis.map(kpi => (
              <div key={kpi.label} className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all">
                <div className={`p-2.5 rounded-xl w-fit mb-3 ${kpi.colorClass}`}>
                  <kpi.icon size={18} />
                </div>
                <p className="text-2xl font-black text-slate-900 dark:text-white">{kpi.value}</p>
                <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mt-0.5 uppercase tracking-wide">{kpi.label}</p>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{kpi.sub}</p>
              </div>
            ))}
          </div>

          {/* Revenue chart */}
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-6">
              <TrendingUp size={16} className="text-slate-400" />
              <h2 className="font-black text-slate-900 dark:text-white text-sm uppercase tracking-wider">Ingresos mensuales</h2>
            </div>
            <div className="flex items-end gap-2 h-40">
              {monthlyRevenue.map(m => {
                const pct = Math.round((m.value / maxRevenue) * 100)
                return (
                  <div key={m.month} className="flex-1 flex flex-col items-center gap-1.5 group">
                    <div className="relative w-full flex justify-center">
                      {m.value > 0 && (
                        <div className="absolute -top-6 opacity-0 group-hover:opacity-100 transition-opacity text-xs bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-2 py-1 rounded-lg whitespace-nowrap font-bold">
                          ${m.value.toLocaleString()}
                        </div>
                      )}
                    </div>
                    <div className="w-full flex items-end justify-center" style={{ height: '128px' }}>
                      <div className="w-full bg-blue-600 hover:bg-blue-500 rounded-t-lg transition-colors" style={{ height: `${Math.max(pct, m.value > 0 ? 4 : 0)}%` }} />
                    </div>
                    <span className="text-xs text-slate-400 dark:text-slate-500 text-center">{m.month}</span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Pipeline funnel */}
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-5">
              <BarChart3 size={16} className="text-slate-400" />
              <h2 className="font-black text-slate-900 dark:text-white text-sm uppercase tracking-wider">Embudo de conversión</h2>
            </div>
            <div className="space-y-3">
              {stageFunnel.map(s => {
                const pct = Math.round((s.count / maxStageCount) * 100)
                return (
                  <div key={s.stage} className="flex items-center gap-4">
                    <div className="w-24 text-xs font-bold text-slate-500 dark:text-slate-400 text-right flex-shrink-0">{s.stage}</div>
                    <div className="flex-1 bg-slate-100 dark:bg-slate-800 rounded-full h-6 overflow-hidden">
                      <div className="h-6 rounded-full flex items-center px-2 transition-all" style={{ width: `${Math.max(pct, s.count > 0 ? 8 : 0)}%`, backgroundColor: s.color }}>
                        {s.count > 0 && <span className="text-xs text-white font-black">{s.count}</span>}
                      </div>
                    </div>
                    <div className="w-24 text-xs font-bold text-slate-600 dark:text-slate-300 text-right">
                      {s.value > 0 ? `$${s.value.toLocaleString()}` : <span className="text-slate-300 dark:text-slate-600">—</span>}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Agent performance */}
          {agentPerf.length > 0 && (
            <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
              <div className="flex items-center gap-2 mb-5">
                <Users size={16} className="text-slate-400" />
                <h2 className="font-black text-slate-900 dark:text-white text-sm uppercase tracking-wider">Rendimiento del equipo</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 dark:border-slate-800">
                      {['Agente', 'Clientes', 'Deals ganados', 'Valor ganado', 'Tareas done'].map((h, i) => (
                        <th key={h} className={`text-xs font-black text-slate-400 uppercase tracking-widest pb-3 ${i === 0 ? 'text-left' : 'text-right'}`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {agentPerf.map(a => (
                      <tr key={a.name} className="border-b border-slate-50 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                        <td className="py-3 font-bold text-slate-900 dark:text-white">{a.name}</td>
                        <td className="py-3 text-right text-slate-600 dark:text-slate-300">{a.clients}</td>
                        <td className="py-3 text-right text-slate-600 dark:text-slate-300">{a.won}</td>
                        <td className="py-3 text-right font-black text-blue-600">${a.wonValue.toLocaleString()}</td>
                        <td className="py-3 text-right text-slate-600 dark:text-slate-300">{a.tasksDone}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Client growth */}
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-5">
              <Users size={16} className="text-slate-400" />
              <h2 className="font-black text-slate-900 dark:text-white text-sm uppercase tracking-wider">Nuevos clientes por mes</h2>
            </div>
            <div className="flex items-end gap-2 h-32">
              {(() => {
                const mths = []
                for (let i = period - 1; i >= 0; i--) {
                  const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
                  const label = d.toLocaleDateString('es', { month: 'short', year: '2-digit' })
                  const count = clients.filter(c => { const t = getTs(c.createdAt); return t.getFullYear() === d.getFullYear() && t.getMonth() === d.getMonth() }).length
                  mths.push({ month: label, count })
                }
                const maxC = Math.max(...mths.map(m => m.count), 1)
                return mths.map(m => {
                  const pct = Math.round((m.count / maxC) * 100)
                  return (
                    <div key={m.month} className="flex-1 flex flex-col items-center gap-1.5">
                      <div className="w-full flex items-end justify-center" style={{ height: '100px' }}>
                        <div className="w-full bg-indigo-500 hover:bg-indigo-400 rounded-t-lg transition-colors" style={{ height: `${Math.max(pct, m.count > 0 ? 4 : 0)}%` }} />
                      </div>
                      <span className="text-xs text-slate-400 dark:text-slate-500 text-center">{m.month}</span>
                    </div>
                  )
                })
              })()}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
