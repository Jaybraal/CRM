'use client'

import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '@/context/AuthContext'
import {
  getOrgUsers, updateUserRole, removeUserFromOrg,
  getAllGoalsForMonth, setAgentGoal, getAgentStats
} from '@/lib/firestore'
import { updateDoc, doc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { AppUser, UserRole, AgentGoal } from '@/types'
import Modal from '@/components/ui/Modal'
import { Spinner } from '@/components/ui/primitives'
import {
  Plus, Mail, Shield, Pencil, Trash2, Phone, Wifi, WifiOff,
  QrCode, Target, ChevronDown, ChevronUp, Check, X,
  TrendingUp, Users, DollarSign, MessageSquare, RefreshCw, LogOut
} from 'lucide-react'
import toast from 'react-hot-toast'

const ROLE_LABELS: Record<UserRole, string> = {
  super_admin: 'Super Admin',
  owner: 'Propietario',
  manager: 'Manager',
  supervisor: 'Supervisor',
  agent: 'Agente',
}

const ROLE_COLORS: Record<UserRole, string> = {
  super_admin: 'bg-slate-900 dark:bg-slate-700 text-white',
  owner: 'bg-slate-800 dark:bg-slate-600 text-white',
  manager: 'bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200',
  supervisor: 'bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300',
  agent: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400',
}

const inputClass = 'w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 text-sm transition-colors'
const labelClass = 'block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5'

function getMonthKey() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function ProgressBar({ value, goal, color = 'bg-blue-600' }: { value: number; goal: number; color?: string }) {
  const pct = goal > 0 ? Math.min(100, Math.round((value / goal) * 100)) : 0
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400">
        <span>{value} / {goal || '—'}</span>
        <span className={pct >= 100 ? 'text-green-600 dark:text-green-400 font-bold' : ''}>{goal > 0 ? `${pct}%` : 'Sin meta'}</span>
      </div>
      <div className="h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${pct >= 100 ? 'bg-green-500' : color}`}
          style={{ width: `${Math.max(pct, 0)}%` }}
        />
      </div>
    </div>
  )
}

interface SessionInfo {
  status: 'open' | 'connecting' | 'qr' | 'disconnected'
  qr: string | null
}

interface UserRow {
  user: AppUser
  goal: AgentGoal | null
  stats: { messagesSent: number; clientsHandled: number; dealsClosed: number; revenue: number }
  session: SessionInfo | null
  expanded: boolean
}

