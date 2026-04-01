import { ref, deleteObject } from 'firebase/storage'
import { storage } from './firebase'

export async function uploadPhoto(
  orgId: string,
  folder: string,
  file: File,
  onProgress?: (progress: number) => void
): Promise<string> {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('orgId', orgId)
  formData.append('folder', folder)

  // Use server-side upload to avoid CORS issues with Firebase Storage
  const res = await fetch('/api/upload', { method: 'POST', body: formData })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Upload failed' }))
    throw new Error(err.error || 'Error al subir archivo')
  }

  onProgress?.(100)
  const { url } = await res.json()
  return url
}

export async function uploadMultiplePhotos(
  orgId: string,
  folder: string,
  files: File[],
  onProgress?: (progress: number) => void
): Promise<string[]> {
  const results: string[] = []
  for (let i = 0; i < files.length; i++) {
    const url = await uploadPhoto(orgId, folder, files[i])
    results.push(url)
    onProgress?.(((i + 1) / files.length) * 100)
  }
  return results
}

export async function deletePhoto(url: string) {
  try {
    const storageRef = ref(storage, url)
    await deleteObject(storageRef)
  } catch {
    // Ignorar si ya no existe
  }
}
