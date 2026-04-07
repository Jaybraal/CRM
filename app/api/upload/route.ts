export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import { getAdminStorage } from '@/lib/firebase-admin'

// Normaliza el MIME type (quita parámetros como ;codecs=opus)
function getBaseMime(type: string): string {
  return type.split(';')[0].trim().toLowerCase()
}

function getExtension(mimeType: string): string {
  const base = getBaseMime(mimeType)
  const extMap: Record<string, string> = {
    'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/png': 'png',
    'image/gif': 'gif', 'image/webp': 'webp', 'image/heic': 'heic', 'image/heif': 'heif',
    'video/mp4': 'mp4', 'video/quicktime': 'mov', 'video/webm': 'webm',
    'video/ogg': 'ogg', 'video/mpeg': 'mp4', 'video/x-msvideo': 'avi',
    'video/3gpp': '3gp', 'video/3gpp2': '3g2',
    'audio/webm': 'webm', 'audio/ogg': 'ogg', 'audio/mpeg': 'mp3',
    'audio/mp4': 'm4a', 'audio/mp3': 'mp3', 'audio/aac': 'aac',
    'audio/wav': 'wav', 'audio/opus': 'opus', 'audio/x-m4a': 'm4a',
    'application/octet-stream': 'bin',
  }
  if (extMap[base]) return extMap[base]
  if (base.startsWith('audio/')) return 'audio'
  if (base.startsWith('video/')) return 'mp4'
  if (base.startsWith('image/')) return 'jpg'
  return 'bin'
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const orgId = formData.get('orgId') as string
    const folder = formData.get('folder') as string

    if (!file || !orgId || !folder) {
      return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 })
    }

    if (file.size === 0) {
      return NextResponse.json({ error: 'El archivo está vacío' }, { status: 400 })
    }

    const contentType = file.type || 'application/octet-stream'
    const ext = getExtension(contentType)
    const fileName = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
    const path = `organizations/${orgId}/${folder}/${fileName}`

    const buffer = Buffer.from(await file.arrayBuffer())
    const downloadToken = crypto.randomUUID()
    const bucket = getAdminStorage()

    await bucket.file(path).save(buffer, {
      metadata: {
        contentType: getBaseMime(contentType),
        metadata: { firebaseStorageDownloadTokens: downloadToken },
      },
    })

    const bucketName = bucket.name
    const url = `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(path)}?alt=media&token=${downloadToken}`

    return NextResponse.json({ url })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[api/upload v2] error:', msg)
    return NextResponse.json({ error: `[SERVER] ${msg}` }, { status: 500 })
  }
}
