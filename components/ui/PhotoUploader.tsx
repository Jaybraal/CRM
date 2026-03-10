'use client'

import { useState, useRef } from 'react'
import { Upload, X, ImageIcon } from 'lucide-react'
import { uploadMultiplePhotos } from '@/lib/storage'

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
    <div className="space-y-3">
      {/* Grid de fotos */}
      {photos.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {photos.map((url, i) => (
            <div key={url} className="relative group aspect-square">
              <img src={url} alt="" className="w-full h-full object-cover rounded-lg border border-gray-200" />
              <button
                onClick={() => removePhoto(i)}
                className="absolute top-1 right-1 p-1 bg-red-600 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Botón upload */}
      {photos.length < maxPhotos && (
        <div
          onClick={() => inputRef.current?.click()}
          onDragOver={e => e.preventDefault()}
          onDrop={e => { e.preventDefault(); handleFiles(e.dataTransfer.files) }}
          className="border-2 border-dashed border-gray-300 rounded-lg p-6 flex flex-col items-center gap-2 cursor-pointer hover:border-gray-400 hover:bg-gray-50 transition-all"
        >
          {uploading ? (
            <>
              <div className="w-8 h-8 border-4 border-gray-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-sm text-gray-400">{Math.round(progress)}%</span>
            </>
          ) : (
            <>
              <Upload size={24} className="text-gray-400" />
              <span className="text-sm text-gray-500">
                Arrastra fotos o <span className="text-gray-500">haz clic</span>
              </span>
              <span className="text-xs text-gray-400">
                {photos.length}/{maxPhotos} fotos · JPG, PNG, WEBP
              </span>
            </>
          )}
        </div>
      )}

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
