'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import type { Organization, OrgStats } from '@/types'
import AuthGuard from '@/components/auth/AuthGuard'
import {
  Plus, Building2, Calendar, LogIn, Pencil, Trash2,
  Users, UserCheck, FolderKanban, X, ShieldCheck,
  AlertTriangle, CheckCircle2, Timer, ArrowLeft, KeyRound,
} from 'lucide-react'
import toast from 'react-hot-toast'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

// ─── Helpers ────────────────────────────────────────────────────────────────

function getExpiry(org: Organization): Date | null {
  if (!org.accessExpiresAt) return null
  const v = org.accessExpiresAt as unknown as { seconds?: number; _seconds?: number }
  const secs = v?._seconds ?? v?.seconds
  if (secs) return new Date(secs * 1000)
  if (org.accessExpiresAt instanceof Date) return org.accessExpiresAt
  if (typeof org.accessExpiresAt === 'string') return new Date(org.accessExpiresAt)
  return null
}

function getExpiryStatus(org: Organization): 'indefinite' | 'active' | 'soon' | 'expired' {
  const exp = getExpiry(org)
  if (!exp) return 'indefinite'
  const now = new Date()
  const diff = exp.getTime() - now.getTime()
  if (diff < 0) return 'expired'
  if (diff < 7 * 24 * 60 * 60 * 1000) return 'soon'
  return 'active'
}

