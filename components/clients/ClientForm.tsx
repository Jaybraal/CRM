'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { createClient, updateClient } from '@/lib/firestore'
import PhotoUploader from '@/components/ui/PhotoUploader'
import type { Client, Category, ClientStatus } from '@/types'
import { DEFAULT_CLIENT_STATUSES } from '@/types'
import toast from 'react-hot-toast'
import { X } from 'lucide-react'
import { listAllCampaigns, type CampaignOption } from '@/lib/outreach/clientCampaigns'

interface Props {
  categories: Category[]
  clientStatuses?: ClientStatus[]
  existing?: Client | null
  onSuccess: () => void
}

const inputClass = 'w-full bg-[#F4F5F7] dark:bg-[#1A2540] border border-[#E3E6EC] dark:border-[#1A2540] rounded-md px-4 py-2.5 text-[#0C1224] dark:text-[#E8ECF4] focus:outline-none focus:border-[#0D7A65] focus:ring-1 focus:ring-[#0D7A65]/10 text-sm transition-colors'
const labelClass = 'block text-sm font-bold text-[#0C1224] dark:text-[#9BA5B7] mb-1.5'

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
    product: existing?.product || '',
    specialty: existing?.specialty || '',
    website: existing?.website || '',
    language: existing?.language || 'es' as 'es' | 'en' | 'de',
  })
  const [campaigns, setCampaigns] = useState<CampaignOption[]>([])

  useEffect(() => {
    if (!profile?.orgId) return
    listAllCampaigns(profile.orgId).then(setCampaigns).catch(() => {})
  }, [profile?.orgId])

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
          <span className="ml-1 text-xs text-[#9BA5B7] font-normal">(con código de país, ej: +52 55 1234 5678)</span>
        </label>
        <input
          value={form.whatsappPhone}
          onChange={e => set('whatsappPhone', e.target.value)}
          className={inputClass}
          placeholder="+52 55 1234 5678"
        />
      </div>

      <div className="border border-[#E3E6EC] dark:border-[#1A2540] rounded-md p-3 space-y-3">
        <p className="text-xs font-bold uppercase text-[#9BA5B7]">Lead de email — opcional (campaña de outreach)</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Negocio / campaña</label>
            <select value={form.product} onChange={e => set('product', e.target.value)} className={inputClass}>
              <option value="">Ninguno (contacto normal)</option>
              {campaigns.map(c => (
                <option key={c.id} value={c.id}>{c.businessLabel}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Idioma del correo</label>
            <select value={form.language} onChange={e => set('language', e.target.value)} className={inputClass}>
              <option value="es">Español</option>
              <option value="en">English</option>
              <option value="de">Deutsch</option>
            </select>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Rubro (opcional)</label>
            <input value={form.specialty} onChange={e => set('specialty', e.target.value)} className={inputClass} placeholder="ej. Tienda de ropa" />
          </div>
          <div>
            <label className={labelClass}>Sitio web (opcional)</label>
            <input value={form.website} onChange={e => set('website', e.target.value)} className={inputClass} placeholder="ejemplo.com" />
          </div>
        </div>
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
          <button type="button" onClick={addTag} className="px-4 py-2 bg-[#F4F5F7] dark:bg-[#1A2540] hover:bg-[#E3E6EC] dark:hover:bg-[#1A2540] border border-[#E3E6EC] dark:border-[#1A2540] rounded-md text-sm font-bold text-[#0C1224] dark:text-[#9BA5B7] transition-colors">
            +
          </button>
        </div>
        {form.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {form.tags.map(tag => (
              <span key={tag} className="flex items-center gap-1 text-xs bg-[#F4F5F7] dark:bg-[#1A2540] text-[#0C1224] dark:text-[#9BA5B7] px-2.5 py-1 rounded-full border border-[#E3E6EC] dark:border-[#1A2540]">
                {tag}
                <button type="button" onClick={() => removeTag(tag)} className="text-[#9BA5B7] hover:text-red-500 transition-colors"><X size={11} /></button>
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
        className="w-full bg-[#0C1224] hover:bg-[#1B2B4B] disabled:opacity-50 text-white font-bold py-2.5 rounded-md transition-colors shadow-lg"
      >
        {loading ? 'Guardando...' : existing ? 'Actualizar cliente' : 'Crear cliente'}
      </button>
    </form>
  )
}
