'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { getAllOrganizations, createOrganization, createUserProfile } from '@/lib/firestore'
import { createUserWithEmailAndPassword } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import type { Organization } from '@/types'
import AuthGuard from '@/components/auth/AuthGuard'
import Modal from '@/components/ui/Modal'
import { Plus, Building2, Users, Calendar } from 'lucide-react'
import toast from 'react-hot-toast'

const PLAN_COLORS: Record<string, string> = {
  trial: 'bg-gray-800 text-gray-300',
  basic: 'bg-gray-700 text-gray-400',
  pro: 'bg-purple-900 text-purple-300',
}

export default function AdminPage() {
  const { isSuperAdmin } = useAuth()
  const [orgs, setOrgs] = useState<Organization[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({
    orgName: '', industry: '', plan: 'trial' as Organization['plan'],
    ownerName: '', ownerEmail: '', ownerPassword: '',
  })

  const load = async () => {
    const data = await getAllOrganizations()
    setOrgs(data)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreating(true)
    try {
      // 1. Crear usuario owner en Firebase Auth
      const cred = await createUserWithEmailAndPassword(auth, form.ownerEmail, form.ownerPassword)

      // 2. Crear organización
      const orgId = await createOrganization({
        name: form.orgName,
        ownerId: cred.user.uid,
        plan: form.plan,
        settings: { catalogEnabled: false, industry: form.industry },
      })

      // 3. Crear perfil del owner
      await createUserProfile(cred.user.uid, {
        email: form.ownerEmail,
        displayName: form.ownerName,
        role: 'owner',
        orgId,
      })

      toast.success(`Organización "${form.orgName}" creada`)
      setShowForm(false)
      setForm({ orgName: '', industry: '', plan: 'trial', ownerName: '', ownerEmail: '', ownerPassword: '' })
      load()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : ''
      if (msg.includes('email-already-in-use')) toast.error('Email ya registrado')
      else toast.error('Error al crear organización')
    } finally {
      setCreating(false)
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
            onClick={() => setShowForm(true)}
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
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gray-800 rounded-lg flex items-center justify-center">
                      <Building2 size={18} className="text-gray-400" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-white">{org.name}</h3>
                      {org.settings.industry && (
                        <p className="text-xs text-gray-500">{org.settings.industry}</p>
                      )}
                    </div>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${PLAN_COLORS[org.plan]}`}>
                    {org.plan}
                  </span>
                </div>
                <div className="text-xs text-gray-600 flex items-center gap-1.5">
                  <Calendar size={11} />
                  {org.createdAt ? new Date((org.createdAt as unknown as { seconds: number }).seconds * 1000).toLocaleDateString('es') : '-'}
                </div>
              </div>
            ))}
          </div>
        )}

        <Modal open={showForm} onClose={() => setShowForm(false)} title="Nueva organización + Owner" size="md">
          <form onSubmit={handleCreate} className="space-y-5">
            <div className="pb-3 border-b border-gray-800">
              <p className="text-sm font-medium text-gray-400 mb-3">Organización</p>
              <div className="space-y-3">
                <input required value={form.orgName} onChange={e => setForm(f => ({ ...f, orgName: e.target.value }))}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-gray-500"
                  placeholder="Nombre de la organización *" />
                <input value={form.industry} onChange={e => setForm(f => ({ ...f, industry: e.target.value }))}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-gray-500"
                  placeholder="Industria (ej: Agencia de vehículos)" />
                <select value={form.plan} onChange={e => setForm(f => ({ ...f, plan: e.target.value as Organization['plan'] }))}
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
                <input required value={form.ownerName} onChange={e => setForm(f => ({ ...f, ownerName: e.target.value }))}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-gray-500"
                  placeholder="Nombre completo del owner *" />
                <input required type="email" value={form.ownerEmail} onChange={e => setForm(f => ({ ...f, ownerEmail: e.target.value }))}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-gray-500"
                  placeholder="Email del owner *" />
                <input required type="password" minLength={6} value={form.ownerPassword} onChange={e => setForm(f => ({ ...f, ownerPassword: e.target.value }))}
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
      </div>
    </AuthGuard>
  )
}
