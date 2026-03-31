export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getAdminStorage } from '@/lib/firebase-admin'

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const orgId = formData.get('orgId') as string
    const folder = formData.get('folder') as string

    if (!file || !orgId || !folder) {
      return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const extMap: Record<string, string> = {
      'image/png': 'png', 'image/gif': 'gif', 'image/webp': 'webp',
      'image/heic': 'heic', 'image/heif': 'heif', 'image/jpeg': 'jpg',
      'video/mp4': 'mp4', 'video/quicktime': 'mov', 'video/webm': 'webm',
      'video/ogg': 'ogg', 'video/mpeg': 'mp4', 'video/x-msvideo': 'avi',
      'video/3gpp': '3gp', 'video/3gpp2': '3g2',
    }
    const ext = extMap[file.type] ?? (file.type.startsWith('video/') ? 'mp4' : 'jpg')
    const fileName = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
    const path = `organizations/${orgId}/${folder}/${fileName}`

    const downloadToken = crypto.randomUUID()
    const bucket = getAdminStorage()

    await bucket.file(path).save(buffer, {
      metadata: {
        contentType: file.type,
        metadata: { firebaseStorageDownloadTokens: downloadToken },
      },
    })

    const bucketName = bucket.name
    const url = `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(path)}?alt=media&token=${downloadToken}`

    return NextResponse.json({ url })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('Upload error:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