export default function UsersPage() {
  const { profile } = useAuth()
  const [rows, setRows] = useState<UserRow[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'agent' as UserRole, whatsappPhone: '' })
  const month = getMonthKey()
  const canManage = profile?.role === 'owner' || profile?.role === 'super_admin' || profile?.role === 'manager'

  // Edit states
  const [editingUser, setEditingUser] = useState<string | null>(null)
  const [editRole, setEditRole] = useState<UserRole>('agent')
  const [editPhone, setEditPhone] = useState('')
  const [editGoalUid, setEditGoalUid] = useState<string | null>(null)
  const [editGoalForm, setEditGoalForm] = useState({ messagesGoal: 0, clientsGoal: 0, dealsGoal: 0, revenueGoal: 0 })

  // QR modal
  const [qrModal, setQrModal] = useState<{ sessionId: string; agentName: string } | null>(null)
  const [qrData, setQrData] = useState<SessionInfo | null>(null)
  const [qrPolling, setQrPolling] = useState(false)

  const load = useCallback(async () => {
    if (!profile?.orgId) { setLoading(false); return }
    const users = await getOrgUsers(profile.orgId)
    const goals = await getAllGoalsForMonth(profile.orgId, month)
    const goalsMap = Object.fromEntries(goals.map(g => [g.uid, g]))

    try {
      const rowsData: UserRow[] = await Promise.all(
        users.map(async user => {
          const stats = await getAgentStats(profile.orgId!, user.uid, month)
          return {
            user,
            goal: goalsMap[user.uid] ?? null,
            stats,
            session: null,
            expanded: false,
          }
        })
      )
      setRows(rowsData)
    } catch (e) { console.error('Error cargando usuarios:', e) }
    setLoading(false)
  }, [profile?.orgId, month])

  useEffect(() => { load() }, [load])

  // Poll QR when modal is open
  useEffect(() => {
    if (!qrModal) { setQrPolling(false); return }
    setQrPolling(true)
    const poll = async () => {
      try {
        const res = await fetch(`/api/whatsapp/sessions/${qrModal.sessionId}`)
        const data = await res.json() as SessionInfo
        setQrData(data)
        if (data.status === 'open') {
          toast.success('¡WhatsApp conectado!')
          setQrModal(null)
          load()
        }
      } catch {}
    }
    poll()
    const interval = setInterval(poll, 3000)
    return () => clearInterval(interval)
  }, [qrModal, load])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profile?.orgId) return
    setCreating(true)
    try {
      const res = await fetch('/api/users/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-uid': profile.uid },
        body: JSON.stringify({
          email: form.email,
          password: form.password,
          displayName: form.name,
          role: form.role,
          orgId: profile.orgId,
          whatsappPhone: form.whatsappPhone || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Error al crear usuario')
        return
      }
      toast.success('Usuario creado')
      setShowCreate(false)
      setForm({ name: '', email: '', password: '', role: 'agent', whatsappPhone: '' })
      load()
    } catch {
      toast.error('Error de conexión')
    } finally {
      setCreating(false)
    }
  }

  const handleSaveUser = async (uid: string) => {
    try {
      await updateDoc(doc(db, 'users', uid), {
        role: editRole,
        whatsappPhone: editPhone || null,
      })
      toast.success('Usuario actualizado')
      setEditingUser(null)
      load()
    } catch {
      toast.error('Error al actualizar')
    }
  }

  const handleRemove = async (user: AppUser) => {
    if (!confirm(`¿Eliminar a ${user.displayName}?`)) return
    try {
      await removeUserFromOrg(user.uid)
      toast.success('Usuario eliminado')
      load()
    } catch {
      toast.error('Error al eliminar')
    }
  }

  const handleSaveGoal = async (uid: string) => {
    if (!profile?.orgId) return
    try {
      await setAgentGoal(profile.orgId, uid, month, editGoalForm)
      toast.success('Metas guardadas')
      setEditGoalUid(null)
      load()
    } catch {
      toast.error('Error al guardar metas')
    }
  }

  const handleDisconnectSession = async (sessionId: string, agentName: string) => {
    if (!confirm(`¿Desconectar la sesión de WhatsApp de ${agentName}?`)) return
    try {
      await fetch(`/api/whatsapp/sessions/${sessionId}`, { method: 'DELETE' })
      toast.success('Sesión desconectada')
      load()
    } catch {
      toast.error('Error al desconectar')
    }
  }

  const toggleExpand = (uid: string) => {
    setRows(prev => prev.map(r => r.user.uid === uid ? { ...r, expanded: !r.expanded } : r))
  }

  const monthLabel = new Date().toLocaleDateString('es', { month: 'long', year: 'numeric' })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white">Usuarios & Equipo</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            {rows.length} usuarios · Metas de {monthLabel}
          </p>
        </div>
        {canManage && (
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl text-sm font-bold shadow-lg shadow-blue-500/20 transition-colors"
          >
            <Plus size={16} /> Agregar usuario
          </button>
        )}
      </div>

      {/* Summary */}
      {rows.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: 'Usuarios', value: rows.length, icon: Users },
            { label: 'Clientes totales', value: rows.reduce((s, r) => s + r.stats.clientsHandled, 0), icon: Target },
            { label: 'Deals cerrados', value: rows.reduce((s, r) => s + r.stats.dealsClosed, 0), icon: TrendingUp },
            { label: 'Revenue', value: `$${rows.reduce((s, r) => s + r.stats.revenue, 0).toLocaleString()}`, icon: DollarSign },
          ].map(c => (
            <div key={c.label} className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-sm p-4 flex items-center gap-3">
              <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-xl"><c.icon size={16} className="text-blue-600 dark:text-blue-400" /></div>
              <div>
                <p className="text-xl font-black text-slate-900 dark:text-white">{c.value}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">{c.label}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Users list */}
      {loading ? (
        <Spinner />
      ) : (
        <div className="space-y-3">
          {rows.map(row => {
            const { user, goal, stats, expanded } = row
            const sessionId = user.whatsappSessionId || user.uid
            const isEditing = editingUser === user.uid
            const isEditingGoal = editGoalUid === user.uid
            const isSelf = user.uid === profile?.uid

            return (
              <div key={user.uid} className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
                {/* Main row */}
                <div className="flex items-center gap-4 px-5 py-4">
                  {/* Avatar */}
                  <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-black text-sm flex-shrink-0">
                    {user.displayName?.[0]?.toUpperCase() || '?'}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    {isEditing ? (
                      <div className="flex flex-wrap gap-3 items-end">
                        <div>
                          <label className={labelClass}>Rol</label>
                          <select value={editRole} onChange={e => setEditRole(e.target.value as UserRole)}
                            className="border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:border-blue-500 transition-colors">
                            <option value="agent">Agente</option>
                            <option value="manager">Manager</option>
                            <option value="owner">Propietario</option>
                          </select>
                        </div>
                        <div>
                          <label className={labelClass}>Número WA (opcional)</label>
                          <input
                            value={editPhone}
                            onChange={e => setEditPhone(e.target.value)}
                            placeholder="5219991234567"
                            className="border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:border-blue-500 transition-colors w-44"
                          />
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => handleSaveUser(user.uid)}
                            className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-colors">
                            <Check size={12} /> Guardar
                          </button>
                          <button onClick={() => setEditingUser(null)}
                            className="flex items-center gap-1 px-3 py-1.5 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 rounded-xl text-xs transition-colors">
                            <X size={12} /> Cancelar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-slate-900 dark:text-white text-sm">{user.displayName}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${ROLE_COLORS[user.role]}`}>
                          {ROLE_LABELS[user.role]}
                        </span>
                        <span className="text-xs text-slate-400 dark:text-slate-500 hidden sm:inline">{user.email}</span>
                        {user.whatsappPhone && (
                          <span className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800 px-2 py-0.5 rounded-full border border-slate-200 dark:border-slate-700">
                            <Phone size={10} /> {user.whatsappPhone}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  {!isEditing && (
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {/* WA Session button */}
                      {user.whatsappPhone && (
                        <button
                          onClick={() => setQrModal({ sessionId, agentName: user.displayName })}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors"
                          title="Conectar sesión WhatsApp"
                        >
                          <QrCode size={12} /> WA
                        </button>
                      )}
                      {canManage && !isSelf && user.role !== 'super_admin' && (
                        <>
                          <button
                            onClick={() => { setEditingUser(user.uid); setEditRole(user.role); setEditPhone(user.whatsappPhone || '') }}
                            className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
                            title="Editar usuario"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={() => handleRemove(user)}
                            className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors"
                            title="Eliminar usuario"
                          >
                            <Trash2 size={14} />
                          </button>
                        </>
                      )}
                      {/* Expand goals */}
                      {(user.role === 'agent' || user.role === 'manager') && (
                        <button
                          onClick={() => toggleExpand(user.uid)}
                          className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
                          title="Ver metas"
                        >
                          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Expanded: goals & stats */}
                {expanded && !isEditing && (
                  <div className="border-t border-slate-100 dark:border-slate-800 px-5 py-4 bg-slate-50 dark:bg-slate-800/50">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Metas y rendimiento — {monthLabel}</p>
                      <div className="flex gap-2">
                        {user.whatsappPhone && (
                          <button
                            onClick={() => handleDisconnectSession(sessionId, user.displayName)}
                            className="flex items-center gap-1 px-2.5 py-1 text-xs text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                          >
                            <LogOut size={11} /> Cerrar sesión WA
                          </button>
                        )}
                        {canManage && (
                          <button
                            onClick={() => { setEditGoalUid(user.uid); setEditGoalForm({ messagesGoal: goal?.messagesGoal ?? 0, clientsGoal: goal?.clientsGoal ?? 0, dealsGoal: goal?.dealsGoal ?? 0, revenueGoal: goal?.revenueGoal ?? 0 }) }}
                            className="flex items-center gap-1 px-2.5 py-1 text-xs text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-white dark:hover:bg-slate-800 transition-colors"
                          >
                            <Target size={11} /> Editar metas
                          </button>
                        )}
                      </div>
                    </div>

                    {isEditingGoal ? (
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                          {[
                            { key: 'messagesGoal', label: 'Meta mensajes' },
                            { key: 'clientsGoal', label: 'Meta clientes' },
                            { key: 'dealsGoal', label: 'Meta deals' },
                            { key: 'revenueGoal', label: 'Meta revenue ($)' },
                          ].map(f => (
                            <div key={f.key}>
                              <label className={labelClass}>{f.label}</label>
                              <input
                                type="number"
                                min={0}
                                value={editGoalForm[f.key as keyof typeof editGoalForm]}
                                onChange={e => setEditGoalForm(p => ({ ...p, [f.key]: Number(e.target.value) }))}
                                className={inputClass}
                              />
                            </div>
                          ))}
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => handleSaveGoal(user.uid)}
                            className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-colors">
                            <Check size={12} /> Guardar metas
                          </button>
                          <button onClick={() => setEditGoalUid(null)}
                            className="flex items-center gap-1 px-3 py-1.5 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 rounded-xl text-xs transition-colors">
                            <X size={12} /> Cancelar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        <div>
                          <p className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 mb-1.5"><MessageSquare size={11} /> Mensajes</p>
                          <ProgressBar value={stats.messagesSent} goal={goal?.messagesGoal ?? 0} color="bg-blue-500" />
                        </div>
                        <div>
                          <p className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 mb-1.5"><Users size={11} /> Clientes</p>
                          <ProgressBar value={stats.clientsHandled} goal={goal?.clientsGoal ?? 0} color="bg-purple-500" />
                        </div>
                        <div>
                          <p className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 mb-1.5"><TrendingUp size={11} /> Deals</p>
                          <ProgressBar value={stats.dealsClosed} goal={goal?.dealsGoal ?? 0} color="bg-green-500" />
                        </div>
                        <div>
                          <p className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 mb-1.5"><DollarSign size={11} /> Revenue</p>
                          <ProgressBar value={stats.revenue} goal={goal?.revenueGoal ?? 0} color="bg-amber-500" />
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Create modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Agregar usuario" size="sm">
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className={labelClass}>Nombre completo *</label>
            <input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className={inputClass} placeholder="Juan Pérez" />
          </div>
          <div>
            <label className={labelClass}>Email *</label>
            <input required type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              className={inputClass} placeholder="juan@empresa.com" />
          </div>
          <div>
            <label className={labelClass}>Contraseña temporal *</label>
            <input required type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              minLength={6} className={inputClass} placeholder="Mínimo 6 caracteres" />
          </div>
          <div>
            <label className={labelClass}>Rol</label>
            <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value as UserRole }))} className={inputClass}>
              <option value="agent">Agente</option>
              <option value="supervisor">Supervisor</option>
              <option value="manager">Manager</option>
              <option value="owner">Propietario</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>Número WhatsApp propio (opcional)</label>
            <input value={form.whatsappPhone} onChange={e => setForm(f => ({ ...f, whatsappPhone: e.target.value }))}
              className={inputClass} placeholder="5219991234567 (con código de país)" />
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Si el agente tendrá su propio número de WA.</p>
          </div>
          <button type="submit" disabled={creating}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold py-2.5 rounded-xl shadow-lg shadow-blue-500/20 text-sm transition-colors">
            {creating ? 'Creando...' : 'Crear usuario'}
          </button>
        </form>
      </Modal>

      {/* QR Modal */}
      {qrModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-6 w-full max-w-sm shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white">Conectar WhatsApp</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{qrModal.agentName}</p>
              </div>
              <button onClick={() => setQrModal(null)} className="text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="flex flex-col items-center gap-3">
              {qrData?.status === 'open' ? (
                <div className="text-center py-6">
                  <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-3">
                    <Wifi size={28} className="text-green-600 dark:text-green-400" />
                  </div>
                  <p className="font-bold text-green-700 dark:text-green-400">¡Conectado!</p>
                </div>
              ) : qrData?.qr ? (
                <>
                  <img src={qrData.qr} alt="QR Code" className="w-52 h-52 rounded-xl border border-slate-200 dark:border-slate-700" />
                  <p className="text-xs text-center text-slate-500 dark:text-slate-400">
                    Abre WhatsApp → ⋮ → Dispositivos vinculados → Vincular dispositivo
                  </p>
                </>
              ) : (
                <div className="py-8 flex flex-col items-center gap-3">
                  <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
                  <p className="text-sm text-slate-500 dark:text-slate-400">Generando QR...</p>
                </div>
              )}
            </div>

            {qrData?.status !== 'open' && (
              <p className="text-xs text-center text-slate-400 dark:text-slate-500">
                Actualizando automáticamente cada 3 segundos
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
