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
  super_admin: 'bg-gray-900 text-white',
  owner: 'bg-gray-800 text-white',
  manager: 'bg-gray-200 text-gray-800',
  supervisor: 'bg-blue-100 text-blue-800',
  agent: 'bg-gray-100 text-gray-600',
}

const inputClass = 'w-full bg-white border border-gray-300 rounded-lg px-4 py-2.5 text-gray-900 focus:outline-none focus:border-gray-500 text-sm'
const labelClass = 'block text-xs font-medium text-gray-600 mb-1.5'

function getMonthKey() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function ProgressBar({ value, goal, color = 'bg-gray-900' }: { value: number; goal: number; color?: string }) {
  const pct = goal > 0 ? Math.min(100, Math.round((value / goal) * 100)) : 0
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-gray-500">
        <span>{value} / {goal || '—'}</span>
        <span className={pct >= 100 ? 'text-green-600 font-medium' : ''}>{goal > 0 ? `${pct}%` : 'Sin meta'}</span>
      </div>
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
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
        headers: { 'Content-Type': 'application/json' },
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
          <h1 className="text-2xl font-bold text-gray-900">Usuarios & Equipo</h1>
          <p className="text-gray-500 text-sm mt-1">
            {rows.length} usuarios · Metas de {monthLabel}
          </p>
        </div>
        {canManage && (
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 bg-gray-900 hover:bg-gray-800 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
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
            <div key={c.label} className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-3">
              <div className="p-2 bg-gray-100 rounded-lg"><c.icon size={16} className="text-gray-700" /></div>
              <div>
                <p className="text-xl font-bold text-gray-900">{c.value}</p>
                <p className="text-xs text-gray-500">{c.label}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Users list */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-gray-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map(row => {
            const { user, goal, stats, expanded } = row
            const sessionId = user.whatsappSessionId || user.uid
            const isEditing = editingUser === user.uid
            const isEditingGoal = editGoalUid === user.uid
            const isSelf = user.uid === profile?.uid

            return (
              <div key={user.uid} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                {/* Main row */}
                <div className="flex items-center gap-4 px-5 py-4">
                  {/* Avatar */}
                  <div className="w-10 h-10 bg-gray-900 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                    {user.displayName?.[0]?.toUpperCase() || '?'}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    {isEditing ? (
                      <div className="flex flex-wrap gap-3 items-end">
                        <div>
                          <label className={labelClass}>Rol</label>
                          <select value={editRole} onChange={e => setEditRole(e.target.value as UserRole)}
                            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none">
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
                            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none w-44"
                          />
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => handleSaveUser(user.uid)}
                            className="flex items-center gap-1 px-3 py-1.5 bg-gray-900 text-white rounded-lg text-xs">
                            <Check size={12} /> Guardar
                          </button>
                          <button onClick={() => setEditingUser(null)}
                            className="flex items-center gap-1 px-3 py-1.5 border border-gray-200 rounded-lg text-xs">
                            <X size={12} /> Cancelar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-gray-900 text-sm">{user.displayName}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_COLORS[user.role]}`}>
                          {ROLE_LABELS[user.role]}
                        </span>
                        <span className="text-xs text-gray-400 hidden sm:inline">{user.email}</span>
                        {user.whatsappPhone && (
                          <span className="flex items-center gap-1 text-xs text-gray-500 bg-gray-50 px-2 py-0.5 rounded-full border border-gray-200">
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
                          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 transition-colors"
                          title="Conectar sesión WhatsApp"
                        >
                          <QrCode size={12} /> WA
                        </button>
                      )}
                      {canManage && !isSelf && user.role !== 'super_admin' && (
                        <>
                          <button
                            onClick={() => { setEditingUser(user.uid); setEditRole(user.role); setEditPhone(user.whatsappPhone || '') }}
                            className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                            title="Editar usuario"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={() => handleRemove(user)}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
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
                          className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
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
                  <div className="border-t border-gray-100 px-5 py-4 bg-gray-50">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Metas y rendimiento — {monthLabel}</p>
                      <div className="flex gap-2">
                        {user.whatsappPhone && (
                          <button
                            onClick={() => handleDisconnectSession(sessionId, user.displayName)}
                            className="flex items-center gap-1 px-2.5 py-1 text-xs text-red-600 border border-red-200 rounded-lg hover:bg-red-50"
                          >
                            <LogOut size={11} /> Cerrar sesión WA
                          </button>
                        )}
                        {canManage && (
                          <button
                            onClick={() => { setEditGoalUid(user.uid); setEditGoalForm({ messagesGoal: goal?.messagesGoal ?? 0, clientsGoal: goal?.clientsGoal ?? 0, dealsGoal: goal?.dealsGoal ?? 0, revenueGoal: goal?.revenueGoal ?? 0 }) }}
                            className="flex items-center gap-1 px-2.5 py-1 text-xs text-gray-600 border border-gray-200 rounded-lg hover:bg-white"
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
                            className="flex items-center gap-1 px-3 py-1.5 bg-gray-900 text-white rounded-lg text-xs">
                            <Check size={12} /> Guardar metas
                          </button>
                          <button onClick={() => setEditGoalUid(null)}
                            className="flex items-center gap-1 px-3 py-1.5 border border-gray-200 rounded-lg text-xs">
                            <X size={12} /> Cancelar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        <div>
                          <p className="flex items-center gap-1.5 text-xs text-gray-500 mb-1.5"><MessageSquare size={11} /> Mensajes</p>
                          <ProgressBar value={stats.messagesSent} goal={goal?.messagesGoal ?? 0} color="bg-blue-500" />
                        </div>
                        <div>
                          <p className="flex items-center gap-1.5 text-xs text-gray-500 mb-1.5"><Users size={11} /> Clientes</p>
                          <ProgressBar value={stats.clientsHandled} goal={goal?.clientsGoal ?? 0} color="bg-purple-500" />
                        </div>
                        <div>
                          <p className="flex items-center gap-1.5 text-xs text-gray-500 mb-1.5"><TrendingUp size={11} /> Deals</p>
                          <ProgressBar value={stats.dealsClosed} goal={goal?.dealsGoal ?? 0} color="bg-green-500" />
                        </div>
                        <div>
                          <p className="flex items-center gap-1.5 text-xs text-gray-500 mb-1.5"><DollarSign size={11} /> Revenue</p>
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
            <p className="text-xs text-gray-400 mt-1">Si el agente tendrá su propio número de WA.</p>
          </div>
          <button type="submit" disabled={creating}
            className="w-full bg-gray-900 hover:bg-gray-800 disabled:opacity-50 text-white font-semibold py-2.5 rounded-lg text-sm transition-colors">
            {creating ? 'Creando...' : 'Crear usuario'}
          </button>
        </form>
      </Modal>

      {/* QR Modal */}
      {qrModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-gray-900">Conectar WhatsApp</h3>
                <p className="text-xs text-gray-500 mt-0.5">{qrModal.agentName}</p>
              </div>
              <button onClick={() => setQrModal(null)} className="text-gray-400 hover:text-gray-700">
                <X size={20} />
              </button>
            </div>

            <div className="flex flex-col items-center gap-3">
              {qrData?.status === 'open' ? (
                <div className="text-center py-6">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <Wifi size={28} className="text-green-600" />
                  </div>
                  <p className="font-semibold text-green-700">¡Conectado!</p>
                </div>
              ) : qrData?.qr ? (
                <>
                  <img src={qrData.qr} alt="QR Code" className="w-52 h-52 rounded-xl border border-gray-200" />
                  <p className="text-xs text-center text-gray-500">
                    Abre WhatsApp → ⋮ → Dispositivos vinculados → Vincular dispositivo
                  </p>
                </>
              ) : (
                <div className="py-8 flex flex-col items-center gap-3">
                  <div className="w-10 h-10 border-4 border-gray-300 border-t-gray-700 rounded-full animate-spin" />
                  <p className="text-sm text-gray-500">Generando QR...</p>
                </div>
              )}
            </div>

            {qrData?.status !== 'open' && (
              <p className="text-xs text-center text-gray-400">
                Actualizando automáticamente cada 3 segundos
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
