import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage'
import { storage } from './firebase'

// Comprime imagen a máx 1200px y calidad 0.82 antes de subir
function compressImage(file: File): Promise<Blob> {
  return new Promise((resolve) => {
    if (!file.type.startsWith('image/') || file.type === 'image/gif') {
      resolve(file)
      return
    }
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const MAX = 1200
      let { width, height } = img
      if (width > MAX || height > MAX) {
        if (width > height) { height = Math.round(height * MAX / width); width = MAX }
        else { width = Math.round(width * MAX / height); height = MAX }
      }
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      canvas.getContext('2d')!.drawImage(img, 0, 0, width, height)
      canvas.toBlob(blob => resolve(blob || file), 'image/jpeg', 0.82)
    }
    img.onerror = () => resolve(file)
    img.src = url
  })
}

export async function uploadPhoto(
  orgId: string,
  folder: string,
  file: File,
  onProgress?: (progress: number) => void
): Promise<string> {
  const compressed = await compressImage(file)
  const fileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}.jpg`
  const storageRef = ref(storage, `organizations/${orgId}/${folder}/${fileName}`)

  return new Promise((resolve, reject) => {
    const uploadTask = uploadBytesResumable(storageRef, compressed)

    uploadTask.on(
      'state_changed',
      (snapshot) => {
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100
        onProgress?.(progress)
      },
      reject,
      async () => {
        const url = await getDownloadURL(uploadTask.snapshot.ref)
        resolve(url)
      }
    )
  })
}

export async function uploadMultiplePhotos(
  orgId: string,
  folder: string,
  files: File[],
  onProgress?: (progress: number) => void
): Promise<string[]> {
  // Subir todas las fotos en paralelo
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
