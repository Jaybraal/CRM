'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { getClients, getDeals, getTasks, getOrgUsers } from '@/lib/firestore'
import type { Client, Deal, Task, AppUser } from '@/types'
import { TrendingUp, Users, CheckSquare, DollarSign, Target, BarChart3, Download } from 'lucide-react'
import toast from 'react-hot-toast'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, FunnelChart, Funnel, LabelList
} from 'recharts'

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

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) => {
  if (active && payload?.length) {
    return (
      <div className="bg-gray-900 text-white text-xs px-3 py-2 rounded-lg shadow-lg">
        <p className="font-medium">{label}</p>
        <p>${payload[0].value.toLocaleString()}</p>
      </div>
    )
  }
  return null
}

const ClientTooltip = ({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) => {
  if (active && payload?.length) {
    return (
      <div className="bg-gray-900 text-white text-xs px-3 py-2 rounded-lg shadow-lg">
        <p className="font-medium">{label}</p>
        <p>{payload[0].value} clientes</p>
      </div>
    )
  }
  return null
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
    Promise.all([
      getClients(profile.orgId),
      getDeals(profile.orgId),
      getTasks(profile.orgId),
      getOrgUsers(profile.orgId),
    ]).then(([c, d, t, u]) => {
      setClients(c); setDeals(d); setTasks(t); setUsers(u)
    })
    .catch(() => toast.error('Error al cargar reportes'))
    .finally(() => setLoading(false))
  }, [profile])

  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

  const revenueData = (() => {
    const months = []
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

  const clientData = (() => {
    const months = []
    for (let i = period - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const label = d.toLocaleDateString('es', { month: 'short', year: '2-digit' })
      const count = clients.filter(c => {
        const t = getTs(c.createdAt)
        return t.getFullYear() === d.getFullYear() && t.getMonth() === d.getMonth()
      }).length
      months.push({ month: label, count })
    }
    return months
  })()

  const stageFunnel = STAGES.map(s => ({
    name: s.name,
    count: deals.filter(d => d.stage === s.id).length,
    value: deals.filter(d => d.stage === s.id).reduce((sum, d) => sum + (d.value ?? 0), 0),
    fill: s.color,
  }))

  const agentPerf = users
    .filter(u => u.role === 'agent' || u.role === 'manager')
    .map(u => ({
      name: u.displayName.split(' ')[0],
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

  const exportCSV = () => {
    const rows = [
      ['Periodo', 'Mes', 'Ingresos ($)', 'Clientes nuevos'],
      ...revenueData.map((r, i) => [period + 'm', r.month, r.value, clientData[i]?.count ?? 0]),
    ]
    const csv = rows.map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url
    a.download = `reporte_${new Date().toISOString().slice(0, 10)}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reportes</h1>
          <p className="text-gray-500 text-sm mt-1">Métricas de rendimiento de tu equipo</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={exportCSV} className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors">
            <Download size={14} /> Exportar CSV
          </button>
          <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
            {([3, 6, 12] as const).map(m => (
              <button key={m} onClick={() => setPeriod(m)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${period === m ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                {m}m
              </button>
            ))}
          </div>
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
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={revenueData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} tickFormatter={v => v > 0 ? `$${(v/1000).toFixed(0)}k` : '0'} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f9fafb' }} />
                <Bar dataKey="value" fill="#111827" radius={[4, 4, 0, 0]} maxBarSize={48} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Pipeline funnel */}
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <div className="flex items-center gap-2 mb-5">
              <BarChart3 size={16} className="text-gray-400" />
              <h2 className="font-semibold text-gray-900 text-sm">Embudo de conversión</h2>
            </div>
            <div className="space-y-2">
              {stageFunnel.map(s => {
                const maxCount = Math.max(...stageFunnel.map(x => x.count), 1)
                const pct = Math.max(s.count > 0 ? Math.round((s.count / maxCount) * 100) : 0, s.count > 0 ? 6 : 0)
                return (
                  <div key={s.name} className="flex items-center gap-3">
                    <div className="w-24 text-xs text-gray-500 text-right flex-shrink-0">{s.name}</div>
                    <div className="flex-1 bg-gray-100 rounded-full h-6 overflow-hidden">
                      <div className="h-6 rounded-full flex items-center px-2 transition-all" style={{ width: `${pct}%`, backgroundColor: s.fill }}>
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

          {/* Client growth */}
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <div className="flex items-center gap-2 mb-6">
              <Users size={16} className="text-gray-400" />
              <h2 className="font-semibold text-gray-900 text-sm">Nuevos clientes por mes</h2>
            </div>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={clientData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip content={<ClientTooltip />} cursor={{ stroke: '#e5e7eb' }} />
                <Line type="monotone" dataKey="count" stroke="#111827" strokeWidth={2} dot={{ r: 4, fill: '#111827' }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
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
        </>
      )}
    </div>
  )
}
