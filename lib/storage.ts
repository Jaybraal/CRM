import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage'
import { storage } from './firebase'

// Comprime imagen via canvas con timeout de seguridad
function compressImage(file: File): Promise<Blob> {
  return new Promise((resolve) => {
    // No comprimir si no es imagen o es gif
    if (!file.type.startsWith('image/') || file.type === 'image/gif') {
      resolve(file)
      return
    }
    // Si pesa menos de 500KB, no comprimir
    if (file.size < 500 * 1024) {
      resolve(file)
      return
    }

    // Timeout de 8s: si canvas no responde, usar archivo original
    const timeout = setTimeout(() => resolve(file), 8000)

    const img = new Image()
    const url = URL.createObjectURL(file)

    img.onerror = () => {
      clearTimeout(timeout)
      URL.revokeObjectURL(url)
      resolve(file)
    }

    img.onload = () => {
      clearTimeout(timeout)
      URL.revokeObjectURL(url)
      try {
        const MAX = 1280
        let { width, height } = img
        if (width > MAX || height > MAX) {
          if (width > height) { height = Math.round(height * MAX / width); width = MAX }
          else { width = Math.round(width * MAX / height); height = MAX }
        }
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        if (!ctx) { resolve(file); return }
        ctx.drawImage(img, 0, 0, width, height)
        canvas.toBlob(
          (blob) => resolve(blob && blob.size > 0 ? blob : file),
          'image/jpeg',
          0.80
        )
      } catch {
        resolve(file)
      }
    }

    img.src = url
  })
}

export async function uploadPhoto(
  orgId: string,
  folder: string,
  file: File,
  onProgress?: (progress: number) => void
): Promise<string> {
  let blob: Blob = file
  try {
    blob = await compressImage(file)
  } catch {
    blob = file
  }

  const ext = file.type === 'image/png' ? 'png' : 'jpg'
  const fileName = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
  const storageRef = ref(storage, `organizations/${orgId}/${folder}/${fileName}`)

  return new Promise((resolve, reject) => {
    // Timeout de 60s para el upload completo
    const uploadTimeout = setTimeout(() => {
      reject(new Error('Tiempo de espera agotado al subir la foto. Verifica tu conexión.'))
    }, 60000)

    const uploadTask = uploadBytesResumable(storageRef, blob)

    uploadTask.on(
      'state_changed',
      (snapshot) => {
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100
        onProgress?.(progress)
      },
      (error) => {
        clearTimeout(uploadTimeout)
        console.error('Storage upload error:', error.code, error.message)
        if (error.code === 'storage/unauthorized') {
          reject(new Error('Sin permiso para subir fotos. Revisa las reglas de Firebase Storage.'))
        } else {
          reject(error)
        }
      },
      async () => {
        clearTimeout(uploadTimeout)
        try {
          const url = await getDownloadURL(uploadTask.snapshot.ref)
          resolve(url)
        } catch (e) {
          reject(e)
        }
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
