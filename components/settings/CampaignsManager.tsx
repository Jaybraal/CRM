'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { getOutreachCampaigns, createOutreachCampaign, updateOutreachCampaign, deleteOutreachCampaign } from '@/lib/firestore'
import { CAMPAIGNS } from '@/lib/outreach/campaigns'
import type { Campaign } from '@/types'
import toast from 'react-hot-toast'
import { Plus, Pencil, Trash2, Loader2, Save, X, Lock, Megaphone } from 'lucide-react'

const inputClass = 'w-full bg-gray-50 border border-gray-200 rounded-md px-3.5 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400 text-sm transition-all'
const labelClass = 'block text-sm font-medium text-gray-700 mb-1.5'

const STEPS: { key: 0 | 5 | 10 | 20; label: string }[] = [
  { key: 0, label: 'Día 0 — primer correo' },
  { key: 5, label: 'Día 5 — seguimiento' },
  { key: 10, label: 'Día 10 — otro ángulo' },
  { key: 20, label: 'Día 20 — cierre (último)' },
]

interface FormState {
  businessLabel: string
  industryLabel: string
  steps: Record<0 | 5 | 10 | 20, { subject: string; body: string }>
}

const emptyForm = (): FormState => ({
  businessLabel: '',
  industryLabel: '',
  steps: {
    0: { subject: '', body: '' },
    5: { subject: '', body: '' },
    10: { subject: '', body: '' },
    20: { subject: '', body: '' },
  },
})

