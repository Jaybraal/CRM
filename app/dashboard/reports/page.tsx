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
    if (!profile) return
    if (!profile.orgId) { setLoading(false); return }
    Promise.all([
      getClients(profile.orgId),
      getDeals(profile.orgId),
      getTasks(profile.orgId),
      getOrgUsers(profile.orgId),
    ]).then(([c, d, t, u]) => {
      setClients(c)
      setDeals(d)
      setTasks(t)
      setUsers(u)
    })
    .catch(e => { console.error('Error cargando reportes:', e); toast.error('Error al cargar reportes') })
    .finally(() => setLoading(false))
  }, [profile])

  // Monthly revenue (won deals by month)
  const monthlyRevenue: MonthlyRevenue[] = (() => {
    const now = new Date()
    const months: MonthlyRevenue[] = []
    for (let i = period - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const label = d.toLocaleDateString('es', { month: 'short', year: '2-digit' })
      const value = deals
        .filter(deal => {
          if (deal.stage !== 'closed_won') return false
          const t = getTs(deal.updatedAt)
          return t.getFullYear() === d.getFullYear() && t.getMonth() === d.getMonth()
        })
        .reduce((s, deal) => s + (deal.value ?? 0), 0)
      months.push({ month: label, value })
    }
    return months
  })()

  const maxRevenue = Math.max(...monthlyRevenue.map(m => m.value), 1)

  // Stage funnel
  const stageFunnel: StageConversion[] = STAGES.map(s => ({
    stage: s.name,
    count: deals.filter(d => d.stage === s.id).length,
    value: deals.filter(d => d.stage === s.id).reduce((sum, d) => sum + (d.value ?? 0), 0),
    color: s.color,
  }))
  const maxStageCount = Math.max(...stageFunnel.map(s => s.count), 1)

  // Agent performance
  const agentPerf: AgentPerf[] = users
    .filter(u => u.role === 'agent' || u.role === 'manager')
    .map(u => ({
      name: u.displayName,
      clients: clients.filter(c => c.assignedTo === u.uid).length,
      won: deals.filter(d => d.assignedTo === u.uid && d.stage === 'closed_won').length,
      wonValue: deals.filter(d => d.assignedTo === u.uid && d.stage === 'closed_won').reduce((s, d) => s + (d.value ?? 0), 0),
      tasksDone: tasks.filter(t => t.assignedTo === u.uid && t.completed).length,
    }))

  // KPIs
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const totalWon = deals.filter(d => d.stage === 'closed_won').reduce((s, d) => s + (d.value ?? 0), 0)
  const wonThisMonth = deals.filter(d => d.stage === 'closed_won' && getTs(d.updatedAt) >= startOfMonth).reduce((s, d) => s + (d.value ?? 0), 0)
  const conversionRate = deals.length > 0 ? Math.round((deals.filter(d => d.stage === 'closed_won').length / deals.length) * 100) : 0
  const taskCompletionRate = tasks.length > 0 ? Math.round((tasks.filter(t => t.completed).length / tasks.length) * 100) : 0
  const newClientsThisMonth = clients.filter(c => getTs(c.createdAt) >= startOfMonth).length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reportes</h1>
          <p className="text-gray-500 text-sm mt-1">Métricas de rendimiento de tu equipo</p>
        </div>
        <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
          {([3, 6, 12] as const).map(m => (
            <button
              key={m}
              onClick={() => setPeriod(m)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${period === m ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              {m}m
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-gray-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Ganado total', value: `$${totalWon.toLocaleString()}`, sub: `$${wonThisMonth.toLocaleString()} este mes`, icon: DollarSign },
              { label: 'Tasa de conversión', value: `${conversionRate}%`, sub: `${deals.filter(d => d.stage === 'closed_won').length} deals ganados`, icon: Target },
              { label: 'Clientes nuevos', value: newClientsThisMonth.toString(), sub: `${clients.length} total`, icon: Users },
              { label: 'Tareas completadas', value: `${taskCompletionRate}%`, sub: `${tasks.filter(t => t.completed).length} / ${tasks.length}`, icon: CheckSquare },
            ].map(kpi => (
              <div key={kpi.label} className="bg-white border border-gray-200 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-1.5 bg-gray-100 rounded-lg">
                    <kpi.icon size={16} className="text-gray-600" />
                  </div>
                </div>
                <p className="text-2xl font-bold text-gray-900">{kpi.value}</p>
                <p className="text-xs text-gray-500 mt-0.5 truncate">{kpi.label}</p>
                <p className="text-xs text-gray-400 mt-0.5">{kpi.sub}</p>
              </div>
            ))}
          </div>

          {/* Revenue chart */}
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <div className="flex items-center gap-2 mb-6">
              <TrendingUp size={16} className="text-gray-400" />
              <h2 className="font-semibold text-gray-900 text-sm">Ingresos mensuales (deals ganados)</h2>
            </div>
            <div className="flex items-end gap-2 h-40">
              {monthlyRevenue.map(m => {
                const pct = Math.round((m.value / maxRevenue) * 100)
                return (
                  <div key={m.month} className="flex-1 flex flex-col items-center gap-1.5 group">
                    <div className="relative w-full flex justify-center">
                      {m.value > 0 && (
                        <div className="absolute -top-6 opacity-0 group-hover:opacity-100 transition-opacity text-xs bg-gray-900 text-white px-1.5 py-0.5 rounded whitespace-nowrap">
                          ${m.value.toLocaleString()}
                        </div>
                      )}
                    </div>
                    <div className="w-full flex items-end justify-center" style={{ height: '128px' }}>
                      <div
                        className="w-full bg-gray-900 rounded-t-md transition-all"
                        style={{ height: `${Math.max(pct, m.value > 0 ? 4 : 0)}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-400 text-center">{m.month}</span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Pipeline funnel */}
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <div className="flex items-center gap-2 mb-5">
              <BarChart3 size={16} className="text-gray-400" />
              <h2 className="font-semibold text-gray-900 text-sm">Embudo de conversión</h2>
            </div>
            <div className="space-y-3">
              {stageFunnel.map(s => {
                const pct = Math.round((s.count / maxStageCount) * 100)
                return (
                  <div key={s.stage} className="flex items-center gap-3">
                    <div className="w-24 text-xs text-gray-500 text-right flex-shrink-0">{s.stage}</div>
                    <div className="flex-1 bg-gray-100 rounded-full h-6 overflow-hidden">
                      <div
                        className="h-6 rounded-full flex items-center px-2 transition-all"
                        style={{ width: `${Math.max(pct, s.count > 0 ? 8 : 0)}%`, backgroundColor: s.color }}
                      >
                        {s.count > 0 && <span className="text-xs text-white font-medium">{s.count}</span>}
                      </div>
                    </div>
                    <div className="w-24 text-xs text-gray-600 font-medium text-right">
                      {s.value > 0 ? `$${s.value.toLocaleString()}` : <span className="text-gray-300">—</span>}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Agent performance */}
          {agentPerf.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl p-6">
              <div className="flex items-center gap-2 mb-5">
                <Users size={16} className="text-gray-400" />
                <h2 className="font-semibold text-gray-900 text-sm">Rendimiento del equipo</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left text-xs text-gray-400 font-medium pb-3">Agente</th>
                      <th className="text-right text-xs text-gray-400 font-medium pb-3">Clientes</th>
                      <th className="text-right text-xs text-gray-400 font-medium pb-3">Deals ganados</th>
                      <th className="text-right text-xs text-gray-400 font-medium pb-3">Valor ganado</th>
                      <th className="text-right text-xs text-gray-400 font-medium pb-3">Tareas done</th>
                    </tr>
                  </thead>
                  <tbody>
                    {agentPerf.map(a => (
                      <tr key={a.name} className="border-b border-gray-50">
                        <td className="py-3 font-medium text-gray-900">{a.name}</td>
                        <td className="py-3 text-right text-gray-600">{a.clients}</td>
                        <td className="py-3 text-right text-gray-600">{a.won}</td>
                        <td className="py-3 text-right font-semibold text-gray-900">${a.wonValue.toLocaleString()}</td>
                        <td className="py-3 text-right text-gray-600">{a.tasksDone}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Client growth */}
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <div className="flex items-center gap-2 mb-5">
              <Users size={16} className="text-gray-400" />
              <h2 className="font-semibold text-gray-900 text-sm">Nuevos clientes por mes</h2>
            </div>
            <div className="flex items-end gap-2 h-32">
              {(() => {
                const mths = []
                for (let i = period - 1; i >= 0; i--) {
                  const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
                  const label = d.toLocaleDateString('es', { month: 'short', year: '2-digit' })
                  const count = clients.filter(c => {
                    const t = getTs(c.createdAt)
                    return t.getFullYear() === d.getFullYear() && t.getMonth() === d.getMonth()
                  }).length
                  mths.push({ month: label, count })
                }
                const maxC = Math.max(...mths.map(m => m.count), 1)
                return mths.map(m => {
                  const pct = Math.round((m.count / maxC) * 100)
                  return (
                    <div key={m.month} className="flex-1 flex flex-col items-center gap-1.5">
                      <div className="w-full flex items-end justify-center" style={{ height: '100px' }}>
                        <div
                          className="w-full bg-gray-300 rounded-t-md transition-all"
                          style={{ height: `${Math.max(pct, m.count > 0 ? 4 : 0)}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-400 text-center">{m.month}</span>
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
