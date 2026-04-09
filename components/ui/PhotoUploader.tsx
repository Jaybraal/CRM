'use client'

import { useState, useRef } from 'react'
import { Plus, X } from 'lucide-react'
import { uploadMultiplePhotos } from '@/lib/storage'
import toast from 'react-hot-toast'

interface PhotoUploaderProps {
  orgId: string
  folder: string
  existingPhotos?: string[]
  onPhotosChange: (urls: string[]) => void
  maxPhotos?: number
}

export default function PhotoUploader({
  orgId, folder, existingPhotos = [], onPhotosChange, maxPhotos = 10
}: PhotoUploaderProps) {
  const [photos, setPhotos] = useState<string[]>(existingPhotos)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    const fileArr = Array.from(files).slice(0, maxPhotos - photos.length)
    if (fileArr.length === 0) return
    setUploading(true)
    setProgress(0)
    try {
      const urls = await uploadMultiplePhotos(orgId, folder, fileArr, setProgress)
      const updated = [...photos, ...urls]
      setPhotos(updated)
      onPhotosChange(updated)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error desconocido'
      toast.error(`Error al subir foto: ${msg}`)
    } finally {
      setUploading(false)
      setProgress(0)
    }
  }

  const removePhoto = (idx: number) => {
    const updated = photos.filter((_, i) => i !== idx)
    setPhotos(updated)
    onPhotosChange(updated)
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {/* Thumbnails existentes */}
        {photos.map((url, i) => (
          <div key={url} className="relative group w-16 h-16 shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt="" className="w-full h-full object-cover rounded-lg border border-gray-200" />
            <button
              type="button"
              onClick={() => removePhoto(i)}
              className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow"
            >
              <X size={10} className="text-white" />
            </button>
          </div>
        ))}

        {/* Botón agregar */}
        {photos.length < maxPhotos && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            onDragOver={e => e.preventDefault()}
            onDrop={e => { e.preventDefault(); handleFiles(e.dataTransfer.files) }}
            disabled={uploading}
            className="w-16 h-16 shrink-0 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center gap-0.5 hover:border-gray-400 hover:bg-gray-50 transition-all disabled:opacity-60 cursor-pointer"
          >
            {uploading ? (
              <div className="flex flex-col items-center gap-0.5">
                <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                <span className="text-[9px] text-gray-400">{Math.round(progress)}%</span>
              </div>
            ) : (
              <>
                <Plus size={18} className="text-gray-400" />
                <span className="text-[9px] text-gray-400">{photos.length}/{maxPhotos}</span>
              </>
            )}
          </button>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        multiple
        accept="image/*"
        className="hidden"
        onChange={e => handleFiles(e.target.files)}
      />
    </div>
  )
}
