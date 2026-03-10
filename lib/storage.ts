import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage'
import { storage } from './firebase'

export async function uploadPhoto(
  orgId: string,
  folder: string,
  file: File,
  onProgress?: (progress: number) => void
): Promise<string> {
  const fileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`
  const storageRef = ref(storage, `organizations/${orgId}/${folder}/${fileName}`)

  return new Promise((resolve, reject) => {
    const uploadTask = uploadBytesResumable(storageRef, file)

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
  const urls: string[] = []
  for (let i = 0; i < files.length; i++) {
    const url = await uploadPhoto(orgId, folder, files[i], (p) => {
      const overall = ((i + p / 100) / files.length) * 100
      onProgress?.(overall)
    })
    urls.push(url)
  }
  return urls
}

export async function deletePhoto(url: string) {
  try {
    const storageRef = ref(storage, url)
    await deleteObject(storageRef)
  } catch {
    // Ignorar si ya no existe
  }
}
