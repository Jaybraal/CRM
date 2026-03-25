'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { getDeals, getClients, updateDeal, createDeal, deleteDeal, getOrganization } from '@/lib/firestore'
import type { Deal, Client, PipelineStage } from '@/types'
import Modal from '@/components/ui/Modal'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'

const DEFAULT_STAGES: PipelineStage[] = [
  { id: 'new', name: 'Nuevo', order: 0, color: '#6b7280' },
  { id: 'contacted', name: 'Contactado', order: 1, color: '#3b82f6' },
  { id: 'negotiation', name: 'Negociación', order: 2, color: '#f59e0b' },
  { id: 'closed_won', name: 'Ganado', order: 3, color: '#10b981' },
  { id: 'closed_lost', name: 'Perdido', order: 4, color: '#ef4444' },
]

const inputClass = 'w-full bg-white border border-gray-300 rounded-lg px-4 py-2.5 text-gray-900 focus:outline-none focus:border-gray-500'
const labelClass = 'block text-sm font-medium text-gray-700 mb-1.5'
const emptyForm = { clientId: '', stage: 'new', value: '', notes: '' }

export default function PipelinePage() {
  const { profile } = useAuth()
  const [deals, setDeals] = useState<Deal[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [stages, setStages] = useState<PipelineStage[]>(DEFAULT_STAGES)
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editDeal, setEditDeal] = useState<Deal | null>(null)
  const [dragDeal, setDragDeal] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(emptyForm)

  const load = async () => {
    if (!profile?.orgId) { setLoading(false); return }
    const [d, c, org] = await Promise.all([getDeals(profile.orgId), getClients(profile.orgId), getOrganization(profile.orgId)])
    setDeals(d)
    setClients(c)
    if (org?.settings?.pipelineStages?.length) setStages(org.settings.pipelineStages)
    setLoading(false)
  }

  useEffect(() => { load() }, [profile])

  const getClientName = (id: string) => clients.find(c => c.id === id)?.name || 'Sin cliente'

  const openCreate = () => {
    setEditDeal(null)
    setForm(emptyForm)
    setShowForm(true)
  }

  const openEdit = (deal: Deal) => {
    setEditDeal(deal)
    setForm({
      clientId: deal.clientId,
      stage: deal.stage,
      value: deal.value?.toString() || '',
      notes: deal.notes || '',
    })
    setShowForm(true)
  }

  const handleDrop = async (stageId: string, dealId: string) => {
    if (!profile?.orgId || stageId === deals.find(d => d.id === dealId)?.stage) return
    await updateDeal(profile.orgId, dealId, { stage: stageId })
    setDeals(prev => prev.map(d => d.id === dealId ? { ...d, stage: stageId } : d))
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profile?.orgId) return
    setSaving(true)
    try {
      if (editDeal) {
        await updateDeal(profile.orgId, editDeal.id, {
          stage: form.stage,
          value: form.value ? parseFloat(form.value) : undefined,
          notes: form.notes,
        })
        toast.success('Oportunidad actualizada')
      } else {
        await createDeal(profile.orgId, {
          clientId: form.clientId,
          stage: form.stage,
          value: form.value ? parseFloat(form.value) : undefined,
          notes: form.notes,
          assignedTo: profile.uid,
        })
        toast.success('Oportunidad creada')
      }
      setShowForm(false)
      load()
    } catch {
      toast.error('Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (dealId: string) => {
    if (!profile?.orgId || !confirm('¿Eliminar esta oportunidad?')) return
    await deleteDeal(profile.orgId, dealId)
    setDeals(prev => prev.filter(d => d.id !== dealId))
    setShowForm(false)
    toast.success('Oportunidad eliminada')
  }

  const totalPipeline = deals
    .filter(d => d.stage !== 'closed_lost')
    .reduce((s, d) => s + (d.value ?? 0), 0)

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pipeline de ventas</h1>
          <p className="text-gray-500 text-sm mt-1">
            {deals.length} oportunidades · ${totalPipeline.toLocaleString()} en pipeline
          </p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 bg-gray-900 hover:bg-gray-800 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors self-start sm:self-auto"
        >
          <Plus size={18} /> Nueva oportunidad
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-gray-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {stages.map(stage => {
            const stageDeals = deals.filter(d => d.stage === stage.id)
            const total = stageDeals.reduce((s, d) => s + (d.value ?? 0), 0)

            return (
              <div
                key={stage.id}
                className="flex-shrink-0 w-72 bg-gray-50 border border-gray-200 rounded-xl overflow-hidden"
                onDragOver={e => e.preventDefault()}
                onDrop={e => { e.preventDefault(); if (dragDeal) handleDrop(stage.id, dragDeal) }}
              >
                <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-white">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: stage.color }} />
                    <span className="font-semibold text-gray-800 text-sm">{stage.name}</span>
                    <span className="bg-gray-100 text-gray-500 text-xs px-1.5 py-0.5 rounded-full">{stageDeals.length}</span>
                  </div>
                  {total > 0 && <span className="text-xs text-gray-400">${total.toLocaleString()}</span>}
                </div>

                <div className="p-3 space-y-3 min-h-32">
                  {stageDeals.map(deal => (
                    <div
                      key={deal.id}
                      draggable
                      onDragStart={() => setDragDeal(deal.id)}
                      onDragEnd={() => setDragDeal(null)}
                      className="bg-white border border-gray-200 rounded-lg p-3 cursor-grab active:cursor-grabbing hover:border-gray-300 hover:shadow-sm transition-all group"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium text-gray-900 flex-1">{getClientName(deal.clientId)}</p>
                        <button
                          onClick={() => openEdit(deal)}
                          className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-gray-700 rounded transition-all"
                        >
                          <Pencil size={13} />
                        </button>
                      </div>
                      {deal.value !== undefined && (
                        <p className="text-xs font-semibold text-gray-700 mt-1">${deal.value.toLocaleString()}</p>
                      )}
                      {deal.notes && (
                        <p className="text-xs text-gray-400 mt-1 line-clamp-2">{deal.notes}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title={editDeal ? 'Editar oportunidad' : 'Nueva oportunidad'}
        size="sm"
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className={labelClass}>Cliente *</label>
            {editDeal ? (
              <p className="text-gray-900 font-medium py-1">{getClientName(editDeal.clientId)}</p>
            ) : (
              <select required value={form.clientId} onChange={e => setForm(f => ({ ...f, clientId: e.target.value }))}
                className={inputClass}>
                <option value="">Seleccionar cliente</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            )}
          </div>
          <div>
            <label className={labelClass}>Etapa</label>
            <select value={form.stage} onChange={e => setForm(f => ({ ...f, stage: e.target.value }))}
              className={inputClass}>
              {stages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass}>Valor estimado ($)</label>
            <input type="number" min="0" step="0.01" value={form.value}
              onChange={e => setForm(f => ({ ...f, value: e.target.value }))}
              className={inputClass} placeholder="0.00" />
          </div>
          <div>
            <label className={labelClass}>Notas</label>
            <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              rows={2} className={`${inputClass} resize-none`} />
          </div>
          <div className="flex gap-3 pt-1">
            {editDeal && (
              <button
                type="button"
                onClick={() => handleDelete(editDeal.id)}
                className="flex items-center gap-2 px-4 py-2.5 text-red-600 hover:bg-red-50 border border-red-200 rounded-lg text-sm transition-colors"
              >
                <Trash2 size={15} /> Eliminar
              </button>
            )}
            <button type="submit" disabled={saving}
              className="flex-1 bg-gray-900 hover:bg-gray-800 disabled:opacity-50 text-white font-semibold py-2.5 rounded-lg transition-colors">
              {saving ? 'Guardando...' : editDeal ? 'Guardar cambios' : 'Crear oportunidad'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