export default function CampaignsManager() {
  const { profile } = useAuth()
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<FormState>(emptyForm())
  const [saving, setSaving] = useState(false)

  const load = () => {
    if (!profile?.orgId) return
    setLoading(true)
    getOutreachCampaigns(profile.orgId).then(setCampaigns).finally(() => setLoading(false))
  }

  useEffect(load, [profile?.orgId])

  const startCreate = () => { setForm(emptyForm()); setEditingId(null); setShowForm(true) }

  const startEdit = (c: Campaign) => {
    const steps = emptyForm().steps
    for (const s of STEPS) {
      const tpl = c.templates?.[s.key]
      if (tpl) steps[s.key] = { subject: tpl.subject, body: tpl.body }
    }
    setForm({ businessLabel: c.businessLabel, industryLabel: c.industryLabel, steps })
    setEditingId(c.id)
    setShowForm(true)
  }

  const setStep = (key: 0 | 5 | 10 | 20, field: 'subject' | 'body', value: string) => {
    setForm(f => ({ ...f, steps: { ...f.steps, [key]: { ...f.steps[key], [field]: value } } }))
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profile?.orgId) return
    if (!form.businessLabel.trim()) { toast.error('Falta el nombre del negocio'); return }
    for (const s of STEPS) {
      if (!form.steps[s.key].subject.trim() || !form.steps[s.key].body.trim()) {
        toast.error(`Falta completar el ${s.label.toLowerCase()}`)
        return
      }
    }
    setSaving(true)
    try {
      const templates = Object.fromEntries(STEPS.map(s => [s.key, form.steps[s.key]]))
      if (editingId) {
        await updateOutreachCampaign(profile.orgId, editingId, {
          businessLabel: form.businessLabel.trim(),
          industryLabel: form.industryLabel.trim() || 'negocio',
          templates,
        })
        toast.success('Negocio actualizado')
      } else {
        await createOutreachCampaign(profile.orgId, {
          businessLabel: form.businessLabel.trim(),
          industryLabel: form.industryLabel.trim() || 'negocio',
          templates,
        })
        toast.success('Negocio creado — ya disponible en Clientes y en Nuevo cliente')
      }
      setShowForm(false)
      load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (c: Campaign) => {
    if (!profile?.orgId) return
    if (!window.confirm(`¿Eliminar el negocio "${c.businessLabel}"? Los leads ya cargados con este negocio no se borran, pero no podrás activar nuevas secuencias para él.`)) return
    try {
      await deleteOutreachCampaign(profile.orgId, c.id)
      toast.success('Negocio eliminado')
      load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al eliminar')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-gray-800">Negocios / campañas de outreach</p>
          <p className="text-xs text-gray-500 mt-0.5">Cada negocio tiene su propio mensaje. Todos se envían desde el mismo Gmail conectado arriba.</p>
        </div>
        {!showForm && (
          <button onClick={startCreate} className="flex items-center gap-1.5 text-sm font-medium bg-[#0D7A65] hover:bg-[#0a5f4f] text-white px-3.5 py-2 rounded-md transition-colors">
            <Plus size={14} /> Nuevo negocio
          </button>
        )}
      </div>

      {/* Negocios base del sistema — no editables desde aquí */}
      <div className="space-y-2">
        <p className="text-xs font-bold uppercase text-gray-400">Negocios base</p>
        {Object.values(CAMPAIGNS).map(c => (
          <div key={c.id} className="flex items-center justify-between px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-md">
            <div>
              <p className="text-sm font-medium text-gray-800">{c.businessLabel}</p>
              <p className="text-xs text-gray-500">{c.industryLabel}</p>
            </div>
            <span className="flex items-center gap-1 text-[10px] font-bold uppercase text-gray-400"><Lock size={11} /> Del sistema</span>
          </div>
        ))}
      </div>

      {/* Negocios creados desde el CRM */}
      <div className="space-y-2">
        <p className="text-xs font-bold uppercase text-gray-400">Tus negocios</p>
        {loading ? (
          <div className="flex items-center gap-2 text-gray-400 text-sm py-4"><Loader2 size={14} className="animate-spin" /> Cargando...</div>
        ) : campaigns.length === 0 ? (
          <p className="text-sm text-gray-400 py-2">Aún no has creado ningún negocio.</p>
        ) : (
          campaigns.map(c => (
            <div key={c.id} className="flex items-center justify-between px-3.5 py-2.5 bg-white border border-gray-200 rounded-md">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 bg-violet-50 rounded-md"><Megaphone size={14} className="text-violet-600" /></div>
                <div>
                  <p className="text-sm font-medium text-gray-800">{c.businessLabel}</p>
                  <p className="text-xs text-gray-500">{c.industryLabel}</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => startEdit(c)} className="p-1.5 text-gray-400 hover:text-violet-600 hover:bg-violet-50 rounded-md transition-colors"><Pencil size={14} /></button>
                <button onClick={() => handleDelete(c)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"><Trash2 size={14} /></button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Formulario crear/editar */}
      {showForm && (
        <form onSubmit={handleSave} className="space-y-4 border border-violet-200 bg-violet-50/40 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-gray-800">{editingId ? 'Editar negocio' : 'Nuevo negocio'}</p>
            <button type="button" onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Nombre del negocio *</label>
              <input value={form.businessLabel} onChange={e => setForm(f => ({ ...f, businessLabel: e.target.value }))} className={inputClass} placeholder="ej. Aura Perfumería" />
            </div>
            <div>
              <label className={labelClass}>Rubro por defecto</label>
              <input value={form.industryLabel} onChange={e => setForm(f => ({ ...f, industryLabel: e.target.value }))} className={inputClass} placeholder="ej. tienda de ropa" />
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-100 rounded-md px-3.5 py-2.5">
            <p className="text-xs text-blue-800">
              Usa <code className="bg-blue-100 px-1 rounded">{'{{clinicName}}'}</code> donde quieras que aparezca el nombre del negocio destinatario,
              y <code className="bg-blue-100 px-1 rounded">{'{{observation}}'}</code> para una observación automática (puede quedar vacía).
            </p>
          </div>

          {STEPS.map(s => (
            <div key={s.key} className="space-y-2 border-t border-violet-200 pt-3">
              <p className="text-xs font-bold uppercase text-violet-700">{s.label}</p>
              <input
                value={form.steps[s.key].subject}
                onChange={e => setStep(s.key, 'subject', e.target.value)}
                className={inputClass}
                placeholder="Asunto del correo"
              />
              <textarea
                value={form.steps[s.key].body}
                onChange={e => setStep(s.key, 'body', e.target.value)}
                rows={5}
                className={`${inputClass} resize-none`}
                placeholder="Cuerpo del correo..."
              />
            </div>
          ))}

          <button type="submit" disabled={saving} className="w-full flex items-center justify-center gap-2 py-2.5 bg-[#0D7A65] hover:bg-[#0a5f4f] disabled:opacity-50 text-white rounded-md font-medium text-sm transition-colors">
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
            {saving ? 'Guardando...' : editingId ? 'Guardar cambios' : 'Crear negocio'}
          </button>
        </form>
      )}
    </div>
  )
}
