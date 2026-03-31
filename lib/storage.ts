import { ref, deleteObject, uploadBytesResumable, getDownloadURL } from 'firebase/storage'
import { storage } from './firebase'

const EXT_MAP: Record<string, string> = {
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif',
  'image/webp': 'webp', 'image/heic': 'heic', 'image/heif': 'heif',
  'video/mp4': 'mp4', 'video/quicktime': 'mov', 'video/webm': 'webm',
  'video/ogg': 'ogg', 'video/mpeg': 'mp4', 'video/x-msvideo': 'avi',
  'video/3gpp': '3gp', 'video/3gpp2': '3g2',
}

function getExt(mimeType: string): string {
  return EXT_MAP[mimeType] ?? (mimeType.startsWith('video/') ? 'mp4' : 'jpg')
}

export async function uploadPhoto(
  orgId: string,
  folder: string,
  file: File,
  onProgress?: (progress: number) => void
): Promise<string> {
  const ext = getExt(file.type)
  const fileName = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
  const path = `organizations/${orgId}/${folder}/${fileName}`
  const storageRef = ref(storage, path)

  return new Promise((resolve, reject) => {
    const task = uploadBytesResumable(storageRef, file, { contentType: file.type })

    task.on(
      'state_changed',
      (snapshot) => {
        const pct = (snapshot.bytesTransferred / snapshot.totalBytes) * 100
        onProgress?.(pct)
      },
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
