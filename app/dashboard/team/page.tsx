'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { getOrgUsers, getAllGoalsForMonth, setAgentGoal, getAgentStats } from '@/lib/firestore'
import type { AppUser, AgentGoal } from '@/types'
import { Target, TrendingUp, Users, DollarSign, MessageSquare, Pencil, Check, X } from 'lucide-react'
import toast from 'react-hot-toast'

function getMonthKey() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function ProgressBar({ value, goal, color = 'bg-gray-900' }: { value: number; goal: number; color?: string }) {
  const pct = goal > 0 ? Math.min(100, Math.round((value / goal) * 100)) : 0
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-gray-500">
        <span>{value} / {goal}</span>
        <span>{pct}%</span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${pct >= 100 ? 'bg-green-500' : color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

interface AgentRow {
  user: AppUser
  goal: AgentGoal | null
  stats: { messagesSent: number; clientsHandled: number; dealsClosed: number; revenue: number }
}

export default function TeamPage() {
  const { profile } = useAuth()
  const [rows, setRows] = useState<AgentRow[]>([])
  const [loading, setLoading] = useState(true)
  const [editingUid, setEditingUid] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({ messagesGoal: 0, clientsGoal: 0, dealsGoal: 0, revenueGoal: 0 })
  const [saving, setSaving] = useState(false)
  const month = getMonthKey()
  const canEdit = profile?.role === 'owner' || profile?.role === 'manager' || profile?.role === 'super_admin'

  const load = async () => {
    if (!profile?.orgId) { setLoading(false); return }
    const users = await getOrgUsers(profile.orgId)
    const agents = users.filter(u => u.role === 'agent' || u.role === 'manager')
    const goals = await getAllGoalsForMonth(profile.orgId, month)
    const goalsMap = Object.fromEntries(goals.map(g => [g.uid, g]))

    try {
      const rowsData: AgentRow[] = await Promise.all(
        agents.map(async user => {
          const stats = await getAgentStats(profile.orgId!, user.uid, month)
          return { user, goal: goalsMap[user.uid] ?? null, stats }
        })
      )
      setRows(rowsData)
    } catch (e) { console.error('Error cargando equipo:', e) }
    setLoading(false)
  }

  useEffect(() => { load() }, [profile])

  const openEdit = (row: AgentRow) => {
    setEditingUid(row.user.uid)
    setEditForm({
      messagesGoal: row.goal?.messagesGoal ?? 0,
      clientsGoal: row.goal?.clientsGoal ?? 0,
      dealsGoal: row.goal?.dealsGoal ?? 0,
      revenueGoal: row.goal?.revenueGoal ?? 0,
    })
  }

  const handleSaveGoal = async (uid: string) => {
    if (!profile?.orgId) return
    setSaving(true)
    try {
      await setAgentGoal(profile.orgId, uid, month, editForm)
      toast.success('Metas guardadas')
      setEditingUid(null)
      load()
    } catch {
      toast.error('Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  const monthLabel = new Date().toLocaleDateString('es', { month: 'long', year: 'numeric' })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Equipo</h1>
        <p className="text-gray-500 text-sm mt-1">Metas y rendimiento de vendedores — {monthLabel}</p>
      </div>

      {/* Summary cards */}
      {rows.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Agentes activos', value: rows.length, icon: Users, color: 'text-blue-600 bg-blue-50' },
            { label: 'Clientes totales', value: rows.reduce((s, r) => s + r.stats.clientsHandled, 0), icon: Target, color: 'text-purple-600 bg-purple-50' },
            { label: 'Deals cerrados', value: rows.reduce((s, r) => s + r.stats.dealsClosed, 0), icon: TrendingUp, color: 'text-green-600 bg-green-50' },
            { label: 'Revenue total', value: `$${rows.reduce((s, r) => s + r.stats.revenue, 0).toLocaleString()}`, icon: DollarSign, color: 'text-amber-600 bg-amber-50' },
          ].map(card => (
            <div key={card.label} className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${card.color}`}>
                  <card.icon size={18} />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{card.value}</p>
                  <p className="text-xs text-gray-500">{card.label}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Agents */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-gray-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : rows.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
          <Users size={40} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500">No hay agentes en tu organización aún.</p>
          <p className="text-gray-400 text-sm mt-1">Invita usuarios desde la sección Usuarios.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {rows.map(row => (
            <div key={row.user.uid} className="bg-white border border-gray-200 rounded-xl p-5">
              {/* Agent header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gray-900 rounded-full flex items-center justify-center text-white font-bold text-sm">
                    {row.user.displayName?.[0]?.toUpperCase() || '?'}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">{row.user.displayName}</p>
                    <p className="text-xs text-gray-500 capitalize">{row.user.role} · {row.user.email}</p>
                  </div>
                </div>
                {canEdit && editingUid !== row.user.uid && (
                  <button
                    onClick={() => openEdit(row)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <Pencil size={12} /> Editar metas
                  </button>
                )}
                {editingUid === row.user.uid && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleSaveGoal(row.user.uid)}
                      disabled={saving}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50"
                    >
                      <Check size={12} /> Guardar
                    </button>
                    <button
                      onClick={() => setEditingUid(null)}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50"
                    >
                      <X size={12} /> Cancelar
                    </button>
                  </div>
                )}
              </div>

              {/* Edit form */}
              {editingUid === row.user.uid ? (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 pt-3 border-t border-gray-100">
                  {[
                    { key: 'messagesGoal', label: 'Meta mensajes' },
                    { key: 'clientsGoal', label: 'Meta clientes' },
                    { key: 'dealsGoal', label: 'Meta deals' },
                    { key: 'revenueGoal', label: 'Meta revenue ($)' },
                  ].map(f => (
                    <div key={f.key}>
                      <label className="block text-xs text-gray-500 mb-1">{f.label}</label>
                      <input
                        type="number"
                        min={0}
                        value={editForm[f.key as keyof typeof editForm]}
                        onChange={e => setEditForm(prev => ({ ...prev, [f.key]: Number(e.target.value) }))}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gray-400"
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-3 border-t border-gray-100">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <MessageSquare size={12} /> Mensajes
                    </div>
                    <ProgressBar
                      value={row.stats.messagesSent}
                      goal={row.goal?.messagesGoal ?? 0}
                      color="bg-blue-500"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <Users size={12} /> Clientes
                    </div>
                    <ProgressBar
                      value={row.stats.clientsHandled}
                      goal={row.goal?.clientsGoal ?? 0}
                      color="bg-purple-500"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <TrendingUp size={12} /> Deals cerrados
                    </div>
                    <ProgressBar
                      value={row.stats.dealsClosed}
                      goal={row.goal?.dealsGoal ?? 0}
                      color="bg-green-500"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <DollarSign size={12} /> Revenue
                    </div>
                    <ProgressBar
                      value={row.stats.revenue}
                      goal={row.goal?.revenueGoal ?? 0}
                      color="bg-amber-500"
                    />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
