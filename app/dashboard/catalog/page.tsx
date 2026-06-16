'use client'

import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '@/context/AuthContext'
import { getCatalog, createCatalogItem, updateCatalogItem, deleteCatalogItem } from '@/lib/firestore'
import type { CatalogItem } from '@/types'
import PhotoUploader from '@/components/ui/PhotoUploader'
import Modal from '@/components/ui/Modal'
import { Plus, Pencil, Trash2, ShoppingBag, Eye, EyeOff, Copy, ExternalLink } from 'lucide-react'
import toast from 'react-hot-toast'
import { Spinner } from '@/components/ui/primitives'

const inputClass = 'w-full bg-[#F4F5F7] dark:bg-[#1A2540] border border-[#E3E6EC] dark:border-[#1A2540] rounded-md px-4 py-2.5 text-[#0C1224] dark:text-[#E8ECF4] focus:outline-none focus:border-[#0D7A65] focus:ring-1 focus:ring-[#0D7A65]/10 text-sm transition-colors'
const labelClass = 'block text-sm font-bold text-[#0C1224] dark:text-[#9BA5B7] mb-1.5'

const emptyForm = { title: '', description: '', price: '', available: true, photos: [] as string[], specs: {} as Record<string, string> }

export default function CatalogPage() {
  const { profile } = useAuth()
  const [items, setItems] = useState<CatalogItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<CatalogItem | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [copiedLink, setCopiedLink] = useState(false)

  const publicUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/c/${profile?.orgId}`
    : `/c/${profile?.orgId}`

  const load = useCallback(async () => {
    if (!profile?.orgId) { setLoading(false); return }
    try {
      const data = await getCatalog(profile.orgId)
      setItems(data)
    } catch { toast.error('Error cargando catálogo') }
    setLoading(false)
  }, [profile?.orgId])

  useEffect(() => { load() }, [load])

  const openCreate = () => {
    setEditing(null)
    setForm(emptyForm)
    setShowForm(true)
  }

  const openEdit = (item: CatalogItem) => {
    setEditing(item)
    setForm({
      title: item.title,
      description: item.description || '',
      price: item.price?.toString() || '',
      available: item.available,
      photos: item.photos,
      specs: item.specs || {},
    })
    setShowForm(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profile?.orgId) return
    if (!form.title.trim()) { toast.error('El nombre es obligatorio'); return }
    if (form.photos.length === 0) { toast.error('Agrega al menos una foto'); return }
    setSaving(true)
    try {
      const data = {
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        price: form.price ? parseFloat(form.price) : undefined,
        available: form.available,
        photos: form.photos,
        specs: form.specs,
      }
      if (editing) {
        await updateCatalogItem(profile.orgId, editing.id, data)
        toast.success('Producto actualizado')
      } else {
        await createCatalogItem(profile.orgId, data)
        toast.success('Producto creado')
      }
      setShowForm(false)
      load()
    } catch { toast.error('Error al guardar') }
    setSaving(false)
  }

  const handleDelete = async (item: CatalogItem) => {
    if (!profile?.orgId) return
    if (!confirm(`¿Eliminar "${item.title}"?`)) return
    try {
      await deleteCatalogItem(profile.orgId, item.id)
      toast.success('Producto eliminado')
      load()
    } catch { toast.error('Error al eliminar') }
  }

  const toggleAvailable = async (item: CatalogItem) => {
    if (!profile?.orgId) return
    try {
      await updateCatalogItem(profile.orgId, item.id, { available: !item.available })
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, available: !i.available } : i))
    } catch { toast.error('Error al actualizar') }
  }

  const copyPublicLink = () => {
    navigator.clipboard.writeText(publicUrl)
    setCopiedLink(true)
    setTimeout(() => setCopiedLink(false), 2000)
    toast.success('Link copiado')
  }

  const canEdit = profile?.role && ['super_admin', 'owner', 'manager'].includes(profile.role)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#0C1224] dark:text-[#E8ECF4]">Catálogo</h1>
          <p className="text-[#68748D] dark:text-[#9BA5B7] text-sm mt-1">{items.length} producto{items.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Link público */}
          <button
            onClick={copyPublicLink}
            className="flex items-center gap-2 px-3 py-2.5 border border-[#E3E6EC] dark:border-[#1A2540] text-[#68748D] dark:text-[#9BA5B7] hover:bg-[#F4F5F7] dark:hover:bg-[#1A2540] rounded-md text-sm transition-colors"
          >
            {copiedLink ? <Copy size={16} className="text-green-500" /> : <Copy size={16} />}
            {copiedLink ? 'Copiado' : 'Link público'}
          </button>
          <a
            href={publicUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-3 py-2.5 border border-[#E3E6EC] dark:border-[#1A2540] text-[#68748D] dark:text-[#9BA5B7] hover:bg-[#F4F5F7] dark:hover:bg-[#1A2540] rounded-md text-sm transition-colors"
          >
            <ExternalLink size={16} /> Ver catálogo
          </a>
          {canEdit && (
            <button
              onClick={openCreate}
              className="flex items-center gap-2 bg-[#0C1224] hover:bg-[#1B2B4B] text-white px-4 py-2.5 rounded-md text-sm font-bold shadow-lg transition-all"
            >
              <Plus size={18} /> Nuevo producto
            </button>
          )}
        </div>
      </div>

      {/* Grid de productos */}
      {loading ? (
        <Spinner />
      ) : items.length === 0 ? (
        <div className="bg-white dark:bg-[#0F1829] border border-[#E3E6EC] dark:border-[#1A2540] rounded-lg shadow-sm p-16 text-center">
          <ShoppingBag size={40} className="mx-auto text-[#9BA5B7] dark:text-[#68748D] mb-4" />
          <p className="font-bold text-[#0C1224] dark:text-[#9BA5B7]">Sin productos todavía</p>
          <p className="text-sm text-[#9BA5B7] dark:text-[#68748D] mt-1">Agrega tu primer producto al catálogo</p>
          {canEdit && (
            <button onClick={openCreate} className="mt-4 inline-flex items-center gap-2 bg-[#0C1224] hover:bg-[#1B2B4B] text-white px-4 py-2 rounded-md text-sm font-bold shadow-lg transition-all">
              <Plus size={16} /> Agregar producto
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {items.map(item => (
            <div key={item.id} className={`bg-white dark:bg-[#0F1829] border rounded-lg overflow-hidden transition-all hover:shadow-md ${item.available ? 'border-[#E3E6EC] dark:border-[#1A2540]' : 'border-[#E3E6EC] dark:border-[#1A2540] opacity-60'}`}>
              {/* Foto */}
              <div className="aspect-square bg-[#F4F5F7] dark:bg-[#1A2540] relative">
                {item.photos.length > 0 ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.photos[0]} alt={item.title} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <ShoppingBag size={32} className="text-[#9BA5B7] dark:text-[#68748D]" />
                  </div>
                )}
                {!item.available && (
                  <div className="absolute inset-0 bg-white/60 dark:bg-[#0F1829]/60 flex items-center justify-center">
                    <span className="bg-slate-800 dark:bg-[#1A2540] text-white text-xs px-2 py-1 rounded-full font-bold">No disponible</span>
                  </div>
                )}
                {item.photos.length > 1 && (
                  <span className="absolute bottom-2 right-2 bg-black/50 text-white text-xs px-1.5 py-0.5 rounded-full">
                    +{item.photos.length - 1}
                  </span>
                )}
              </div>

              {/* Info */}
              <div className="p-3">
                <p className="font-bold text-[#0C1224] dark:text-[#E8ECF4] truncate">{item.title}</p>
                {item.description && (
                  <p className="text-xs text-[#68748D] dark:text-[#9BA5B7] mt-0.5 line-clamp-2">{item.description}</p>
                )}
                {item.price != null && (
                  <p className="text-base font-bold text-[#0C1224] dark:text-[#E8ECF4] mt-2">
                    ${item.price.toLocaleString('es')}
                  </p>
                )}

                {/* Acciones */}
                {canEdit && (
                  <div className="flex items-center gap-1 mt-3 pt-3 border-t border-[#E3E6EC] dark:border-[#1A2540]">
                    <button
                      onClick={() => toggleAvailable(item)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs text-[#68748D] dark:text-[#9BA5B7] hover:bg-[#F4F5F7] dark:hover:bg-[#1A2540] rounded-lg transition-colors"
                    >
                      {item.available ? <EyeOff size={13} /> : <Eye size={13} />}
                      {item.available ? 'Ocultar' : 'Mostrar'}
                    </button>
                    <button
                      onClick={() => openEdit(item)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs text-[#68748D] dark:text-[#9BA5B7] hover:bg-[#F4F5F7] dark:hover:bg-[#1A2540] rounded-lg transition-colors"
                    >
                      <Pencil size={13} /> Editar
                    </button>
                    <button
                      onClick={() => handleDelete(item)}
                      className="flex items-center justify-center p-1.5 text-[#9BA5B7] dark:text-[#68748D] hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal formulario */}
      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title={editing ? 'Editar producto' : 'Nuevo producto'}
        size="sm"
        footer={
          <div className="flex gap-2">
            <button type="button" onClick={() => setShowForm(false)}
              className="flex-1 py-2 border border-[#E3E6EC] dark:border-[#1A2540] text-[#68748D] dark:text-[#9BA5B7] hover:bg-[#F4F5F7] dark:hover:bg-[#1A2540] rounded-md text-xs transition-colors">
              Cancelar
            </button>
            <button form="catalog-form" type="submit" disabled={saving}
              className="flex-1 py-2 bg-[#0C1224] hover:bg-[#1B2B4B] disabled:opacity-50 text-white rounded-md text-xs font-bold shadow-lg transition-all">
              {saving ? 'Guardando...' : editing ? 'Actualizar' : 'Crear'}
            </button>
          </div>
        }
      >
        <form id="catalog-form" onSubmit={handleSubmit} className="space-y-3">
          {/* Fotos - grid compacto */}
          <div>
            <label className={labelClass}>Fotos (máx. 8)</label>
            <div className="mt-1">
              <PhotoUploader
                orgId={profile?.orgId || ''}
                folder="catalog"
                existingPhotos={form.photos}
                onPhotosChange={urls => setForm(f => ({ ...f, photos: urls }))}
                maxPhotos={8}
              />
            </div>
          </div>

          {/* Nombre */}
          <div>
            <label className={labelClass}>Nombre *</label>
            <input
              className={inputClass}
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder="Producto"
              required
            />
          </div>

          {/* Precio + Disponible */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={labelClass}>Precio</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9BA5B7] dark:text-[#68748D] text-xs">$</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className={inputClass + ' pl-7'}
                  value={form.price}
                  onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
                  placeholder="0"
                />
              </div>
            </div>
            <div>
              <label className={labelClass}>Disponible</label>
              <button
                type="button"
                onClick={() => setForm(f => ({ ...f, available: !f.available }))}
                className={`w-full h-10 rounded-md transition-colors flex items-center justify-center text-xs font-bold ${form.available ? 'bg-green-100 dark:bg-green-950/40 text-green-700 dark:text-green-400' : 'bg-[#F4F5F7] dark:bg-[#1A2540] text-[#68748D] dark:text-[#9BA5B7]'}`}
              >
                {form.available ? 'Sí' : 'No'}
              </button>
            </div>
          </div>

          {/* Descripción */}
          <div>
            <label className={labelClass}>Descripción</label>
            <textarea
              className={inputClass + ' resize-none'}
              rows={2}
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Detalles..."
            />
          </div>
        </form>
      </Modal>
    </div>
  )
}
