export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import { v2 as cloudinary } from 'cloudinary'

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

function getBaseMime(type: string): string {
  return type.split(';')[0].trim().toLowerCase()
}

function getResourceType(mime: string): 'image' | 'video' | 'raw' {
  if (mime.startsWith('image/')) return 'image'
  if (mime.startsWith('video/') || mime.startsWith('audio/')) return 'video'
  return 'raw'
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
    const resourceType = getResourceType(contentType)
    const buffer = Buffer.from(await file.arrayBuffer())

    const result = await new Promise<{ secure_url: string }>((resolve, reject) => {
      cloudinary.uploader.upload_stream(
        {
          folder: `organizations/${orgId}/${folder}`,
          resource_type: resourceType,
        },
        (error, result) => {
          if (error || !result) return reject(error ?? new Error('Upload failed'))
          resolve(result as { secure_url: string })
        }
      ).end(buffer)
    })

    return NextResponse.json({ url: result.secure_url })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[api/upload] error:', msg)
    return NextResponse.json({ error: `[UPLOAD] ${msg}` }, { status: 500 })
  }
}
