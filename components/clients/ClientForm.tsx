'use client'

import { useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { createClient, updateClient } from '@/lib/firestore'
import PhotoUploader from '@/components/ui/PhotoUploader'
import type { Client, Category } from '@/types'
import toast from 'react-hot-toast'
import { X } from 'lucide-react'

interface Props {
  categories: Category[]
  existing?: Client | null
  onSuccess: () => void
}

export default function ClientForm({ categories, existing, onSuccess }: Props) {
  const { profile } = useAuth()
  const [loading, setLoading] = useState(false)
  const [tagInput, setTagInput] = useState('')
  const [form, setForm] = useState({
    name: existing?.name || '',
    email: existing?.email || '',
    phone: existing?.phone || '',
    categoryId: existing?.categoryId || '',
    status: existing?.status || 'lead' as Client['status'],
    notes: existing?.notes || '',
    tags: existing?.tags || [] as string[],
    photos: existing?.photos || [] as string[],
  })

  const set = (key: string, value: unknown) => setForm(f => ({ ...f, [key]: value }))

  const addTag = () => {
    const t = tagInput.trim()
    if (t && !form.tags.includes(t)) {
      set('tags', [...form.tags, t])
      setTagInput('')
    }
  }

  const removeTag = (tag: string) => set('tags', form.tags.filter(t => t !== tag))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profile?.orgId) return
    setLoading(true)
    try {
      if (existing) {
        await updateClient(profile.orgId, existing.id, form)
        toast.success('Cliente actualizado')
      } else {
        await createClient(profile.orgId, {
          ...form,
          assignedTo: profile.uid,
          createdBy: profile.uid,
          pipelineStage: 'new',
        })
        toast.success('Cliente creado')
      }
      onSuccess()
    } catch {
      toast.error('Error al guardar')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 max-h-[70vh] overflow-y-auto pr-1">
      {/* Nombre */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Nombre *</label>
        <input
          required
          value={form.name}
          onChange={e => set('name', e.target.value)}
          className="w-full bg-white border border-gray-300 rounded-lg px-4 py-2.5 text-gray-900 focus:outline-none focus:border-gray-500"
          placeholder="Nombre completo"
        />
      </div>

      {/* Email + Teléfono */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
          <input
            type="email"
            value={form.email}
            onChange={e => set('email', e.target.value)}
            className="w-full bg-white border border-gray-300 rounded-lg px-4 py-2.5 text-gray-900 focus:outline-none focus:border-gray-500"
            placeholder="correo@ejemplo.com"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Teléfono</label>
          <input
            value={form.phone}
            onChange={e => set('phone', e.target.value)}
            className="w-full bg-white border border-gray-300 rounded-lg px-4 py-2.5 text-gray-900 focus:outline-none focus:border-gray-500"
            placeholder="+1 234 567 8900"
          />
        </div>
      </div>

      {/* Categoría + Estado */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Categoría</label>
          <select
            value={form.categoryId}
            onChange={e => set('categoryId', e.target.value)}
            className="w-full bg-white border border-gray-300 rounded-lg px-4 py-2.5 text-gray-900 focus:outline-none focus:border-gray-500"
          >
            <option value="">Sin categoría</option>
            {categories.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Estado</label>
          <select
            value={form.status}
            onChange={e => set('status', e.target.value as Client['status'])}
            className="w-full bg-white border border-gray-300 rounded-lg px-4 py-2.5 text-gray-900 focus:outline-none focus:border-gray-500"
          >
            <option value="lead">Lead</option>
            <option value="prospect">Prospecto</option>
            <option value="active">Activo</option>
            <option value="inactive">Inactivo</option>
          </select>
        </div>
      </div>

      {/* Tags */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Etiquetas</label>
        <div className="flex gap-2 mb-2">
          <input
            value={tagInput}
            onChange={e => setTagInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag() } }}
            className="flex-1 bg-white border border-gray-300 rounded-lg px-4 py-2 text-gray-900 text-sm focus:outline-none focus:border-gray-500"
            placeholder="Escribe y presiona Enter"
          />
          <button type="button" onClick={addTag} className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm text-gray-700 transition-colors">
            +
          </button>
        </div>
        {form.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {form.tags.map(tag => (
              <span key={tag} className="flex items-center gap-1 text-xs bg-gray-100 text-gray-700 px-2.5 py-1 rounded-full">
                {tag}
                <button type="button" onClick={() => removeTag(tag)}><X size={11} /></button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Notas */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Notas</label>
        <textarea
          value={form.notes}
          onChange={e => set('notes', e.target.value)}
          rows={3}
          className="w-full bg-white border border-gray-300 rounded-lg px-4 py-2.5 text-gray-900 focus:outline-none focus:border-gray-500 resize-none"
          placeholder="Notas adicionales..."
        />
      </div>

      {/* Fotos */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Fotos</label>
        <PhotoUploader
          orgId={profile?.orgId || ''}
          folder="clients"
          existingPhotos={form.photos}
          onPhotosChange={urls => set('photos', urls)}
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-gray-900 hover:bg-gray-800 disabled:opacity-50 text-white font-semibold py-2.5 rounded-lg transition-colors"
      >
        {loading ? 'Guardando...' : existing ? 'Actualizar cliente' : 'Crear cliente'}
      </button>
    </form>
  )
}
