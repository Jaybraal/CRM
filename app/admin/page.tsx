'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import {
  getAllOrganizations, createOrganization, createUserProfile, getUserProfile,
  updateOrganization, deleteOrganization, getOrgStats,
} from '@/lib/firestore'
import type { Organization, OrgStats } from '@/types'
import AuthGuard from '@/components/auth/AuthGuard'
import Modal from '@/components/ui/Modal'
import { Plus, Building2, Calendar, LogIn, Pencil, Trash2, Users, UserCheck, FolderKanban } from 'lucide-react'
import toast from 'react-hot-toast'

const PLAN_COLORS: Record<string, string> = {
  trial: 'bg-gray-800 text-gray-300',
  basic: 'bg-gray-700 text-gray-400',
  pro: 'bg-purple-900 text-purple-300',
}

interface OrgWithStats extends Organization {
  stats?: OrgStats
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
      const data = await getAllOrganizations()
      setOrgs(data)
      data.forEach(async (org) => {
        try {
          const stats = await getOrgStats(org.id)
          setOrgs(prev => prev.map(o => o.id === org.id ? { ...o, stats } : o))
        } catch { /* ignore */ }
      })
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
      await createUserProfile(user.uid, {
        email: user.email || '',
        displayName: user.displayName || user.email?.split('@')[0] || 'Admin',
        role: 'super_admin',
        orgId: org.id,
      })
      const updated = await getUserProfile(user.uid)
      if (updated?.orgId === org.id) {
        toast.success(`Unido a "${org.name}" — recarga la página`)
        setTimeout(() => window.location.reload(), 1500)
      } else {
        toast.error('No se pudo guardar. Revisa las reglas de Firestore.')
      }
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
      // 1. Crear org primero con ownerId temporal — se actualizará tras crear el usuario
      const tempOrgId = await createOrganization({
        name: createForm.orgName,
        ownerId: '',
        plan: createForm.plan,
        settings: { catalogEnabled: false, industry: createForm.industry },
      })

      // 2. Crear el usuario vía Admin SDK (no afecta la sesión actual)
      const res = await fetch('/api/users/create', {
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
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error al crear usuario')

      // 3. Actualizar ownerId en la org con el uid real
      await updateOrganization(tempOrgId, { ownerId: data.uid })

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
    setEditForm({ name: org.name, industry: org.settings.industry || '', plan: org.plan })
  }

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editOrg) return
    setSaving(true)
    try {
      await updateOrganization(editOrg.id, {
        name: editForm.name,
        plan: editForm.plan,
        settings: { ...editOrg.settings, industry: editForm.industry },
      })
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
      await deleteOrganization(deleteOrg.id)
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
                      {org.settings.industry && (
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
                    {org.createdAt ? new Date((org.createdAt as unknown as { seconds: number }).seconds * 1000).toLocaleDateString('es') : '-'}
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
        <Modal open={showCreateForm} onClose={() => setShowCreateForm(false)} title="Nueva organización + Owner" size="md">
          <form onSubmit={handleCreate} className="space-y-5">
            <div className="pb-3 border-b border-gray-800">
              <p className="text-sm font-medium text-gray-400 mb-3">Organización</p>
              <div className="space-y-3">
                <input required value={createForm.orgName} onChange={e => setCreateForm(f => ({ ...f, orgName: e.target.value }))}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-gray-500"
                  placeholder="Nombre de la organización *" />
                <input value={createForm.industry} onChange={e => setCreateForm(f => ({ ...f, industry: e.target.value }))}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-gray-500"
                  placeholder="Industria (ej: Agencia de vehículos)" />
                <select value={createForm.plan} onChange={e => setCreateForm(f => ({ ...f, plan: e.target.value as Organization['plan'] }))}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-gray-500">
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
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-gray-500"
                  placeholder="Nombre completo del owner *" />
                <input required type="email" value={createForm.ownerEmail} onChange={e => setCreateForm(f => ({ ...f, ownerEmail: e.target.value }))}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-gray-500"
                  placeholder="Email del owner *" />
                <input required type="password" minLength={6} value={createForm.ownerPassword} onChange={e => setCreateForm(f => ({ ...f, ownerPassword: e.target.value }))}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-gray-500"
                  placeholder="Contraseña temporal (mín. 6 caracteres) *" />
              </div>
            </div>
            <button type="submit" disabled={creating}
              className="w-full bg-gray-900 hover:bg-gray-800 disabled:opacity-50 text-white font-semibold py-2.5 rounded-lg transition-colors">
              {creating ? 'Creando...' : 'Crear organización'}
            </button>
          </form>
        </Modal>

        {/* Modal editar organización */}
        <Modal open={!!editOrg} onClose={() => setEditOrg(null)} title={`Editar: ${editOrg?.name}`} size="sm">
          <form onSubmit={handleEdit} className="space-y-4">
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">Nombre</label>
              <input required value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-gray-500" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">Industria</label>
              <input value={editForm.industry} onChange={e => setEditForm(f => ({ ...f, industry: e.target.value }))}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-gray-500"
                placeholder="Industria" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">Plan</label>
              <select value={editForm.plan} onChange={e => setEditForm(f => ({ ...f, plan: e.target.value as Organization['plan'] }))}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-gray-500">
                <option value="trial">Trial</option>
                <option value="basic">Basic</option>
                <option value="pro">Pro</option>
              </select>
            </div>
            <button type="submit" disabled={saving}
              className="w-full bg-gray-900 hover:bg-gray-800 disabled:opacity-50 text-white font-semibold py-2.5 rounded-lg transition-colors">
              {saving ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </form>
        </Modal>

        {/* Modal confirmar eliminación */}
        <Modal open={!!deleteOrg} onClose={() => setDeleteOrg(null)} title="Eliminar organización" size="sm">
          <div className="space-y-4">
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-700">
                Esta acción <strong>no se puede deshacer</strong>. Se eliminará <strong>{deleteOrg?.name}</strong> permanentemente.
              </p>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">
                Escribe <strong className="text-gray-700">{deleteOrg?.name}</strong> para confirmar
              </label>
              <input
                value={deleteConfirm}
                onChange={e => setDeleteConfirm(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-red-400"
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
        </Modal>
      </div>
    </AuthGuard>
  )
}
