import { ref, deleteObject, uploadBytesResumable, getDownloadURL } from 'firebase/storage'
import { storage } from './firebase'

async function uploadDirect(
  orgId: string,
  folder: string,
  file: File,
  onProgress?: (progress: number) => void
): Promise<string> {
  const ext = file.name.split('.').pop() || 'bin'
  const fileName = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
  const path = `organizations/${orgId}/${folder}/${fileName}`
  const storageRef = ref(storage, path)

  return new Promise((resolve, reject) => {
    const task = uploadBytesResumable(storageRef, file, { contentType: file.type })
    task.on(
      'state_changed',
      (snap) => onProgress?.(Math.round((snap.bytesTransferred / snap.totalBytes) * 100)),
      reject,
      async () => {
        try {
          const url = await getDownloadURL(task.snapshot.ref)
          resolve(url)
        } catch (e) {
          reject(e)
        }
      }
    )
  })
}

export async function uploadPhoto(
  orgId: string,
  folder: string,
  file: File,
  onProgress?: (progress: number) => void
): Promise<string> {
  // Videos y audios se suben directamente desde el cliente (sin límite de tamaño del servidor)
  if (file.type.startsWith('video/') || file.type.startsWith('audio/')) {
    return uploadDirect(orgId, folder, file, onProgress)
  }

  // Imágenes van por servidor para evitar problemas de CORS en algunos entornos
  const formData = new FormData()
  formData.append('file', file)
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
