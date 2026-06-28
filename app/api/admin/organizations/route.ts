export const dynamic = 'force-dynamic'

import { adminDb } from '@/lib/firebase-admin'
import { NextRequest, NextResponse } from 'next/server'

const SUPER_ADMIN_UID = process.env.NEXT_PUBLIC_SUPER_ADMIN_UID

async function requireSuperAdmin(req: NextRequest): Promise<boolean> {
  const uid = req.headers.get('x-user-uid')
  if (!uid) return false
  if (uid === SUPER_ADMIN_UID) return true
  const snap = await adminDb.doc(`users/${uid}`).get()
  return snap.data()?.role === 'super_admin'
}

const NEXO_DEFAULT_CHANNELS = [
  { name: 'general', emoji: '#', description: 'Canal general del equipo' },
  { name: 'ventas',  emoji: '#', description: 'Novedades del área de ventas' },
  { name: 'soporte', emoji: '#', description: 'Soporte interno y operaciones' },
]

async function seedNexoChannels(orgId: string) {
  const now = new Date()
  const batch = adminDb.batch()
  for (const ch of NEXO_DEFAULT_CHANNELS) {
    const ref = adminDb
      .collection('organizations').doc(orgId)
      .collection('nexo_connect').doc()
    batch.set(ref, {
      name: ch.name,
      type: 'group',
      members: [],
      createdBy: 'system',
      lastMessage: ch.description,
      createdAt: now,
      updatedAt: now,
    })
  }
  await batch.commit()
}

export async function POST(req: NextRequest) {
  if (!(await requireSuperAdmin(req))) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }
  try {
    const { name, ownerId, plan, settings, accessExpiresAt } = await req.json()
    const ref = await adminDb.collection('organizations').add({
      name,
      ownerId: ownerId ?? '',
      plan: plan ?? 'trial',
      settings: settings ?? {},
      createdAt: new Date(),
      ...(accessExpiresAt ? { accessExpiresAt: new Date(accessExpiresAt) } : {}),
    })

    // Sembrar canales Nexo Connect por defecto (no bloquea si falla)
    seedNexoChannels(ref.id).catch(e =>
      console.warn('[org/create] seedNexoChannels failed:', e)
    )

    return NextResponse.json({ id: ref.id })
  } catch (err) {
    console.error('Error creating org:', err)
    return NextResponse.json({ error: 'Error al crear organización' }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  if (!(await requireSuperAdmin(req))) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }
  try {
    const snap = await adminDb.collection('organizations').get()
    const orgs = snap.docs.map(d => ({ id: d.id, ...d.data() }))

    // Load stats in parallel
    const withStats = await Promise.all(
      orgs.map(async (org) => {
        try {
          const [usersSnap, clientsSnap, dealsSnap, tasksSnap] = await Promise.all([
            adminDb.collection('users').where('orgId', '==', org.id).count().get(),
            adminDb.collection('organizations').doc(org.id).collection('clients').count().get(),
            adminDb.collection('organizations').doc(org.id).collection('deals').count().get(),
            adminDb.collection('organizations').doc(org.id).collection('tasks').count().get(),
          ])
          return {
            ...org,
            stats: {
              users: usersSnap.data().count,
              clients: clientsSnap.data().count,
              deals: dealsSnap.data().count,
              tasks: tasksSnap.data().count,
            },
          }
        } catch {
          return { ...org, stats: { users: 0, clients: 0, deals: 0, tasks: 0 } }
        }
      })
    )

    return NextResponse.json(withStats)
  } catch (err) {
    console.error('Error fetching organizations:', err)
    return NextResponse.json({ error: 'Error al cargar organizaciones' }, { status: 500 })
  }
}
