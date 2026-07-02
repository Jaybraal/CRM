import { NextRequest, NextResponse } from 'next/server';
import * as admin from 'firebase-admin';

if (!admin.apps.length) {
  admin.initializeApp();
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ uid: string }> }
) {
  try {
    const { uid } = await params;

    const db = admin.firestore();
    const doc = await db.collection('subscriptions').doc(uid).get();

    if (!doc.exists) {
      return NextResponse.json(
        { error: 'Subscription not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(doc.data());
  } catch (err) {
    console.error('[api/subscription]', err);
    return NextResponse.json(
      { error: 'Failed to fetch subscription' },
      { status: 500 }
    );
  }
}
