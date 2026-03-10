'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { getOrgUsers, createUserProfile, updateUserRole, removeUserFromOrg } from '@/lib/firestore'
import { createUserWithEmailAndPassword } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import type { AppUser, UserRole } from '@/types'
import Modal from '@/components/ui/Modal'
import { Plus, Mail, Shield, Pencil, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'

const ROLE_LABELS: Record<UserRole, string> = {
  super_admin: 'Super Admin',
  owner: 'Propietario',
  manager: 'Manager',
  agent: 'Agente',
}

const ROLE_COLORS: Record<UserRole, string> = {
  super_admin: 'bg-gray-900 text-white',
  owner: 'bg-gray-200 text-gray-800',
  manager: 'bg-gray-100 text-gray-700',
  agent: 'bg-gray-100 text-gray-600',
}

const inputClass = 'w-full bg-white border border-gray-300 rounded-lg px-4 py-2.5 text-gray-900 focus:outline-none focus:border-gray-500'
const labelClass = 'block text-sm font-medium text-gray-700 mb-1.5'

export default function UsersPage() {
  const { profile } = useAuth()
  const [users, setUsers] = useState<AppUser[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [editUser, setEditUser] = useState<AppUser | null>(null)
  const [creating, setCreating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'agent' as UserRole })
  const [editRole, setEditRole] = useState<UserRole>('agent')

  const load = async () => {
    if (!profile?.orgId) { setLoading(false); return }
    const u = await getOrgUsers(profile.orgId)
    setUsers(u)
    setLoading(false)
  }

  useEffect(() => { load() }, [profile])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profile?.orgId) return
    setCreating(true)
    try {
      const cred = await createUserWithEmailAndPassword(auth, form.email, form.password)
      await createUserProfile(cred.user.uid, {
        email: form.email,
        displayName: form.name,
        role: form.role,
        orgId: profile.orgId,
      })
      toast.success('Usuario creado')
      setShowCreate(false)
      setForm({ name: '', email: '', password: '', role: 'agent' })
      load()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : ''
      if (msg.includes('email-already-in-use')) toast.error('El email ya está en uso')
      else toast.error('Error al crear usuario')
    } finally {
      setCreating(false)
    }
  }

  const openEdit = (user: AppUser) => {
    setEditUser(user)
    setEditRole(user.role)
  }

  const handleSaveRole = async () => {
    if (!editUser) return
    setSaving(true)
    try {
      await updateUserRole(editUser.uid, editRole)
      setUsers(prev => prev.map(u => u.uid === editUser.uid ? { ...u, role: editRole } : u))
      toast.success('Rol actualizado')
      setEditUser(null)
    } catch {
      toast.error('Error al actualizar')
    } finally {
      setSaving(false)
    }
  }

  const handleRemove = async (user: AppUser) => {
    if (!confirm(`¿Eliminar a ${user.displayName} de la organización?`)) return
    try {
      await removeUserFromOrg(user.uid)
      setUsers(prev => prev.filter(u => u.uid !== user.uid))
      setEditUser(null)
      toast.success('Usuario eliminado de la organización')
    } catch {
      toast.error('Error al eliminar')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Usuarios</h1>
          <p className="text-gray-500 text-sm mt-1">{users.length} usuarios en tu organización</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 bg-gray-900 hover:bg-gray-800 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
        >
          <Plus size={18} /> Invitar usuario
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-gray-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left px-6 py-4 text-xs font-medium text-gray-400 uppercase tracking-wider">Usuario</th>
                <th className="text-left px-6 py-4 text-xs font-medium text-gray-400 uppercase tracking-wider hidden sm:table-cell">Email</th>
                <th className="text-left px-6 py-4 text-xs font-medium text-gray-400 uppercase tracking-wider">Rol</th>
                <th className="px-6 py-4 w-12" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {users.map(user => (
                <tr key={user.uid} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-gray-100 rounded-full flex items-center justify-center text-sm font-semibold text-gray-700 flex-shrink-0">
                        {user.displayName?.[0]?.toUpperCase() || '?'}
                      </div>
                      <span className="text-gray-900 font-medium">{user.displayName}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 hidden sm:table-cell">
                    <div className="flex items-center gap-2 text-gray-500 text-sm">
                      <Mail size={14} />
                      {user.email}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium ${ROLE_COLORS[user.role]}`}>
                      <Shield size={11} />
                      {ROLE_LABELS[user.role]}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {user.uid !== profile?.uid && user.role !== 'super_admin' && (
                      <button
                        onClick={() => openEdit(user)}
                        className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                      >
                        <Pencil size={14} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal crear */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Invitar usuario" size="sm">
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
            <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value as UserRole }))}
              className={inputClass}>
              <option value="agent">Agente</option>
              <option value="manager">Manager</option>
              <option value="owner">Propietario</option>
            </select>
          </div>
          <button type="submit" disabled={creating}
            className="w-full bg-gray-900 hover:bg-gray-800 disabled:opacity-50 text-white font-semibold py-2.5 rounded-lg transition-colors">
            {creating ? 'Creando...' : 'Crear usuario'}
          </button>
        </form>
      </Modal>

      {/* Modal editar */}
      <Modal open={!!editUser} onClose={() => setEditUser(null)} title="Editar usuario" size="sm">
        {editUser && (
          <div className="space-y-5">
            <div className="flex items-center gap-3 pb-4 border-b border-gray-100">
              <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center text-lg font-bold text-gray-700">
                {editUser.displayName?.[0]?.toUpperCase()}
              </div>
              <div>
                <p className="font-semibold text-gray-900">{editUser.displayName}</p>
                <p className="text-sm text-gray-500">{editUser.email}</p>
              </div>
            </div>

            <div>
              <label className={labelClass}>Cambiar rol</label>
              <select value={editRole} onChange={e => setEditRole(e.target.value as UserRole)} className={inputClass}>
                <option value="agent">Agente</option>
                <option value="manager">Manager</option>
                <option value="owner">Propietario</option>
              </select>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => handleRemove(editUser)}
                className="flex items-center gap-2 px-4 py-2.5 text-red-600 hover:bg-red-50 border border-red-200 rounded-lg text-sm transition-colors"
              >
                <Trash2 size={15} /> Eliminar
              </button>
              <button
                onClick={handleSaveRole}
                disabled={saving || editRole === editUser.role}
                className="flex-1 bg-gray-900 hover:bg-gray-800 disabled:opacity-50 text-white font-semibold py-2.5 rounded-lg transition-colors"
              >
                {saving ? 'Guardando...' : 'Guardar rol'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
