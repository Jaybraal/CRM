import { NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'
import { Timestamp } from 'firebase-admin/firestore'

// Vercel Crons llaman con GET y header Authorization: Bearer <CRON_SECRET>
export async function GET(req: Request) {
  const auth = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const cutoff = Timestamp.fromDate(new Date(Date.now() - 14 * 24 * 60 * 60 * 1000))
  let totalDeleted = 0

  try {
    const orgsSnap = await adminDb.collection('organizations').get()

    for (const orgDoc of orgsSnap.docs) {
      const orgId = orgDoc.id

      // Encontrar la categoría ELIMINADOS de esta org
      const catsSnap = await adminDb
        .collection(`organizations/${orgId}/categories`)
        .where('systemKey', '==', 'eliminados')
        .get()

      if (catsSnap.empty) continue

      const eliminadosCatId = catsSnap.docs[0].id

      // Buscar clientes en ELIMINADOS con más de 14 días
      const clientsSnap = await adminDb
        .collection(`organizations/${orgId}/clients`)
        .where('categoryId', '==', eliminadosCatId)
        .where('movedToCategoryAt', '<=', cutoff)
        .get()

      const batch = adminDb.batch()
      for (const clientDoc of clientsSnap.docs) {
        // Borrar mensajes del cliente
        const msgsSnap = await adminDb
          .collection(`organizations/${orgId}/clients/${clientDoc.id}/messages`)
          .get()
        msgsSnap.docs.forEach(m => batch.delete(m.ref))
        batch.delete(clientDoc.ref)
        totalDeleted++
      }

      if (!clientsSnap.empty) await batch.commit()
    }

    return NextResponse.json({ deleted: totalDeleted })
  } catch (err) {
    console.error('[cleanup] Error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
