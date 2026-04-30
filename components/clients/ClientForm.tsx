'use client'

import { useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { createClient, updateClient } from '@/lib/firestore'
import PhotoUploader from '@/components/ui/PhotoUploader'
import type { Client, Category, ClientStatus } from '@/types'
import { DEFAULT_CLIENT_STATUSES } from '@/types'
import toast from 'react-hot-toast'
import { X } from 'lucide-react'

interface Props {
  categories: Category[]
  clientStatuses?: ClientStatus[]
  existing?: Client | null
  onSuccess: () => void
}

const inputClass = 'w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 text-sm transition-colors'
const labelClass = 'block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1.5'

export default function ClientForm({ categories, clientStatuses = DEFAULT_CLIENT_STATUSES, existing, onSuccess }: Props) {
  const { profile } = useAuth()
  const [loading, setLoading] = useState(false)
  const [tagInput, setTagInput] = useState('')
  const [form, setForm] = useState({
    name: existing?.name || '',
    email: existing?.email || '',
    phone: existing?.phone || '',
    whatsappPhone: existing?.whatsappPhone || '',
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
    if (!profile?.orgId) {
      toast.error('No tienes una organización asignada. Pide al admin que te asigne.')
      return
    }
    setLoading(true)
    try {
      const eliminados = categories.find(c => c.systemKey === 'eliminados')
      const isMovingToEliminados = eliminados && form.categoryId === eliminados.id
      const wasAlreadyInEliminados = existing?.categoryId === eliminados?.id

      const movedToCategoryAt = isMovingToEliminados && !wasAlreadyInEliminados
        ? new Date()
        : isMovingToEliminados && wasAlreadyInEliminados
          ? (existing?.movedToCategoryAt ?? new Date())
          : undefined

      const extraFields = movedToCategoryAt !== undefined ? { movedToCategoryAt } : {}

      if (existing) {
        await updateClient(profile.orgId, existing.id, { ...form, ...extraFields })
        toast.success('Cliente actualizado')
      } else {
        await createClient(profile.orgId, {
          ...form,
          ...extraFields,
          assignedTo: profile.uid,
          createdBy: profile.uid,
          pipelineStage: 'new',
        })
        toast.success('Cliente creado')
      }
      onSuccess()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error desconocido'
      toast.error(`Error al guardar: ${msg}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 max-h-[70vh] overflow-y-auto pr-1">
      <div>
        <label className={labelClass}>Nombre *</label>
        <input
          required
          value={form.name}
          onChange={e => set('name', e.target.value)}
          className={inputClass}
          placeholder="Nombre completo"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>Email</label>
          <input
            type="email"
            value={form.email}
            onChange={e => set('email', e.target.value)}
            className={inputClass}
            placeholder="correo@ejemplo.com"
          />
        </div>
        <div>
          <label className={labelClass}>Teléfono</label>
          <input
            value={form.phone}
            onChange={e => set('phone', e.target.value)}
            className={inputClass}
            placeholder="+1 234 567 8900"
          />
        </div>
      </div>

      <div>
        <label className={labelClass}>
          WhatsApp del cliente
          <span className="ml-1 text-xs text-slate-400 font-normal">(con código de país, ej: +52 55 1234 5678)</span>
        </label>
        <input
          value={form.whatsappPhone}
          onChange={e => set('whatsappPhone', e.target.value)}
          className={inputClass}
          placeholder="+52 55 1234 5678"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>Categoría</label>
          <select
            value={form.categoryId}
            onChange={e => set('categoryId', e.target.value)}
            className={inputClass}
          >
            <option value="">Sin categoría</option>
            {categories.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>Estado</label>
          <select
            value={form.status}
            onChange={e => set('status', e.target.value)}
            className={inputClass}
          >
            {clientStatuses.map(s => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className={labelClass}>Etiquetas</label>
        <div className="flex gap-2 mb-2">
          <input
            value={tagInput}
            onChange={e => setTagInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag() } }}
            className={inputClass}
            placeholder="Escribe y presiona Enter"
          />
          <button type="button" onClick={addTag} className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-700 dark:text-slate-300 transition-colors">
            +
          </button>
        </div>
        {form.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {form.tags.map(tag => (
              <span key={tag} className="flex items-center gap-1 text-xs bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2.5 py-1 rounded-full border border-slate-200 dark:border-slate-700">
                {tag}
                <button type="button" onClick={() => removeTag(tag)} className="text-slate-400 hover:text-red-500 transition-colors"><X size={11} /></button>
              </span>
            ))}
          </div>
        )}
      </div>

      <div>
        <label className={labelClass}>Notas</label>
        <textarea
          value={form.notes}
          onChange={e => set('notes', e.target.value)}
          rows={3}
          className={`${inputClass} resize-none`}
          placeholder="Notas adicionales..."
        />
      </div>

      <div>
        <label className={labelClass}>Fotos</label>
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
        className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold py-2.5 rounded-xl transition-colors shadow-lg shadow-blue-500/20"
      >
        {loading ? 'Guardando...' : existing ? 'Actualizar cliente' : 'Crear cliente'}
      </button>
    </form>
  )
}
