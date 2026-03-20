export const dynamic = 'force-dynamic'

import { adminDb } from '@/lib/firebase-admin'
import { NextResponse } from 'next/server'

export async function GET() {
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
