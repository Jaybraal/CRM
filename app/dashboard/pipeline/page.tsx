'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { getDeals, getClients, updateDeal, createDeal, deleteDeal, getOrganization } from '@/lib/firestore'
import type { Deal, Client, PipelineStage } from '@/types'
import Modal from '@/components/ui/Modal'
import { Plus, Pencil, Trash2, ArrowRight } from 'lucide-react'
import toast from 'react-hot-toast'
import { Spinner } from '@/components/ui/primitives'

const DEFAULT_STAGES: PipelineStage[] = [
  { id: 'new', name: 'Nuevo', order: 0, color: '#6b7280' },
  { id: 'contacted', name: 'Contactado', order: 1, color: '#3b82f6' },
  { id: 'negotiation', name: 'Negociación', order: 2, color: '#f59e0b' },
  { id: 'closed_won', name: 'Ganado', order: 3, color: '#10b981' },
  { id: 'closed_lost', name: 'Perdido', order: 4, color: '#ef4444' },
]

const inputClass = 'w-full bg-[#F4F5F7] dark:bg-[#1A2540] border border-[#E3E6EC] dark:border-[#1A2540] rounded-md px-4 py-2.5 text-[#0C1224] dark:text-[#E8ECF4] focus:outline-none focus:border-[#0D7A65] focus:ring-1 focus:ring-[#0D7A65]/10 text-sm transition-colors'
const labelClass = 'block text-sm font-bold text-[#0C1224] dark:text-[#9BA5B7] mb-1.5'
const emptyForm = { clientId: '', stage: 'new', value: '', probability: '', closeDate: '', notes: '' }

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
  const [form, setForm] = useState<{ clientId: string; stage: string; value: string; probability: string; closeDate: string; notes: string }>(emptyForm)
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
    const closeDateStr = deal.closeDate
      ? (() => { const d = deal.closeDate instanceof Date ? deal.closeDate : new Date((deal.closeDate as unknown as { seconds: number }).seconds * 1000); return d.toISOString().slice(0, 10) })()
      : ''
    setForm({
      clientId: deal.clientId,
      stage: deal.stage,
      value: deal.value?.toString() || '',
      probability: deal.probability?.toString() || '',
      closeDate: closeDateStr,
      notes: deal.notes || '',
    })
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
        await updateDeal(profile.orgId, editDeal.id, {
          stage: form.stage,
          value: form.value ? parseFloat(form.value) : undefined,
          probability: form.probability ? parseInt(form.probability) : undefined,
          closeDate: form.closeDate ? new Date(form.closeDate) as unknown as Date : undefined,
          notes: form.notes,
        })
        toast.success('Oportunidad actualizada')
      } else {
        await createDeal(profile.orgId, {
          clientId: form.clientId,
          stage: form.stage,
          value: form.value ? parseFloat(form.value) : undefined,
          probability: form.probability ? parseInt(form.probability) : undefined,
          closeDate: form.closeDate ? new Date(form.closeDate) as unknown as Date : undefined,
          notes: form.notes,
          assignedTo: profile.uid,
        })
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
          <h1 className="text-2xl font-bold text-[#0C1224] dark:text-[#E8ECF4]">Pipeline</h1>
          <p className="text-[#68748D] dark:text-[#9BA5B7] text-sm mt-1">
            {deals.length} oportunidades · <span className="text-[#0D7A65] font-bold">${totalPipeline.toLocaleString()}</span> en pipeline
          </p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-2 bg-[#0C1224] hover:bg-[#1B2B4B] text-white px-4 py-2.5 rounded-md text-sm font-bold shadow-lg transition-all self-start sm:self-auto">
          <Plus size={17} /> Nueva oportunidad
        </button>
      </div>

      {loading ? (
        <Spinner />
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-4 -mx-1 px-1">
          {stages.map(stage => {
            const stageDeals = deals.filter(d => d.stage === stage.id)
            const total = stageDeals.reduce((s, d) => s + (d.value ?? 0), 0)
            const isOver = dragDeal && deals.find(d => d.id === dragDeal)?.stage !== stage.id
            return (
              <div
                key={stage.id}
                className={`flex-shrink-0 w-64 flex flex-col rounded-lg border transition-colors ${
                  isOver
                    ? 'border-blue-300 dark:border-[#0D7A65] bg-[#F4F5F7]/60 dark:bg-blue-900/10'
                    : 'border-[#E3E6EC] dark:border-[#1A2540] bg-white dark:bg-[#0F1829]'
                }`}
                onDragOver={e => e.preventDefault()}
                onDrop={e => { e.preventDefault(); if (dragDeal) handleDrop(stage.id, dragDeal) }}
              >
                {/* Column header */}
                <div className="px-4 pt-4 pb-3 border-b border-[#E3E6EC] dark:border-[#1A2540]">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: stage.color }} />
                      <span className="text-xs font-bold text-[#68748D] dark:text-[#9BA5B7] uppercase tracking-wider">{stage.name}</span>
                      <span className="text-xs font-bold text-[#9BA5B7] bg-[#F4F5F7] dark:bg-[#1A2540] px-1.5 py-0.5 rounded-full">{stageDeals.length}</span>
                    </div>
                    {total > 0 && (
                      <span className="text-xs font-bold text-[#0D7A65]">${total.toLocaleString()}</span>
                    )}
                  </div>
                  {/* Stage progress bar */}
                  <div className="mt-2 h-0.5 rounded-full bg-[#F4F5F7] dark:bg-[#1A2540] overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ backgroundColor: stage.color, width: stageDeals.length ? '100%' : '0%' }} />
                  </div>
                </div>

                {/* Cards */}
                <div className="p-2 space-y-2 flex-1 min-h-[120px]">
                  {stageDeals.map(deal => (
                    <div
                      key={deal.id}
                      draggable
                      onDragStart={() => setDragDeal(deal.id)}
                      onDragEnd={() => setDragDeal(null)}
                      className="bg-[#F4F5F7] dark:bg-[#1A2540] rounded-md p-3 cursor-grab active:cursor-grabbing hover:bg-white dark:hover:bg-[#1A2540] hover:shadow-sm border border-transparent hover:border-[#E3E6EC] dark:hover:border-slate-600 transition-all group"
                    >
                      <div className="flex items-start justify-between gap-1.5">
                        <p className="text-sm font-bold text-[#0C1224] dark:text-[#E8ECF4] leading-tight flex-1">{getClientName(deal.clientId)}</p>
                        <div className="flex items-center gap-0.5 flex-shrink-0">
                          <button onClick={() => setMoveDeal(deal)} className="sm:hidden p-1 text-[#9BA5B7] hover:text-[#0D7A65] rounded transition-colors">
                            <ArrowRight size={12} />
                          </button>
                          <button onClick={() => openEdit(deal)} className="opacity-0 group-hover:opacity-100 p-1 text-[#9BA5B7] hover:text-[#0D7A65] rounded transition-all">
                            <Pencil size={12} />
                          </button>
                        </div>
                      </div>

                      {deal.value !== undefined && (
                        <p className="text-sm font-bold text-[#0D7A65] mt-1">${deal.value.toLocaleString()}</p>
                      )}

                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        {deal.probability !== undefined && (
                          <div className="flex items-center gap-1">
                            <div className="w-12 h-1 rounded-full bg-[#E3E6EC] dark:bg-[#1A2540] overflow-hidden">
                              <div className="h-full rounded-full bg-blue-400" style={{ width: `${deal.probability}%` }} />
                            </div>
                            <span className="text-[10px] text-[#9BA5B7]">{deal.probability}%</span>
                          </div>
                        )}
                        {deal.closeDate && (
                          <span className="text-[10px] text-[#9BA5B7]">
                            {(() => { const d = deal.closeDate instanceof Date ? deal.closeDate : new Date((deal.closeDate as unknown as {seconds:number}).seconds*1000); return d.toLocaleDateString('es',{day:'numeric',month:'short'}) })()}
                          </span>
                        )}
                      </div>

                      {deal.notes && (
                        <p className="text-[11px] text-[#9BA5B7] dark:text-[#68748D] mt-1.5 line-clamp-2 leading-snug">{deal.notes}</p>
                      )}
                    </div>
                  ))}

                  {stageDeals.length === 0 && (
                    <button onClick={openCreate} className="w-full h-16 rounded-md border-2 border-dashed border-[#E3E6EC] dark:border-[#1A2540] text-[#9BA5B7] dark:text-[#68748D] hover:border-blue-300 hover:text-[#0D7A65] transition-colors flex items-center justify-center">
                      <Plus size={16} />
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {moveDeal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => setMoveDeal(null)}>
          <div className="w-full max-w-sm bg-white dark:bg-[#0F1829] rounded-lg shadow-sm overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-[#E3E6EC] dark:border-[#1A2540]">
              <h3 className="font-bold text-[#0C1224] dark:text-[#E8ECF4] text-sm">Mover a etapa</h3>
              <p className="text-xs text-[#68748D] dark:text-[#9BA5B7] mt-0.5">{getClientName(moveDeal.clientId)}</p>
            </div>
            <div className="p-2">
              {stages.map(stage => (
                <button key={stage.id} onClick={() => handleMoveToStage(moveDeal, stage.id)} disabled={moveDeal.stage === stage.id}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-md text-left transition-colors ${moveDeal.stage === stage.id ? 'bg-[#F4F5F7] dark:bg-[#1A2540] text-[#9BA5B7]' : 'hover:bg-[#F4F5F7] dark:hover:bg-[#1A2540] text-[#0C1224] dark:text-[#E8ECF4]'}`}>
                  <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: stage.color }} />
                  <span className="text-sm font-bold flex-1">{stage.name}</span>
                  {moveDeal.stage === stage.id && <span className="text-xs text-[#9BA5B7]">Actual</span>}
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
              <p className="text-[#0C1224] dark:text-[#E8ECF4] font-bold py-1">{getClientName(editDeal.clientId)}</p>
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
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Valor estimado ($)</label>
              <input type="number" min="0" step="0.01" value={form.value} onChange={e => setForm(f => ({ ...f, value: e.target.value }))} className={inputClass} placeholder="0.00" />
            </div>
            <div>
              <label className={labelClass}>Probabilidad (%)</label>
              <input type="number" min="0" max="100" value={form.probability} onChange={e => setForm(f => ({ ...f, probability: e.target.value }))} className={inputClass} placeholder="0-100" />
            </div>
          </div>
          <div>
            <label className={labelClass}>Fecha est. de cierre</label>
            <input type="date" value={form.closeDate} onChange={e => setForm(f => ({ ...f, closeDate: e.target.value }))} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Notas</label>
            <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} className={`${inputClass} resize-none`} />
          </div>
          <div className="flex gap-3 pt-1">
            {editDeal && (
              <button type="button" onClick={() => handleDelete(editDeal.id)} className="flex items-center gap-2 px-4 py-2.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md text-sm font-bold transition-colors">
                <Trash2 size={15} /> Eliminar
              </button>
            )}
            <button type="submit" disabled={saving} className="flex-1 bg-[#0C1224] hover:bg-[#1B2B4B] disabled:opacity-50 text-white font-bold py-2.5 rounded-md transition-colors">
              {saving ? 'Guardando...' : editDeal ? 'Guardar cambios' : 'Crear oportunidad'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
