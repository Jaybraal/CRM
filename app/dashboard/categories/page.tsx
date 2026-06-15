'use client'

import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '@/context/AuthContext'
import { getCategories, createCategory, updateCategory, deleteCategory, getClientsByCategory, ensureEliminadosCategory } from '@/lib/firestore'
import type { Category } from '@/types'
import Modal from '@/components/ui/Modal'
import { Plus, Pencil, Trash2, Trash } from 'lucide-react'
import toast from 'react-hot-toast'
import { Spinner } from '@/components/ui/primitives'

const COLORS = ['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#ec4899','#06b6d4','#f97316','#84cc16','#6366f1']

const inputClass = 'w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 text-sm transition-colors'
const labelClass = 'block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1.5'

export default function CategoriesPage() {
  const { profile } = useAuth()
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Category | null>(null)
  const [form, setForm] = useState({ name: '', color: '#3b82f6', description: '' })

  const load = useCallback(async () => {
    if (!profile?.orgId) { setLoading(false); return }
    try {
      await ensureEliminadosCategory(profile.orgId)
      setCategories(await getCategories(profile.orgId))
    } catch (e) { console.error(e) }
    setLoading(false)
  }, [profile?.orgId])

  useEffect(() => { load() }, [load])

  const openCreate = () => { setEditing(null); setForm({ name: '', color: '#3b82f6', description: '' }); setShowForm(true) }
  const openEdit = (cat: Category) => { setEditing(cat); setForm({ name: cat.name, color: cat.color, description: cat.description || '' }); setShowForm(true) }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profile?.orgId) return
    try {
      if (editing) { await updateCategory(profile.orgId, editing.id, form); toast.success('Categoría actualizada') }
      else { await createCategory(profile.orgId, form); toast.success('Categoría creada') }
      setShowForm(false); load()
    } catch { toast.error('Error al guardar') }
  }

  const handleDelete = async (id: string) => {
    if (!profile?.orgId) return
    const cat = categories.find(c => c.id === id)
    if (cat?.isSystem) { toast.error('Esta categoría del sistema no puede eliminarse'); return }
    const clients = await getClientsByCategory(profile.orgId, id)
    if (clients.length > 0) { toast.error(`No puedes eliminar: ${clients.length} cliente(s) la usan`); return }
    if (!confirm('¿Eliminar esta categoría?')) return
    await deleteCategory(profile.orgId, id)
    toast.success('Categoría eliminada')
    load()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white">Categorías</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Organiza tus clientes por categorías</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl text-sm font-bold shadow-lg shadow-blue-500/20 transition-all hover:scale-105">
          <Plus size={17} /> Nueva categoría
        </button>
      </div>

      {loading ? (
        <Spinner />
      ) : categories.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-16 text-center shadow-sm">
          <p className="text-slate-400 dark:text-slate-500">No hay categorías. Crea la primera.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {categories.map(cat => {
            const isEliminados = cat.isSystem && cat.systemKey === 'eliminados'
            return (
              <div key={cat.id} className={`bg-white dark:bg-slate-900 border rounded-2xl p-5 flex items-center gap-4 transition-all hover:shadow-md ${isEliminados ? 'border-red-200 dark:border-red-900/50' : 'border-slate-100 dark:border-slate-800'}`}>
                <div className="w-12 h-12 rounded-2xl flex-shrink-0 flex items-center justify-center" style={{ backgroundColor: cat.color + '18', border: `2px solid ${cat.color}40` }}>
                  {isEliminados ? <Trash size={18} style={{ color: cat.color }} /> : <div className="w-4 h-4 rounded-full" style={{ backgroundColor: cat.color }} />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-black text-slate-900 dark:text-white">{cat.name}</p>
                    {isEliminados && <span className="text-xs bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 px-2 py-0.5 rounded-full font-bold">Auto-elimina 14d</span>}
                  </div>
                  {cat.description && <p className="text-sm text-slate-400 dark:text-slate-500 truncate">{cat.description}</p>}
                </div>
                {!isEliminados && (
                  <div className="flex gap-1">
                    <button onClick={() => openEdit(cat)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-xl transition-colors"><Pencil size={15} /></button>
                    <button onClick={() => handleDelete(cat.id)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors"><Trash2 size={15} /></button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <Modal open={showForm} onClose={() => setShowForm(false)} title={editing ? 'Editar categoría' : 'Nueva categoría'} size="sm">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className={labelClass}>Nombre *</label>
            <input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className={inputClass} placeholder="Ej: VIP, Interesado..." />
          </div>
          <div>
            <label className={labelClass}>Descripción</label>
            <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className={inputClass} placeholder="Descripción opcional" />
          </div>
          <div>
            <label className={labelClass}>Color</label>
            <div className="flex flex-wrap gap-2">
              {COLORS.map(c => (
                <button key={c} type="button" onClick={() => setForm(f => ({ ...f, color: c }))}
                  className={`w-8 h-8 rounded-full transition-transform hover:scale-110 ${form.color === c ? 'scale-125 ring-2 ring-offset-2 ring-blue-400' : ''}`}
                  style={{ backgroundColor: c }} />
              ))}
            </div>
          </div>
          <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 rounded-xl transition-colors">
            {editing ? 'Actualizar' : 'Crear categoría'}
          </button>
        </form>
      </Modal>
    </div>
  )
}
