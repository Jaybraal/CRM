'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { getDeals, getClients, updateDeal, createDeal, deleteDeal, getOrganization } from '@/lib/firestore'
import type { Deal, Client, PipelineStage } from '@/types'
import Modal from '@/components/ui/Modal'
import { Plus, Pencil, Trash2, ArrowRight } from 'lucide-react'
import toast from 'react-hot-toast'

const DEFAULT_STAGES: PipelineStage[] = [
  { id: 'new', name: 'Nuevo', order: 0, color: '#6b7280' },
  { id: 'contacted', name: 'Contactado', order: 1, color: '#3b82f6' },
  { id: 'negotiation', name: 'Negociación', order: 2, color: '#f59e0b' },
  { id: 'closed_won', name: 'Ganado', order: 3, color: '#10b981' },
  { id: 'closed_lost', name: 'Perdido', order: 4, color: '#ef4444' },
]

const inputClass = 'w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 text-sm transition-colors'
const labelClass = 'block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1.5'
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
  const [moveDeal, setMoveDeal] = useState<Deal | null>(null)

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

  const openCreate = () => { setEditDeal(null); setForm(emptyForm); setShowForm(true) }

  const openEdit = (deal: Deal) => {
    setEditDeal(deal)
    setForm({ clientId: deal.clientId, stage: deal.stage, value: deal.value?.toString() || '', notes: deal.notes || '' })
    setShowForm(true)
  }

  const handleDrop = async (stageId: string, dealId: string) => {
    if (!profile?.orgId || stageId === deals.find(d => d.id === dealId)?.stage) return
    await updateDeal(profile.orgId, dealId, { stage: stageId })
    setDeals(prev => prev.map(d => d.id === dealId ? { ...d, stage: stageId } : d))
    toast.success('Movido')
  }

  const handleMoveToStage = async (deal: Deal, stageId: string) => {
    if (!profile?.orgId || stageId === deal.stage) return
    await updateDeal(profile.orgId, deal.id, { stage: stageId })
    setDeals(prev => prev.map(d => d.id === deal.id ? { ...d, stage: stageId } : d))
    setMoveDeal(null)
    toast.success('Movido a ' + stages.find(s => s.id === stageId)?.name)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profile?.orgId) return
    setSaving(true)
    try {
      if (editDeal) {
        await updateDeal(profile.orgId, editDeal.id, { stage: form.stage, value: form.value ? parseFloat(form.value) : undefined, notes: form.notes })
        toast.success('Oportunidad actualizada')
      } else {
        await createDeal(profile.orgId, { clientId: form.clientId, stage: form.stage, value: form.value ? parseFloat(form.value) : undefined, notes: form.notes, assignedTo: profile.uid })
        toast.success('Oportunidad creada')
      }
      setShowForm(false)
      load()
    } catch { toast.error('Error al guardar') }
    finally { setSaving(false) }
  }

  const handleDelete = async (dealId: string) => {
    if (!profile?.orgId || !confirm('¿Eliminar esta oportunidad?')) return
    await deleteDeal(profile.orgId, dealId)
    setDeals(prev => prev.filter(d => d.id !== dealId))
    setShowForm(false)
    toast.success('Eliminada')
  }

  const totalPipeline = deals.filter(d => d.stage !== 'closed_lost').reduce((s, d) => s + (d.value ?? 0), 0)

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
        <div>
          <h1 className="text-3xl font-black text-slate-900 dark:text-white">Pipeline</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            {deals.length} oportunidades · <span className="text-blue-600 font-bold">${totalPipeline.toLocaleString()}</span> en pipeline
          </p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl text-sm font-bold shadow-lg shadow-blue-500/20 transition-all hover:scale-105 self-start sm:self-auto">
          <Plus size={17} /> Nueva oportunidad
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {stages.map(stage => {
            const stageDeals = deals.filter(d => d.stage === stage.id)
            const total = stageDeals.reduce((s, d) => s + (d.value ?? 0), 0)
            return (
              <div
                key={stage.id}
                className="flex-shrink-0 w-72 bg-slate-100 dark:bg-slate-900/50 rounded-2xl overflow-hidden"
                onDragOver={e => e.preventDefault()}
                onDrop={e => { e.preventDefault(); if (dragDeal) handleDrop(stage.id, dragDeal) }}
              >
                <div className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: stage.color }} />
                    <span className="font-black text-slate-700 dark:text-slate-200 text-sm uppercase tracking-wide">{stage.name}</span>
                    <span className="bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-xs px-2 py-0.5 rounded-full font-bold">{stageDeals.length}</span>
                  </div>
                  {total > 0 && <span className="text-xs font-bold text-slate-400">${total.toLocaleString()}</span>}
                </div>

                <div className="p-3 space-y-2 min-h-32">
                  {stageDeals.map(deal => (
                    <div
                      key={deal.id}
                      draggable
                      onDragStart={() => setDragDeal(deal.id)}
                      onDragEnd={() => setDragDeal(null)}
                      className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl p-3 cursor-grab active:cursor-grabbing hover:border-blue-200 dark:hover:border-blue-700 hover:shadow-md transition-all group"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-bold text-slate-900 dark:text-white flex-1">{getClientName(deal.clientId)}</p>
                        <div className="flex items-center gap-0.5">
                          <button onClick={() => setMoveDeal(deal)} className="sm:hidden p-1 text-slate-400 hover:text-blue-600 rounded transition-all">
                            <ArrowRight size={13} />
                          </button>
                          <button onClick={() => openEdit(deal)} className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 p-1 text-slate-400 hover:text-blue-600 rounded transition-all">
                            <Pencil size={13} />
                          </button>
                        </div>
                      </div>
                      {deal.value !== undefined && (
                        <p className="text-xs font-black text-blue-600 mt-1">${deal.value.toLocaleString()}</p>
                      )}
                      {deal.notes && (
                        <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 line-clamp-2">{deal.notes}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {moveDeal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => setMoveDeal(null)}>
          <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-2xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-black text-slate-900 dark:text-white text-sm">Mover a etapa</h3>
              <p className="text-xs text-slate-500 mt-0.5">{getClientName(moveDeal.clientId)}</p>
            </div>
            <div className="p-2">
              {stages.map(stage => (
                <button key={stage.id} onClick={() => handleMoveToStage(moveDeal, stage.id)} disabled={moveDeal.stage === stage.id}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-colors ${moveDeal.stage === stage.id ? 'bg-slate-50 dark:bg-slate-800 text-slate-400' : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200'}`}>
                  <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: stage.color }} />
                  <span className="text-sm font-bold flex-1">{stage.name}</span>
                  {moveDeal.stage === stage.id && <span className="text-xs text-slate-400">Actual</span>}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <Modal open={showForm} onClose={() => setShowForm(false)} title={editDeal ? 'Editar oportunidad' : 'Nueva oportunidad'} size="sm">
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className={labelClass}>Cliente *</label>
            {editDeal ? (
              <p className="text-slate-900 dark:text-white font-bold py-1">{getClientName(editDeal.clientId)}</p>
            ) : (
              <select required value={form.clientId} onChange={e => setForm(f => ({ ...f, clientId: e.target.value }))} className={inputClass}>
                <option value="">Seleccionar cliente</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            )}
          </div>
          <div>
            <label className={labelClass}>Etapa</label>
            <select value={form.stage} onChange={e => setForm(f => ({ ...f, stage: e.target.value }))} className={inputClass}>
              {stages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass}>Valor estimado ($)</label>
            <input type="number" min="0" step="0.01" value={form.value} onChange={e => setForm(f => ({ ...f, value: e.target.value }))} className={inputClass} placeholder="0.00" />
          </div>
          <div>
            <label className={labelClass}>Notas</label>
            <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} className={`${inputClass} resize-none`} />
          </div>
          <div className="flex gap-3 pt-1">
            {editDeal && (
              <button type="button" onClick={() => handleDelete(editDeal.id)} className="flex items-center gap-2 px-4 py-2.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-sm font-bold transition-colors">
                <Trash2 size={15} /> Eliminar
              </button>
            )}
            <button type="submit" disabled={saving} className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold py-2.5 rounded-xl transition-colors">
              {saving ? 'Guardando...' : editDeal ? 'Guardar cambios' : 'Crear oportunidad'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
