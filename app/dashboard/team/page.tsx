'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { getOrgUsers, getAllGoalsForMonth, setAgentGoal, getAgentStats } from '@/lib/firestore'
import type { AppUser, AgentGoal } from '@/types'
import { Target, TrendingUp, Users, DollarSign, MessageSquare, Pencil, Check, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { Spinner } from '@/components/ui/primitives'

function getMonthKey() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function ProgressBar({ value, goal, color = 'bg-[#0C1224]' }: { value: number; goal: number; color?: string }) {
  const pct = goal > 0 ? Math.min(100, Math.round((value / goal) * 100)) : 0
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-[#68748D] dark:text-[#9BA5B7]">
        <span>{value} / {goal}</span>
        <span className={pct >= 100 ? 'text-emerald-600 font-bold' : ''}>{pct}%</span>
      </div>
      <div className="h-2 bg-[#F4F5F7] dark:bg-[#1A2540] rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${pct >= 100 ? 'bg-emerald-500' : color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

interface AgentRow {
  user: AppUser
  goal: AgentGoal | null
  stats: { messagesSent: number; clientsHandled: number; dealsClosed: number; revenue: number }
}

const inputClass = 'border border-[#E3E6EC] dark:border-[#1A2540] bg-[#F4F5F7] dark:bg-[#1A2540] rounded-md px-3 py-2 text-sm text-[#0C1224] dark:text-[#E8ECF4] focus:outline-none focus:border-[#0D7A65] transition-colors'

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
    } catch (e) { console.error(e) }
    setLoading(false)
  }

  useEffect(() => { load() }, [profile])

  const openEdit = (row: AgentRow) => {
    setEditingUid(row.user.uid)
    setEditForm({ messagesGoal: row.goal?.messagesGoal ?? 0, clientsGoal: row.goal?.clientsGoal ?? 0, dealsGoal: row.goal?.dealsGoal ?? 0, revenueGoal: row.goal?.revenueGoal ?? 0 })
  }

  const handleSaveGoal = async (uid: string) => {
    if (!profile?.orgId) return
    setSaving(true)
    try {
      await setAgentGoal(profile.orgId, uid, month, editForm)
      toast.success('Metas guardadas')
      setEditingUid(null)
      load()
    } catch { toast.error('Error al guardar') }
    finally { setSaving(false) }
  }

  const monthLabel = new Date().toLocaleDateString('es', { month: 'long', year: 'numeric' })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#0C1224] dark:text-[#E8ECF4]">Equipo</h1>
        <p className="text-[#68748D] dark:text-[#9BA5B7] text-sm mt-1">Metas y rendimiento — <span className="capitalize font-medium">{monthLabel}</span></p>
      </div>

      {rows.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Agentes activos', value: rows.length, icon: Users, colorClass: 'text-[#0D7A65] bg-[#0D7A65]/10 dark:bg-[#0D7A65]/10' },
            { label: 'Clientes totales', value: rows.reduce((s, r) => s + r.stats.clientsHandled, 0), icon: Target, colorClass: 'text-purple-600 bg-purple-100 dark:bg-purple-900/30' },
            { label: 'Deals cerrados', value: rows.reduce((s, r) => s + r.stats.dealsClosed, 0), icon: TrendingUp, colorClass: 'text-emerald-600 bg-emerald-100 dark:bg-emerald-900/30' },
            { label: 'Revenue total', value: `$${rows.reduce((s, r) => s + r.stats.revenue, 0).toLocaleString()}`, icon: DollarSign, colorClass: 'text-amber-600 bg-amber-100 dark:bg-amber-900/30' },
          ].map(card => (
            <div key={card.label} className="bg-white dark:bg-[#0F1829] border border-[#E3E6EC] dark:border-[#1A2540] rounded-lg p-5 shadow-sm">
              <div className={`p-2.5 rounded-md w-fit mb-3 ${card.colorClass}`}><card.icon size={18} /></div>
              <p className="text-2xl font-bold text-[#0C1224] dark:text-[#E8ECF4]">{card.value}</p>
              <p className="text-xs font-bold text-[#68748D] dark:text-[#9BA5B7] uppercase tracking-wide mt-0.5">{card.label}</p>
            </div>
          ))}
        </div>
      )}

      {loading ? (
        <Spinner />
      ) : rows.length === 0 ? (
        <div className="bg-white dark:bg-[#0F1829] border border-[#E3E6EC] dark:border-[#1A2540] rounded-lg p-16 text-center shadow-sm">
          <Users size={40} className="mx-auto text-[#9BA5B7] mb-3" />
          <p className="text-[#68748D] dark:text-[#9BA5B7]">No hay agentes en tu organización aún.</p>
          <p className="text-[#9BA5B7] dark:text-[#68748D] text-sm mt-1">Invita usuarios desde la sección Usuarios.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {rows.map(row => (
            <div key={row.user.uid} className="bg-white dark:bg-[#0F1829] border border-[#E3E6EC] dark:border-[#1A2540] rounded-lg p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-[#0D7A65] rounded-md flex items-center justify-center text-white font-bold text-sm shadow-md">
                    {row.user.displayName?.[0]?.toUpperCase() || '?'}
                  </div>
                  <div>
                    <p className="font-bold text-[#0C1224] dark:text-[#E8ECF4]">{row.user.displayName}</p>
                    <p className="text-xs text-[#68748D] dark:text-[#9BA5B7] capitalize">{row.user.role} · {row.user.email}</p>
                  </div>
                </div>
                {canEdit && editingUid !== row.user.uid && (
                  <button onClick={() => openEdit(row)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-[#68748D] dark:text-[#9BA5B7] border border-[#E3E6EC] dark:border-[#1A2540] rounded-md hover:bg-[#F4F5F7] dark:hover:bg-[#1A2540] transition-colors">
                    <Pencil size={12} /> Editar metas
                  </button>
                )}
                {editingUid === row.user.uid && (
                  <div className="flex gap-2">
                    <button onClick={() => handleSaveGoal(row.user.uid)} disabled={saving} className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold bg-[#0C1224] hover:bg-[#1B2B4B] text-white rounded-md disabled:opacity-50 transition-colors">
                      <Check size={12} /> Guardar
                    </button>
                    <button onClick={() => setEditingUid(null)} className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold border border-[#E3E6EC] dark:border-[#1A2540] text-[#68748D] dark:text-[#9BA5B7] rounded-md hover:bg-[#F4F5F7] dark:hover:bg-[#1A2540] transition-colors">
                      <X size={12} /> Cancelar
                    </button>
                  </div>
                )}
              </div>

              {editingUid === row.user.uid ? (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 pt-4 border-t border-[#E3E6EC] dark:border-[#1A2540]">
                  {[
                    { key: 'messagesGoal', label: 'Meta mensajes' },
                    { key: 'clientsGoal', label: 'Meta clientes' },
                    { key: 'dealsGoal', label: 'Meta deals' },
                    { key: 'revenueGoal', label: 'Meta revenue ($)' },
                  ].map(f => (
                    <div key={f.key}>
                      <label className="block text-xs font-bold text-[#68748D] dark:text-[#9BA5B7] mb-1 uppercase tracking-wide">{f.label}</label>
                      <input type="number" min={0} value={editForm[f.key as keyof typeof editForm]}
                        onChange={e => setEditForm(prev => ({ ...prev, [f.key]: Number(e.target.value) }))}
                        className={inputClass} />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-4 border-t border-[#E3E6EC] dark:border-[#1A2540]">
                  {[
                    { icon: MessageSquare, label: 'Mensajes', value: row.stats.messagesSent, goal: row.goal?.messagesGoal ?? 0, color: 'bg-[#F4F5F7]0' },
                    { icon: Users, label: 'Clientes', value: row.stats.clientsHandled, goal: row.goal?.clientsGoal ?? 0, color: 'bg-purple-500' },
                    { icon: TrendingUp, label: 'Deals cerrados', value: row.stats.dealsClosed, goal: row.goal?.dealsGoal ?? 0, color: 'bg-emerald-500' },
                    { icon: DollarSign, label: 'Revenue', value: row.stats.revenue, goal: row.goal?.revenueGoal ?? 0, color: 'bg-amber-500' },
                  ].map(m => (
                    <div key={m.label} className="space-y-1.5">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-[#68748D] dark:text-[#9BA5B7] uppercase tracking-wide">
                        <m.icon size={11} /> {m.label}
                      </div>
                      <ProgressBar value={m.value} goal={m.goal} color={m.color} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
