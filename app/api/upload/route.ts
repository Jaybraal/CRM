export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

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
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    )

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
    const path = `organizations/${orgId}/${folder}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
    const buffer = Buffer.from(await file.arrayBuffer())

    const { error } = await supabase.storage
      .from('crm-files')
      .upload(path, buffer, { contentType, upsert: false })

    if (error) throw new Error(error.message)

    const { data } = supabase.storage.from('crm-files').getPublicUrl(path)
    return NextResponse.json({ url: data.publicUrl })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[api/upload] error:', msg)
    return NextResponse.json({ error: `[UPLOAD] ${msg}` }, { status: 500 })
  }
}
