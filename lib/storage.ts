import { ref, deleteObject } from 'firebase/storage'
import { storage } from './firebase'

// Todos los uploads van por el servidor (/api/upload) para evitar CORS en Firebase Storage.
// El Admin SDK no tiene restricciones de CORS.
async function uploadViaServer(
  orgId: string,
  folder: string,
  file: File | Blob,
  mimeType?: string,
  onProgress?: (progress: number) => void
): Promise<string> {
  const type = mimeType || (file instanceof File ? file.type : 'application/octet-stream') || 'application/octet-stream'

  // Retry hasta 3 veces con backoff — resuelve fallos intermitentes de red
  let lastError: Error = new Error('Upload failed')
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const formData = new FormData()
      // En Safari, usar el archivo directamente en lugar de new File()
      if (file instanceof File) {
        formData.append('file', file)
      } else {
        formData.append('file', new File([file], 'upload', { type }))
      }
      formData.append('orgId', orgId)
      formData.append('folder', folder)

      const res = await fetch('/api/upload', { method: 'POST', body: formData })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Upload failed' }))
        throw new Error(err.error || 'Error al subir archivo')
      }
      onProgress?.(100)
      const { url } = await res.json()
      return url
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e))
      if (attempt < 2) await new Promise(r => setTimeout(r, 1000 * (attempt + 1)))
    }
  }
  throw lastError
}

export async function uploadPhoto(
  orgId: string,
  folder: string,
  file: File,
  onProgress?: (progress: number) => void
): Promise<string> {
  return uploadViaServer(orgId, folder, file, file.type, onProgress)
}

export async function uploadBlob(
  orgId: string,
  folder: string,
  blob: Blob,
  mimeType: string,
  onProgress?: (progress: number) => void
): Promise<string> {
  return uploadViaServer(orgId, folder, blob, mimeType, onProgress)
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
