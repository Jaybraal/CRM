'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import type { Organization, OrgStats } from '@/types'
import AuthGuard from '@/components/auth/AuthGuard'
import { Plus, Building2, Calendar, LogIn, Pencil, Trash2, Users, UserCheck, FolderKanban, X } from 'lucide-react'
import toast from 'react-hot-toast'

const PLAN_COLORS: Record<string, string> = {
  trial: 'bg-gray-800 text-gray-300',
  basic: 'bg-gray-700 text-gray-400',
  pro: 'bg-purple-900 text-purple-300',
}

interface OrgWithStats extends Organization {
  stats?: OrgStats
}

function DarkModal({ open, onClose, title, children, size = 'md' }: {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  size?: 'sm' | 'md' | 'lg'
}) {
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  const sizeClass = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl' }[size]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}>
      <div className={`w-full ${sizeClass} rounded-xl shadow-xl border`} style={{ backgroundColor: '#111827', borderColor: '#374151' }}>
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid #374151' }}>
          <h2 className="text-lg font-semibold text-white">{title}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  )
}

export default function AdminPage() {
  const { isSuperAdmin, user, profile } = useAuth()
  const [orgs, setOrgs] = useState<OrgWithStats[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [creating, setCreating] = useState(false)
  const [joiningOrgId, setJoiningOrgId] = useState<string | null>(null)

  const [editOrg, setEditOrg] = useState<Organization | null>(null)
  const [editForm, setEditForm] = useState({ name: '', industry: '', plan: 'trial' as Organization['plan'] })
  const [saving, setSaving] = useState(false)

  const [deleteOrg, setDeleteOrg] = useState<Organization | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState('')

  const [createForm, setCreateForm] = useState({
    orgName: '', industry: '', plan: 'trial' as Organization['plan'],
    ownerName: '', ownerEmail: '', ownerPassword: '',
  })

  const load = async () => {
    try {
      const res = await fetch('/api/admin/organizations')
      if (!res.ok) throw new Error('Error del servidor')
      const data = await res.json()
      setOrgs(data)
    } catch (err) {
      console.error('Error cargando organizaciones:', err)
      toast.error('Error al cargar organizaciones')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const handleJoinOrg = async (org: Organization) => {
    if (!user) return
    setJoiningOrgId(org.id)
    try {
      const res = await fetch(`/api/admin/users/${user.uid}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgId: org.id }),
      })
      if (!res.ok) throw new Error('No se pudo guardar')
      toast.success(`Unido a "${org.name}" — recarga la página`)
      setTimeout(() => window.location.reload(), 1500)
    } catch (err) {
      toast.error(`Error: ${err instanceof Error ? err.message : 'desconocido'}`)
    } finally {
      setJoiningOrgId(null)
    }
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreating(true)
    try {
      // 1. Crear org vía Admin SDK (evita que Brave bloquee Firestore cliente)
      const orgRes = await fetch('/api/admin/organizations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: createForm.orgName,
          ownerId: '',
          plan: createForm.plan,
          settings: { catalogEnabled: false, industry: createForm.industry },
        }),
      })
      const orgData = await orgRes.json()
      if (!orgRes.ok) throw new Error(orgData.error || 'Error al crear organización')
      const tempOrgId = orgData.id

      // 2. Crear el usuario vía Admin SDK (no afecta la sesión actual)
      const userRes = await fetch('/api/users/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: createForm.ownerEmail,
          password: createForm.ownerPassword,
          displayName: createForm.ownerName,
          role: 'owner',
          orgId: tempOrgId,
        }),
      })
      const userData = await userRes.json()
      if (!userRes.ok) throw new Error(userData.error || 'Error al crear usuario')

      // 3. Actualizar ownerId en la org con el uid real
      await fetch(`/api/admin/organizations/${tempOrgId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ownerId: userData.uid }),
      })

      toast.success(`Organización "${createForm.orgName}" creada`)
      setShowCreateForm(false)
      setCreateForm({ orgName: '', industry: '', plan: 'trial', ownerName: '', ownerEmail: '', ownerPassword: '' })
      load()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : ''
      if (msg.includes('email-already-in-use') || msg.includes('ya está en uso')) toast.error('Email ya registrado')
      else toast.error(`Error: ${msg || 'desconocido'}`)
    } finally {
      setCreating(false)
    }
  }

  const openEdit = (org: Organization) => {
    setEditOrg(org)
    setEditForm({ name: org.name, industry: org.settings?.industry || '', plan: org.plan })
  }

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editOrg) return
    setSaving(true)
    try {
      const res = await fetch(`/api/admin/organizations/${editOrg.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editForm.name,
          plan: editForm.plan,
          'settings.industry': editForm.industry,
        }),
      })
      if (!res.ok) throw new Error()
      setOrgs(prev => prev.map(o => o.id === editOrg.id
        ? { ...o, name: editForm.name, plan: editForm.plan, settings: { ...o.settings, industry: editForm.industry } }
        : o
      ))
      toast.success('Organización actualizada')
      setEditOrg(null)
    } catch {
      toast.error('Error al actualizar')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteOrg || deleteConfirm !== deleteOrg.name) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/admin/organizations/${deleteOrg.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      setOrgs(prev => prev.filter(o => o.id !== deleteOrg.id))
      toast.success(`"${deleteOrg.name}" eliminada`)
      setDeleteOrg(null)
      setDeleteConfirm('')
    } catch {
      toast.error('Error al eliminar')
    } finally {
      setDeleting(false)
    }
  }

  if (!isSuperAdmin) {
    return <div className="text-center py-20 text-gray-500">Acceso denegado</div>
  }

  const inputClass = "w-full rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:ring-1 focus:ring-gray-500"
  const inputStyle = { backgroundColor: '#1f2937', border: '1px solid #374151' }

  return (
    <AuthGuard allowedRoles={['super_admin']}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Panel Super Admin</h1>
            <p className="text-gray-500 text-sm mt-1">{orgs.length} organizaciones registradas</p>
          </div>
          <button
            onClick={() => setShowCreateForm(true)}
            className="flex items-center gap-2 bg-gray-900 hover:bg-gray-800 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
          >
            <Plus size={18} /> Nueva organización
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-4 border-gray-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : orgs.length === 0 ? (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-12 text-center">
            <p className="text-gray-500">No hay organizaciones. Crea la primera.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {orgs.map(org => (
              <div key={org.id} className="bg-gray-900 border border-gray-800 rounded-xl p-5 hover:border-gray-600 transition-colors">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 bg-gray-800 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Building2 size={18} className="text-gray-400" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-semibold text-white truncate">{org.name}</h3>
                      {org.settings?.industry && (
                        <p className="text-xs text-gray-500 truncate">{org.settings.industry}</p>
                      )}
                    </div>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize flex-shrink-0 ${PLAN_COLORS[org.plan]}`}>
                    {org.plan}
                  </span>
                </div>

                {org.stats ? (
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    <div className="bg-gray-800 rounded-lg px-2 py-2 text-center">
                      <Users size={12} className="text-gray-500 mx-auto mb-0.5" />
                      <p className="text-sm font-bold text-white">{org.stats.users}</p>
                      <p className="text-xs text-gray-600">usuarios</p>
                    </div>
                    <div className="bg-gray-800 rounded-lg px-2 py-2 text-center">
                      <UserCheck size={12} className="text-gray-500 mx-auto mb-0.5" />
                      <p className="text-sm font-bold text-white">{org.stats.clients}</p>
                      <p className="text-xs text-gray-600">clientes</p>
                    </div>
                    <div className="bg-gray-800 rounded-lg px-2 py-2 text-center">
                      <FolderKanban size={12} className="text-gray-500 mx-auto mb-0.5" />
                      <p className="text-sm font-bold text-white">{org.stats.deals}</p>
                      <p className="text-xs text-gray-600">deals</p>
                    </div>
                  </div>
                ) : (
                  <div className="h-14 flex items-center justify-center mb-3">
                    <div className="w-4 h-4 border-2 border-gray-600 border-t-transparent rounded-full animate-spin" />
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <div className="text-xs text-gray-600 flex items-center gap-1.5">
                    <Calendar size={11} />
                    {(() => {
                      const ts = org.createdAt as unknown as { seconds?: number; _seconds?: number }
                      const secs = ts?._seconds ?? ts?.seconds
                      return secs ? new Date(secs * 1000).toLocaleDateString('es') : '-'
                    })()}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openEdit(org)}
                      className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-gray-700 transition-colors"
                      title="Editar"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => { setDeleteOrg(org); setDeleteConfirm('') }}
                      className="p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-900/20 transition-colors"
                      title="Eliminar"
                    >
                      <Trash2 size={14} />
                    </button>
                    <button
                      onClick={() => handleJoinOrg(org)}
                      disabled={joiningOrgId === org.id || profile?.orgId === org.id}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ml-1 ${
                        profile?.orgId === org.id
                          ? 'bg-green-900/40 text-green-400 cursor-default'
                          : 'bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white'
                      }`}
                    >
                      {joiningOrgId === org.id
                        ? <div className="w-3 h-3 border border-gray-400 border-t-transparent rounded-full animate-spin" />
                        : <LogIn size={12} />}
                      {profile?.orgId === org.id ? 'Activa' : 'Unirme'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Modal crear organización */}
        <DarkModal open={showCreateForm} onClose={() => setShowCreateForm(false)} title="Nueva organización + Owner" size="md">
          <form onSubmit={handleCreate} className="space-y-5">
            <div className="pb-3" style={{ borderBottom: '1px solid #1f2937' }}>
              <p className="text-sm font-medium text-gray-400 mb-3">Organización</p>
              <div className="space-y-3">
                <input required value={createForm.orgName} onChange={e => setCreateForm(f => ({ ...f, orgName: e.target.value }))}
                  className={inputClass} style={inputStyle} placeholder="Nombre de la organización *" />
                <input value={createForm.industry} onChange={e => setCreateForm(f => ({ ...f, industry: e.target.value }))}
                  className={inputClass} style={inputStyle} placeholder="Industria (ej: Agencia de vehículos)" />
                <select value={createForm.plan} onChange={e => setCreateForm(f => ({ ...f, plan: e.target.value as Organization['plan'] }))}
                  className={inputClass} style={inputStyle}>
                  <option value="trial">Trial</option>
                  <option value="basic">Basic</option>
                  <option value="pro">Pro</option>
                </select>
              </div>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-400 mb-3">Cuenta del propietario</p>
              <div className="space-y-3">
                <input required value={createForm.ownerName} onChange={e => setCreateForm(f => ({ ...f, ownerName: e.target.value }))}
                  className={inputClass} style={inputStyle} placeholder="Nombre completo del owner *" />
                <input required type="email" value={createForm.ownerEmail} onChange={e => setCreateForm(f => ({ ...f, ownerEmail: e.target.value }))}
                  className={inputClass} style={inputStyle} placeholder="Email del owner *" />
                <input required type="password" minLength={6} value={createForm.ownerPassword} onChange={e => setCreateForm(f => ({ ...f, ownerPassword: e.target.value }))}
                  className={inputClass} style={inputStyle} placeholder="Contraseña temporal (mín. 6 caracteres) *" />
              </div>
            </div>
            <button type="submit" disabled={creating}
              className="w-full bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-white font-semibold py-2.5 rounded-lg transition-colors">
              {creating ? 'Creando...' : 'Crear organización'}
            </button>
          </form>
        </DarkModal>

        {/* Modal editar organización */}
        <DarkModal open={!!editOrg} onClose={() => setEditOrg(null)} title={`Editar: ${editOrg?.name}`} size="sm">
          <form onSubmit={handleEdit} className="space-y-4">
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">Nombre</label>
              <input required value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                className={inputClass} style={inputStyle} />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">Industria</label>
              <input value={editForm.industry} onChange={e => setEditForm(f => ({ ...f, industry: e.target.value }))}
                className={inputClass} style={inputStyle} placeholder="Industria" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">Plan</label>
              <select value={editForm.plan} onChange={e => setEditForm(f => ({ ...f, plan: e.target.value as Organization['plan'] }))}
                className={inputClass} style={inputStyle}>
                <option value="trial">Trial</option>
                <option value="basic">Basic</option>
                <option value="pro">Pro</option>
              </select>
            </div>
            <button type="submit" disabled={saving}
              className="w-full bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-white font-semibold py-2.5 rounded-lg transition-colors">
              {saving ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </form>
        </DarkModal>

        {/* Modal confirmar eliminación */}
        <DarkModal open={!!deleteOrg} onClose={() => setDeleteOrg(null)} title="Eliminar organización" size="sm">
          <div className="space-y-4">
            <div className="p-3 rounded-lg" style={{ backgroundColor: 'rgba(127,29,29,0.3)', border: '1px solid #7f1d1d' }}>
              <p className="text-sm text-red-300">
                Esta acción <strong>no se puede deshacer</strong>. Se eliminará <strong className="text-red-200">{deleteOrg?.name}</strong> permanentemente.
              </p>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-400 mb-1 block">
                Escribe <strong className="text-gray-200">{deleteOrg?.name}</strong> para confirmar
              </label>
              <input
                value={deleteConfirm}
                onChange={e => setDeleteConfirm(e.target.value)}
                className={inputClass}
                style={{ ...inputStyle, borderColor: deleteConfirm === deleteOrg?.name ? '#dc2626' : '#374151' }}
                placeholder={deleteOrg?.name}
              />
            </div>
            <button
              onClick={handleDelete}
              disabled={deleting || deleteConfirm !== deleteOrg?.name}
              className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold py-2.5 rounded-lg transition-colors"
            >
              {deleting ? 'Eliminando...' : 'Eliminar permanentemente'}
            </button>
          </div>
        </DarkModal>
      </div>
    </AuthGuard>
  )
}