function daysRemaining(org: Organization): number | null {
  const exp = getExpiry(org)
  if (!exp) return null
  return Math.floor((exp.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
}

function addDays(days: number): Date {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d
}

const DURATION_OPTIONS = [
  { label: '7 días', days: 7 },
  { label: '15 días', days: 15 },
  { label: '30 días', days: 30 },
  { label: '3 meses', days: 90 },
  { label: '6 meses', days: 180 },
  { label: '1 año', days: 365 },
  { label: 'Sin vencimiento', days: 0 },
]

const STATUS_CONFIG = {
  indefinite: { label: 'Indefinido', color: 'text-gray-400', bg: 'bg-gray-800', bar: 'bg-gray-600', icon: CheckCircle2 },
  active:     { label: 'Activo',     color: 'text-emerald-400', bg: 'bg-emerald-900/30', bar: 'bg-emerald-500', icon: CheckCircle2 },
  soon:       { label: 'Por vencer', color: 'text-amber-400',   bg: 'bg-amber-900/30',   bar: 'bg-amber-500',   icon: AlertTriangle },
  expired:    { label: 'Vencido',    color: 'text-red-400',     bg: 'bg-red-900/30',      bar: 'bg-red-500',     icon: Timer },
}

const PLAN_LABELS: Record<string, string> = { trial: 'Trial', basic: 'Basic', pro: 'Pro' }
const PLAN_COLORS: Record<string, string> = {
  trial: 'bg-gray-700 text-gray-300',
  basic: 'bg-blue-900/50 text-blue-300',
  pro:   'bg-purple-900/50 text-purple-300',
}

interface OrgWithStats extends Organization { stats?: OrgStats }

// ─── Dark Modal ─────────────────────────────────────────────────────────────

function DarkModal({ open, onClose, title, children, size = 'md' }: {
  open: boolean; onClose: () => void; title: string
  children: React.ReactNode; size?: 'sm' | 'md' | 'lg'
}) {
  useEffect(() => {
    if (!open) return
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [open, onClose])

  if (!open) return null
  const sizeClass = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl' }[size]

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-16 bg-black/70 overflow-y-auto">
      <div className={`w-full ${sizeClass} rounded-2xl shadow-2xl border border-gray-700/80 bg-gray-900`}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <h2 className="text-base font-semibold text-white">{title}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-gray-800 transition-colors">
            <X size={18} />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  )
}

// ─── Duration Picker ─────────────────────────────────────────────────────────

function DurationPicker({ value, onChange }: { value: number; onChange: (days: number) => void }) {
  return (
    <div>
      <label className="text-xs font-medium text-gray-400 mb-2 block">Duración del acceso</label>
      <div className="grid grid-cols-3 gap-2">
        {DURATION_OPTIONS.map(opt => (
          <button
            key={opt.days}
            type="button"
            onClick={() => onChange(opt.days)}
            className={`py-2 px-3 rounded-lg text-xs font-medium transition-colors border ${
              value === opt.days
                ? 'bg-indigo-600 border-indigo-500 text-white'
                : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-500 hover:text-white'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
      {value > 0 && (
        <p className="text-xs text-gray-500 mt-2">
          Vence el {addDays(value).toLocaleDateString('es', { day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      )}
    </div>
  )
}

// ─── Org Card ────────────────────────────────────────────────────────────────

function OrgCard({ org, onEdit, onDelete, onEnter, isActive }: {
  org: OrgWithStats
  onEdit: () => void
  onDelete: () => void
  onEnter: () => void
  isActive: boolean
}) {
  const status = getExpiryStatus(org)
  const days = daysRemaining(org)
  const cfg = STATUS_CONFIG[status]
  const StatusIcon = cfg.icon
  const expiry = getExpiry(org)

  const ts = org.createdAt as unknown as { seconds?: number; _seconds?: number }
  const secs = ts?._seconds ?? ts?.seconds
  const createdDate = secs ? new Date(secs * 1000).toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'

  return (
    <div className={`relative rounded-2xl border overflow-hidden transition-all ${
      status === 'expired'
        ? 'border-red-900/60 bg-gray-900/80 opacity-75'
        : 'border-gray-800 bg-gray-900 hover:border-gray-700'
    }`}>
      {/* Status bar top */}
      <div className={`h-1 w-full ${cfg.bar}`} />

      <div className="p-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-gray-800 border border-gray-700 flex items-center justify-center flex-shrink-0">
              <Building2 size={18} className="text-gray-400" />
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold text-white truncate text-sm">{org.name}</h3>
              {org.settings?.industry && (
                <p className="text-xs text-gray-500 truncate mt-0.5">{org.settings.industry}</p>
              )}
            </div>
          </div>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize flex-shrink-0 ${PLAN_COLORS[org.plan]}`}>
            {PLAN_LABELS[org.plan]}
          </span>
        </div>

        {/* Access expiry */}
        <div className={`flex items-center justify-between rounded-xl px-3 py-2.5 mb-4 ${cfg.bg}`}>
          <div className="flex items-center gap-2">
            <StatusIcon size={14} className={cfg.color} />
            <span className={`text-xs font-medium ${cfg.color}`}>{cfg.label}</span>
          </div>
          <div className="text-right">
            {status === 'indefinite' ? (
              <span className="text-xs text-gray-500">Sin vencimiento</span>
            ) : days !== null && days < 0 ? (
              <span className="text-xs text-red-400 font-medium">Venció hace {Math.abs(days)}d</span>
            ) : days !== null ? (
              <span className={`text-xs font-medium ${cfg.color}`}>{days}d restantes</span>
            ) : null}
            {expiry && status !== 'indefinite' && (
              <p className="text-xs text-gray-600 mt-0.5">
                {expiry.toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' })}
              </p>
            )}
          </div>
        </div>

        {/* Stats */}
        {org.stats ? (
          <div className="grid grid-cols-3 gap-2 mb-4">
            {[
              { icon: Users, val: org.stats.users, label: 'usuarios' },
              { icon: UserCheck, val: org.stats.clients, label: 'clientes' },
              { icon: FolderKanban, val: org.stats.deals, label: 'deals' },
            ].map(({ icon: Icon, val, label }) => (
              <div key={label} className="bg-gray-800/60 rounded-xl p-2 text-center">
                <Icon size={12} className="text-gray-500 mx-auto mb-1" />
                <p className="text-sm font-bold text-white">{val}</p>
                <p className="text-xs text-gray-600">{label}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="h-16 flex items-center justify-center mb-4">
            <div className="w-4 h-4 border-2 border-gray-600 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-gray-800">
          <div className="flex items-center gap-1.5 text-xs text-gray-600">
            <Calendar size={11} />
            {createdDate}
          </div>
          <div className="flex items-center gap-1">
            <button onClick={onEdit} title="Editar"
              className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-gray-800 transition-colors">
              <Pencil size={14} />
            </button>
            <button onClick={onDelete} title="Eliminar"
              className="p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-900/20 transition-colors">
              <Trash2 size={14} />
            </button>
            <button
              onClick={onEnter}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ml-1 ${
                isActive
                  ? 'bg-emerald-900/40 text-emerald-400'
                  : 'bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white'
              }`}
            >
              {isActive ? <CheckCircle2 size={12} /> : <LogIn size={12} />}
              {isActive ? 'Activa' : 'Entrar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function AdminPage() {
  const { isSuperAdmin, user, profile, switchOrg } = useAuth()
  const router = useRouter()

  const [orgs, setOrgs] = useState<OrgWithStats[]>([])
  const [loading, setLoading] = useState(true)

  // Create
  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating] = useState(false)
  const [createForm, setCreateForm] = useState({
    orgName: '', industry: '', plan: 'trial' as Organization['plan'],
    ownerName: '', ownerEmail: '', ownerPassword: '',
    durationDays: 30,
    waPhoneNumberId: '', waToken: '', igToken: '',
  })

  // Edit
  const [editOrg, setEditOrg] = useState<Organization | null>(null)
  const [editForm, setEditForm] = useState({
    name: '', industry: '', plan: 'trial' as Organization['plan'], durationDays: 0,
    waPhoneNumberId: '', waToken: '', igToken: '',
  })
  const [loadingTokens, setLoadingTokens] = useState(false)
  const [saving, setSaving] = useState(false)

  // Delete
  const [deleteOrg, setDeleteOrg] = useState<Organization | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState('')

  const load = async () => {
    try {
      const res = await fetch('/api/admin/organizations')
      if (!res.ok) throw new Error()
      setOrgs(await res.json())
    } catch {
      toast.error('Error al cargar organizaciones')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const handleEnter = (org: Organization) => {
    switchOrg(org.id)
    router.push('/dashboard')
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreating(true)
    try {
      const accessExpiresAt = createForm.durationDays > 0 ? addDays(createForm.durationDays) : null

      const orgRes = await fetch('/api/admin/organizations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: createForm.orgName,
          ownerId: '',
          plan: createForm.plan,
          accessExpiresAt,
          settings: { catalogEnabled: false, industry: createForm.industry },
        }),
      })
      const orgData = await orgRes.json()
      if (!orgRes.ok) throw new Error(orgData.error || 'Error al crear organización')

      const userRes = await fetch('/api/users/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: createForm.ownerEmail,
          password: createForm.ownerPassword,
          displayName: createForm.ownerName,
          role: 'owner',
          orgId: orgData.id,
        }),
      })
      const userData = await userRes.json()
      if (!userRes.ok) throw new Error(userData.error || 'Error al crear usuario')

      await fetch(`/api/admin/organizations/${orgData.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ownerId: userData.uid }),
      })

      // Guardar tokens encriptados si se proporcionaron
      if (createForm.waToken || createForm.igToken) {
        await fetch(`/api/admin/tokens/${orgData.id}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-user-uid': user?.uid || '' },
          body: JSON.stringify({
            wa_phone_number_id: createForm.waPhoneNumberId,
            wa_token: createForm.waToken,
            ig_token: createForm.igToken,
            updatedBy: user?.uid,
          }),
        })
      }

      toast.success(`"${createForm.orgName}" creada`)
      setShowCreate(false)
      setCreateForm({ orgName: '', industry: '', plan: 'trial', ownerName: '', ownerEmail: '', ownerPassword: '', durationDays: 30, waPhoneNumberId: '', waToken: '', igToken: '' })
      load()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : ''
      if (msg.includes('email-already-in-use') || msg.includes('ya está en uso')) toast.error('Email ya registrado')
      else toast.error(msg || 'Error desconocido')
    } finally {
      setCreating(false)
    }
  }

  const openEdit = async (org: Organization) => {
    const exp = getExpiry(org)
    let durationDays = 0
    if (exp) {
      const days = Math.ceil((exp.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
      durationDays = Math.max(1, days)
    }
    setEditOrg(org)
    setEditForm({ name: org.name, industry: org.settings?.industry || '', plan: org.plan, durationDays, waPhoneNumberId: '', waToken: '', igToken: '' })

    // Cargar tokens existentes
    setLoadingTokens(true)
    try {
      const res = await fetch(`/api/admin/tokens/${org.id}`, {
        headers: { 'x-user-uid': user?.uid || '' },
      })
      if (res.ok) {
        const tokens = await res.json()
        setEditForm(f => ({ ...f, waPhoneNumberId: tokens.wa_phone_number_id || '', waToken: tokens.wa_token || '', igToken: tokens.ig_token || '' }))
      }
    } finally {
      setLoadingTokens(false)
    }
  }

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editOrg) return
    setSaving(true)
    try {
      const accessExpiresAt = editForm.durationDays > 0 ? addDays(editForm.durationDays) : null
      const res = await fetch(`/api/admin/organizations/${editOrg.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editForm.name,
          plan: editForm.plan,
          'settings.industry': editForm.industry,
          accessExpiresAt,
        }),
      })
      if (!res.ok) throw new Error()

      // Guardar tokens siempre (aunque estén vacíos, para borrarlos si se limpiaron)
      await fetch(`/api/admin/tokens/${editOrg.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-uid': user?.uid || '' },
        body: JSON.stringify({
          wa_phone_number_id: editForm.waPhoneNumberId,
          wa_token: editForm.waToken,
          ig_token: editForm.igToken,
          updatedBy: user?.uid,
        }),
      })

      toast.success('Organización actualizada')
      setEditOrg(null)
      load()
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

  const expired = orgs.filter(o => getExpiryStatus(o) === 'expired').length
  const soon = orgs.filter(o => getExpiryStatus(o) === 'soon').length
  const active = orgs.filter(o => ['active', 'indefinite'].includes(getExpiryStatus(o))).length

  const inputCls = "w-full rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-gray-800 border border-gray-700 placeholder-gray-500"
  const labelCls = "text-xs font-medium text-gray-400 mb-1.5 block"

  return (
    <AuthGuard allowedRoles={['super_admin']}>
      <div className="space-y-6">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="p-2 rounded-xl bg-gray-800 border border-gray-700 text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
              title="Volver al dashboard"
            >
              <ArrowLeft size={18} />
            </Link>
            <div className="p-2 rounded-xl bg-indigo-900/40 border border-indigo-800/60">
              <ShieldCheck size={20} className="text-indigo-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Super Admin</h1>
              <p className="text-gray-500 text-xs mt-0.5">{orgs.length} organizaciones</p>
            </div>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors self-start sm:self-auto"
          >
            <Plus size={16} /> Nueva organización
          </button>
        </div>

        {/* Summary stats */}
        {!loading && orgs.length > 0 && (
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-emerald-400">{active}</p>
              <p className="text-xs text-gray-500 mt-0.5">Activas</p>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-amber-400">{soon}</p>
              <p className="text-xs text-gray-500 mt-0.5">Por vencer</p>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-red-400">{expired}</p>
              <p className="text-xs text-gray-500 mt-0.5">Vencidas</p>
            </div>
          </div>
        )}

        {/* Org list */}
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-4 border-gray-600 border-t-indigo-500 rounded-full animate-spin" />
          </div>
        ) : orgs.length === 0 ? (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-16 text-center">
            <Building2 size={32} className="text-gray-700 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">No hay organizaciones. Crea la primera.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {orgs.map(org => (
              <OrgCard
                key={org.id}
                org={org}
                onEdit={() => openEdit(org)}
                onDelete={() => { setDeleteOrg(org); setDeleteConfirm('') }}
                onEnter={() => handleEnter(org)}
                isActive={profile?.orgId === org.id}
              />
            ))}
          </div>
        )}

        {/* Modal: Crear */}
        <DarkModal open={showCreate} onClose={() => setShowCreate(false)} title="Nueva organización" size="md">
          <form onSubmit={handleCreate} className="space-y-5">
            <div className="space-y-3 pb-4 border-b border-gray-800">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Organización</p>
              <input required value={createForm.orgName} onChange={e => setCreateForm(f => ({ ...f, orgName: e.target.value }))}
                className={inputCls} placeholder="Nombre de la organización *" />
              <input value={createForm.industry} onChange={e => setCreateForm(f => ({ ...f, industry: e.target.value }))}
                className={inputCls} placeholder="Industria (ej: Agencia de vehículos)" />
              <select value={createForm.plan} onChange={e => setCreateForm(f => ({ ...f, plan: e.target.value as Organization['plan'] }))}
                className={inputCls}>
                <option value="trial">Trial</option>
                <option value="basic">Basic</option>
                <option value="pro">Pro</option>
              </select>
              <DurationPicker value={createForm.durationDays} onChange={days => setCreateForm(f => ({ ...f, durationDays: days }))} />
            </div>
            <div className="space-y-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Cuenta del propietario</p>
              <input required value={createForm.ownerName} onChange={e => setCreateForm(f => ({ ...f, ownerName: e.target.value }))}
                className={inputCls} placeholder="Nombre completo *" />
              <input required type="email" value={createForm.ownerEmail} onChange={e => setCreateForm(f => ({ ...f, ownerEmail: e.target.value }))}
                className={inputCls} placeholder="Email *" />
              <input required type="password" minLength={6} value={createForm.ownerPassword} onChange={e => setCreateForm(f => ({ ...f, ownerPassword: e.target.value }))}
                className={inputCls} placeholder="Contraseña temporal (mín. 6 caracteres) *" />
            </div>
            <div className="space-y-3 pt-4 border-t border-gray-800">
              <div className="flex items-center gap-2">
                <KeyRound size={14} className="text-indigo-400" />
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Tokens (opcional)</p>
              </div>
              <p className="text-xs text-gray-600">Se guardan encriptados con AES-256-GCM. Pueden configurarse ahora o editarse después.</p>
              <div className="space-y-2">
                <p className="text-[11px] text-gray-500 font-medium">WhatsApp (Meta Cloud API)</p>
                <input value={createForm.waPhoneNumberId} onChange={e => setCreateForm(f => ({ ...f, waPhoneNumberId: e.target.value }))}
                  className={inputCls} placeholder="Phone Number ID" />
                <input type="password" value={createForm.waToken} onChange={e => setCreateForm(f => ({ ...f, waToken: e.target.value }))}
                  className={inputCls} placeholder="Token de acceso" />
              </div>
              <div className="space-y-2">
                <p className="text-[11px] text-gray-500 font-medium">Instagram</p>
                <input type="password" value={createForm.igToken} onChange={e => setCreateForm(f => ({ ...f, igToken: e.target.value }))}
                  className={inputCls} placeholder="Token de acceso IG" />
              </div>
            </div>
            <button type="submit" disabled={creating}
              className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl transition-colors">
              {creating ? 'Creando...' : 'Crear organización'}
            </button>
          </form>
        </DarkModal>

        {/* Modal: Editar */}
        <DarkModal open={!!editOrg} onClose={() => setEditOrg(null)} title={`Editar: ${editOrg?.name}`} size="md">
          <form onSubmit={handleEdit} className="space-y-4">
            <div>
              <label className={labelCls}>Nombre</label>
              <input required value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Industria</label>
              <input value={editForm.industry} onChange={e => setEditForm(f => ({ ...f, industry: e.target.value }))}
                className={inputCls} placeholder="Industria" />
            </div>
            <div>
              <label className={labelCls}>Plan</label>
              <select value={editForm.plan} onChange={e => setEditForm(f => ({ ...f, plan: e.target.value as Organization['plan'] }))}
                className={inputCls}>
                <option value="trial">Trial</option>
                <option value="basic">Basic</option>
                <option value="pro">Pro</option>
              </select>
            </div>
            <DurationPicker value={editForm.durationDays} onChange={days => setEditForm(f => ({ ...f, durationDays: days }))} />

            {/* Tokens */}
            <div className="space-y-3 pt-3 border-t border-gray-800">
              <div className="flex items-center gap-2">
                <KeyRound size={14} className="text-indigo-400" />
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Tokens de integración</p>
                {loadingTokens && <div className="w-3 h-3 border-2 border-gray-600 border-t-indigo-400 rounded-full animate-spin ml-auto" />}
              </div>
              <div className="space-y-2">
                <p className="text-[11px] text-gray-500 font-medium">WhatsApp (Meta Cloud API)</p>
                <input value={editForm.waPhoneNumberId} onChange={e => setEditForm(f => ({ ...f, waPhoneNumberId: e.target.value }))}
                  className={inputCls} placeholder="Phone Number ID" />
                <input type="password" value={editForm.waToken} onChange={e => setEditForm(f => ({ ...f, waToken: e.target.value }))}
                  className={inputCls} placeholder="Token de acceso" />
              </div>
              <div className="space-y-2">
                <p className="text-[11px] text-gray-500 font-medium">Instagram</p>
                <input type="password" value={editForm.igToken} onChange={e => setEditForm(f => ({ ...f, igToken: e.target.value }))}
                  className={inputCls} placeholder="Token de acceso IG" />
              </div>
            </div>

            <button type="submit" disabled={saving}
              className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl transition-colors">
              {saving ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </form>
        </DarkModal>

        {/* Modal: Eliminar */}
        <DarkModal open={!!deleteOrg} onClose={() => setDeleteOrg(null)} title="Eliminar organización" size="sm">
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-4 rounded-xl bg-red-900/20 border border-red-900/40">
              <AlertTriangle size={16} className="text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-300">
                Esta acción <strong>no se puede deshacer</strong>. Se eliminará{' '}
                <strong className="text-white">{deleteOrg?.name}</strong> permanentemente.
              </p>
            </div>
            <div>
              <label className={labelCls}>
                Escribe <strong className="text-gray-200">{deleteOrg?.name}</strong> para confirmar
              </label>
              <input
                value={deleteConfirm}
                onChange={e => setDeleteConfirm(e.target.value)}
                className={`${inputCls} ${deleteConfirm === deleteOrg?.name ? 'border-red-600 focus:ring-red-500' : ''}`}
                placeholder={deleteOrg?.name}
              />
            </div>
            <button
              onClick={handleDelete}
              disabled={deleting || deleteConfirm !== deleteOrg?.name}
              className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold py-2.5 rounded-xl transition-colors"
            >
              {deleting ? 'Eliminando...' : 'Eliminar permanentemente'}
            </button>
          </div>
        </DarkModal>
      </div>
    </AuthGuard>
  )
}
