'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { getCategories, createCategory, updateCategory, deleteCategory, getClientsByCategory } from '@/lib/firestore'
import type { Category } from '@/types'
import Modal from '@/components/ui/Modal'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'

const COLORS = ['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#ec4899','#06b6d4','#f97316','#84cc16','#6366f1']

const inputClass = 'w-full bg-white border border-gray-300 rounded-lg px-4 py-2.5 text-gray-900 focus:outline-none focus:border-gray-500'
const labelClass = 'block text-sm font-medium text-gray-700 mb-1.5'

export default function CategoriesPage() {
  const { profile } = useAuth()
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Category | null>(null)
  const [form, setForm] = useState({ name: '', color: '#3b82f6', description: '' })

  const load = async () => {
    if (!profile?.orgId) { setLoading(false); return }
    const cats = await getCategories(profile.orgId)
    setCategories(cats)
    setLoading(false)
  }

  useEffect(() => { load() }, [profile])

  const openCreate = () => {
    setEditing(null)
    setForm({ name: '', color: '#3b82f6', description: '' })
    setShowForm(true)
  }

  const openEdit = (cat: Category) => {
    setEditing(cat)
    setForm({ name: cat.name, color: cat.color, description: cat.description || '' })
    setShowForm(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profile?.orgId) return
    try {
      if (editing) {
        await updateCategory(profile.orgId, editing.id, form)
        toast.success('Categoría actualizada')
      } else {
        await createCategory(profile.orgId, form)
        toast.success('Categoría creada')
      }
      setShowForm(false)
      load()
    } catch {
      toast.error('Error al guardar')
    }
  }

  const handleDelete = async (id: string) => {
    if (!profile?.orgId) return
    const clients = await getClientsByCategory(profile.orgId, id)
    if (clients.length > 0) {
      toast.error(`No puedes eliminar esta categoría: ${clients.length} cliente(s) la usan`)
      return
    }
    if (!confirm('¿Eliminar esta categoría?')) return
    await deleteCategory(profile.orgId, id)
    toast.success('Categoría eliminada')
    load()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Categorías</h1>
          <p className="text-gray-500 text-sm mt-1">Organiza tus clientes por categorías</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 bg-gray-900 hover:bg-gray-800 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
        >
          <Plus size={18} /> Nueva categoría
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-gray-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : categories.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
          <p className="text-gray-400">No hay categorías. Crea la primera.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {categories.map(cat => (
            <div key={cat.id} className="bg-white border border-gray-200 rounded-xl p-5 flex items-center gap-4 hover:border-gray-300 hover:shadow-sm transition-all">
              <div
                className="w-12 h-12 rounded-xl flex-shrink-0 flex items-center justify-center"
                style={{ backgroundColor: cat.color + '18', border: `2px solid ${cat.color}40` }}
              >
                <div className="w-4 h-4 rounded-full" style={{ backgroundColor: cat.color }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900">{cat.name}</p>
                {cat.description && (
                  <p className="text-sm text-gray-400 truncate">{cat.description}</p>
                )}
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => openEdit(cat)}
                  className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <Pencil size={15} />
                </button>
                <button
                  onClick={() => handleDelete(cat.id)}
                  className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={showForm} onClose={() => setShowForm(false)} title={editing ? 'Editar categoría' : 'Nueva categoría'} size="sm">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className={labelClass}>Nombre *</label>
            <input
              required
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className={inputClass}
              placeholder="Ej: VIP, Interesado, Comprador..."
            />
          </div>
          <div>
            <label className={labelClass}>Descripción</label>
            <input
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              className={inputClass}
              placeholder="Descripción opcional"
            />
          </div>
          <div>
            <label className={labelClass}>Color</label>
            <div className="flex flex-wrap gap-2">
              {COLORS.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, color: c }))}
                  className={`w-8 h-8 rounded-full transition-transform ${form.color === c ? 'scale-125 ring-2 ring-offset-2' : ''}`}
                  style={{ backgroundColor: c, ...(form.color === c ? { ringColor: c } : {}) }}
                />
              ))}
            </div>
          </div>
          <button
            type="submit"
            className="w-full bg-gray-900 hover:bg-gray-800 text-white font-semibold py-2.5 rounded-lg transition-colors"
          >
            {editing ? 'Actualizar' : 'Crear categoría'}
          </button>
        </form>
      </Modal>
    </div>
  )
}
