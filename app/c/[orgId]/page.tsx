'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { getCatalog } from '@/lib/firestore'
import type { CatalogItem } from '@/types'
import { ShoppingBag, MessageCircle, ChevronLeft, ChevronRight, X } from 'lucide-react'

export default function PublicCatalogPage() {
  const params = useParams()
  const orgId = params.orgId as string

  const [items, setItems] = useState<CatalogItem[]>([])
  const [orgName, setOrgName] = useState<string | null>(null)
  const [whatsappNumber, setWhatsappNumber] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<CatalogItem | null>(null)
  const [photoIdx, setPhotoIdx] = useState(0)

  useEffect(() => {
    if (!orgId) return
    Promise.all([
      getCatalog(orgId),
      fetch(`/api/public/org/${orgId}`).then(r => r.json()).catch(() => ({ name: null })),
    ])
      .then(([catalog, orgData]) => {
        setItems(catalog.filter(i => i.available))
        setOrgName(orgData.name)
        setWhatsappNumber(orgData.whatsappNumber || null)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [orgId])

  const openItem = (item: CatalogItem) => {
    setSelected(item)
    setPhotoIdx(0)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-8 h-8 border-4 border-gray-400 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">{orgName || 'Catálogo'}</h1>
            <p className="text-xs text-gray-500 mt-0.5">{items.length} producto{items.length !== 1 ? 's' : ''} disponibles</p>
          </div>
          <ShoppingBag size={24} className="text-gray-400" />
        </div>
      </div>

      {/* Productos */}
      <div className="max-w-4xl mx-auto px-4 py-6">
        {items.length === 0 ? (
          <div className="text-center py-24">
            <ShoppingBag size={48} className="mx-auto text-gray-300 mb-4" />
            <p className="text-gray-500 font-medium">No hay productos disponibles</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {items.map(item => (
              <button
                key={item.id}
                onClick={() => openItem(item)}
                className="bg-white border border-gray-200 rounded-xl overflow-hidden text-left hover:shadow-md hover:border-gray-300 transition-all active:scale-95"
              >
                <div className="aspect-square bg-gray-50">
                  {item.photos.length > 0 ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.photos[0]} alt={item.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <ShoppingBag size={28} className="text-gray-300" />
                    </div>
                  )}
                </div>
                <div className="p-2.5">
                  <p className="text-sm font-semibold text-gray-900 truncate">{item.title}</p>
                  {item.price != null && (
                    <p className="text-sm font-bold text-gray-900 mt-1">${item.price.toLocaleString('es')}</p>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Modal detalle de producto */}
      {selected && (
        <div
          className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => setSelected(null)}
        >
          <div
            className="bg-white w-full sm:max-w-lg sm:rounded-2xl overflow-hidden max-h-[95vh] flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            {/* Carrusel de fotos */}
            <div className="relative bg-gray-100 aspect-square">
              {selected.photos.length > 0 ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={selected.photos[photoIdx]} alt={selected.title} className="w-full h-full object-contain" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <ShoppingBag size={48} className="text-gray-300" />
                </div>
              )}

              {/* Navegación fotos */}
              {selected.photos.length > 1 && (
                <>
                  <button
                    onClick={() => setPhotoIdx(i => (i - 1 + selected.photos.length) % selected.photos.length)}
                    className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-white/80 rounded-full flex items-center justify-center shadow"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <button
                    onClick={() => setPhotoIdx(i => (i + 1) % selected.photos.length)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-white/80 rounded-full flex items-center justify-center shadow"
                  >
                    <ChevronRight size={16} />
                  </button>
                  <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
                    {selected.photos.map((_, i) => (
                      <button
                        key={i}
                        onClick={() => setPhotoIdx(i)}
                        className={`w-1.5 h-1.5 rounded-full transition-colors ${i === photoIdx ? 'bg-white' : 'bg-white/50'}`}
                      />
                    ))}
                  </div>
                </>
              )}

              {/* Cerrar */}
              <button
                onClick={() => setSelected(null)}
                className="absolute top-3 right-3 w-8 h-8 bg-white/80 rounded-full flex items-center justify-center shadow"
              >
                <X size={16} />
              </button>
            </div>

            {/* Info */}
            <div className="p-4 overflow-y-auto flex-1">
              <h2 className="text-lg font-bold text-gray-900">{selected.title}</h2>
              {selected.price != null && (
                <p className="text-2xl font-bold text-gray-900 mt-1">${selected.price.toLocaleString('es')}</p>
              )}
              {selected.description && (
                <p className="text-sm text-gray-600 mt-3 leading-relaxed">{selected.description}</p>
              )}
              {Object.keys(selected.specs || {}).length > 0 && (
                <div className="mt-4 space-y-1.5">
                  {Object.entries(selected.specs).map(([k, v]) => (
                    <div key={k} className="flex justify-between text-sm">
                      <span className="text-gray-500">{k}</span>
                      <span className="text-gray-900 font-medium">{v}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* CTA WhatsApp */}
            <div className="p-4 border-t border-gray-100">
              <a
                href={`https://wa.me/${whatsappNumber || ''}?text=${encodeURIComponent(`Hola, me interesa: *${selected.title}*${selected.price != null ? ` ($${selected.price.toLocaleString('es')})` : ''}`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full bg-[#25D366] hover:bg-[#22c55e] text-white py-3 rounded-xl font-semibold text-sm transition-colors"
              >
                <MessageCircle size={18} /> Consultar por WhatsApp
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
