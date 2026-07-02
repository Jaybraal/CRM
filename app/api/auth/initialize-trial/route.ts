import { NextRequest, NextResponse } from 'next/server'
import { getAdminDb } from '@/lib/firebase-admin'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { uid, email } = body

    // Verify uid and email are provided
    if (!uid || !email) {
      return NextResponse.json(
        {
          ok: false,
          error: 'uid and email are required',
        },
        { status: 400 }
      )
    }

    const db = getAdminDb()

    // Check if subscription already exists
    const existingSubscription = await db.collection('subscriptions').doc(uid).get()
    if (existingSubscription.exists) {
      return NextResponse.json(
        {
          ok: true,
          message: 'Trial subscription already exists',
          trialEndsAt: existingSubscription.data()?.trialEndsAt,
        },
        { status: 200 }
      )
    }

    // Calculate trial end (30 minutes from now)
    const now = Math.floor(Date.now() / 1000)
    const trialEndsAt = now + 1800

    // Create trial subscription in Firestore
    await db.collection('subscriptions').doc(uid).set({
      uid,
      email,
      status: 'trial',
      customerId: '',
      trialStartedAt: now,
      trialEndsAt,
      createdAt: new Date().toISOString(),
    })

    return NextResponse.json(
      {
        ok: true,
        trialEndsAt,
        message: 'Trial subscription created',
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Error initializing trial:', error)
    return NextResponse.json(
      {
        ok: false,
        error: 'Failed to initialize trial subscription',
      },
      { status: 500 }
    )
  }
}
