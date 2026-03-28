import { ref, deleteObject } from 'firebase/storage'
import { storage } from './firebase'

export async function uploadPhoto(
  orgId: string,
  folder: string,
  file: File,
  onProgress?: (progress: number) => void
): Promise<string> {
  onProgress?.(10)

  const formData = new FormData()
  formData.append('file', file)
  formData.append('orgId', orgId)
  formData.append('folder', folder)

  onProgress?.(30)

  const res = await fetch('/api/upload', {
    method: 'POST',
    body: formData,
  })

  onProgress?.(90)

  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error || `Error al subir foto (${res.status})`)
  }

  const { url } = await res.json()
  onProgress?.(100)
  return url
}

export async function uploadMultiplePhotos(
  orgId: string,
  folder: string,
  files: File[],
  onProgress?: (progress: number) => void
): Promise<string[]> {
  const progresses = new Array(files.length).fill(0)
  return Promise.all(
    files.map((file, i) =>
      uploadPhoto(orgId, folder, file, (p) => {
        progresses[i] = p
        const overall = progresses.reduce((a, b) => a + b, 0) / files.length
        onProgress?.(overall)
      })
    )
  )
}

export async function deletePhoto(url: string) {
  try {
    const storageRef = ref(storage, url)
    await deleteObject(storageRef)
  } catch {
    // Ignorar si ya no existe
  }
}
