export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import { GoogleAuth } from 'google-auth-library'

// Autenticación con service account — funciona sin permisos IAM especiales
function getGoogleAuth() {
  const privateKey = (process.env.FIREBASE_ADMIN_PRIVATE_KEY ?? '').replace(/\\n/g, '\n')
  return new GoogleAuth({
    credentials: {
      client_email: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
      private_key: privateKey,
    },
    scopes: ['https://www.googleapis.com/auth/devstorage.full_control'],
  })
}

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

    const contentType = getBaseMime(file.type || 'application/octet-stream')
    const ext = getExtension(contentType)
    const fileName = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
    const filePath = `organizations/${orgId}/${folder}/${fileName}`
    const bucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!
    const downloadToken = crypto.randomUUID()

    // Obtener token OAuth2 del service account
    const auth = getGoogleAuth()
    const client = await auth.getClient()
    const tokenRes = await client.getAccessToken()
    const accessToken = tokenRes.token

    // Subir via Firebase Storage REST API (multipart)
    const buffer = Buffer.from(await file.arrayBuffer())
    const boundary = `boundary_${crypto.randomUUID().replace(/-/g, '')}`
    const metaJson = JSON.stringify({
      name: filePath,
      contentType,
      metadata: { firebaseStorageDownloadTokens: downloadToken },
    })

    const body = Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metaJson}\r\n--${boundary}\r\nContent-Type: ${contentType}\r\n\r\n`),
      buffer,
      Buffer.from(`\r\n--${boundary}--`),
    ])

    const uploadRes = await fetch(
      `https://storage.googleapis.com/upload/storage/v1/b/${encodeURIComponent(bucket)}/o?uploadType=multipart&name=${encodeURIComponent(filePath)}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': `multipart/related; boundary=${boundary}`,
          'Content-Length': String(body.length),
        },
        body,
      }
    )

    if (!uploadRes.ok) {
      const errText = await uploadRes.text()
      throw new Error(`GCS upload failed: ${uploadRes.status} — ${errText}`)
    }

    // Parchear metadata para agregar el download token
    await fetch(
      `https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(bucket)}/o/${encodeURIComponent(filePath)}`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ metadata: { firebaseStorageDownloadTokens: downloadToken } }),
      }
    )

    const url = `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodeURIComponent(filePath)}?alt=media&token=${downloadToken}`
    return NextResponse.json({ url })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[api/upload] error:', msg)
    return NextResponse.json({ error: `[UPLOAD] ${msg}` }, { status: 500 })
  }
}
