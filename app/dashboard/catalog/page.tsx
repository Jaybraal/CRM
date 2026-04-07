'use client'

import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '@/context/AuthContext'
import { getCatalog, createCatalogItem, updateCatalogItem, deleteCatalogItem } from '@/lib/firestore'
import type { CatalogItem } from '@/types'
import PhotoUploader from '@/components/ui/PhotoUploader'
import Modal from '@/components/ui/Modal'
import { Plus, Pencil, Trash2, ShoppingBag, Eye, EyeOff, Copy, ExternalLink } from 'lucide-react'
import toast from 'react-hot-toast'

const inputClass = 'w-full bg-white border border-gray-300 rounded-lg px-3 py-2.5 text-gray-900 focus:outline-none focus:border-gray-500 text-sm'
const labelClass = 'block text-sm font-medium text-gray-700 mb-1.5'

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
          <h1 className="text-2xl font-bold text-gray-900">Catálogo</h1>
          <p className="text-gray-500 text-sm mt-1">{items.length} producto{items.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Link público */}
          <button
            onClick={copyPublicLink}
            className="flex items-center gap-2 px-3 py-2.5 border border-gray-200 hover:bg-gray-50 text-gray-600 rounded-lg text-sm transition-colors"
          >
            {copiedLink ? <Copy size={16} className="text-green-500" /> : <Copy size={16} />}
            {copiedLink ? 'Copiado' : 'Link público'}
          </button>
          <a
            href={publicUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-3 py-2.5 border border-gray-200 hover:bg-gray-50 text-gray-600 rounded-lg text-sm transition-colors"
          >
            <ExternalLink size={16} /> Ver catálogo
          </a>
          {canEdit && (
            <button
              onClick={openCreate}
              className="flex items-center gap-2 bg-gray-900 hover:bg-gray-800 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
            >
              <Plus size={18} /> Nuevo producto
            </button>
          )}
        </div>
      </div>

      {/* Grid de productos */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-4 border-gray-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-16 text-center">
          <ShoppingBag size={40} className="mx-auto text-gray-300 mb-4" />
          <p className="font-medium text-gray-700">Sin productos todavía</p>
          <p className="text-sm text-gray-400 mt-1">Agrega tu primer producto al catálogo</p>
          {canEdit && (
            <button onClick={openCreate} className="mt-4 inline-flex items-center gap-2 bg-gray-900 text-white px-4 py-2 rounded-lg text-sm">
              <Plus size={16} /> Agregar producto
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {items.map(item => (
            <div key={item.id} className={`bg-white border rounded-xl overflow-hidden transition-all hover:shadow-md ${item.available ? 'border-gray-200' : 'border-gray-100 opacity-60'}`}>
              {/* Foto */}
              <div className="aspect-square bg-gray-50 relative">
                {item.photos.length > 0 ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.photos[0]} alt={item.title} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <ShoppingBag size={32} className="text-gray-300" />
                  </div>
                )}
                {!item.available && (
                  <div className="absolute inset-0 bg-white/60 flex items-center justify-center">
                    <span className="bg-gray-800 text-white text-xs px-2 py-1 rounded-full font-medium">No disponible</span>
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
                <p className="font-semibold text-gray-900 truncate">{item.title}</p>
                {item.description && (
                  <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{item.description}</p>
                )}
                {item.price != null && (
                  <p className="text-base font-bold text-gray-900 mt-2">
                    ${item.price.toLocaleString('es')}
                  </p>
                )}

                {/* Acciones */}
                {canEdit && (
                  <div className="flex items-center gap-1 mt-3 pt-3 border-t border-gray-100">
                    <button
                      onClick={() => toggleAvailable(item)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs text-gray-500 hover:bg-gray-50 rounded-lg transition-colors"
                    >
                      {item.available ? <EyeOff size={13} /> : <Eye size={13} />}
                      {item.available ? 'Ocultar' : 'Mostrar'}
                    </button>
                    <button
                      onClick={() => openEdit(item)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
                    >
                      <Pencil size={13} /> Editar
                    </button>
                    <button
                      onClick={() => handleDelete(item)}
                      className="flex items-center justify-center p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
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
      <Modal open={showForm} onClose={() => setShowForm(false)} title={editing ? 'Editar producto' : 'Nuevo producto'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Fotos */}
          <div>
            <label className={labelClass}>Fotos del producto *</label>
            <PhotoUploader
              orgId={profile?.orgId || ''}
              folder="catalog"
              existingPhotos={form.photos}
              onPhotosChange={urls => setForm(f => ({ ...f, photos: urls }))}
              maxPhotos={8}
            />
          </div>

          {/* Nombre */}
          <div>
            <label className={labelClass}>Nombre *</label>
            <input
              className={inputClass}
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder="Ej: Camiseta negra talla M"
              required
            />
          </div>

          {/* Descripción */}
          <div>
            <label className={labelClass}>Descripción</label>
            <textarea
              className={inputClass + ' resize-none'}
              rows={3}
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Detalles del producto..."
            />
          </div>

          {/* Precio */}
          <div>
            <label className={labelClass}>Precio</label>
            <input
              type="number"
              min="0"
              step="0.01"
              className={inputClass}
              value={form.price}
              onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
              placeholder="0.00"
            />
          </div>

          {/* Disponible */}
          <label className="flex items-center gap-3 cursor-pointer">
            <div
              onClick={() => setForm(f => ({ ...f, available: !f.available }))}
              className={`w-10 h-6 rounded-full transition-colors flex items-center px-1 ${form.available ? 'bg-gray-900' : 'bg-gray-300'}`}
            >
              <div className={`w-4 h-4 bg-white rounded-full shadow transition-transform ${form.available ? 'translate-x-4' : 'translate-x-0'}`} />
            </div>
            <span className="text-sm text-gray-700">Disponible para la venta</span>
          </label>

          <div className="flex gap-2 pt-2">
            <button type="button" onClick={() => setShowForm(false)}
              className="flex-1 py-2.5 border border-gray-200 text-gray-600 rounded-lg text-sm hover:bg-gray-50 transition-colors">
              Cancelar
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 py-2.5 bg-gray-900 hover:bg-gray-800 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors">
              {saving ? 'Guardando...' : editing ? 'Actualizar' : 'Crear producto'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
