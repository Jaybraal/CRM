'use client'

import { useEffect, useRef } from 'react'
import { useAuth } from '@/context/AuthContext'
import { collection, query, where, onSnapshot, orderBy, limit, doc, setDoc } from 'firebase/firestore'
import { db, getFirebaseMessaging } from '@/lib/firebase'

export function useNotifications() {
  const { profile } = useAuth()
  const tokenRegisteredRef = useRef(false)

  useEffect(() => {
    // Register service worker
    if ('serviceWorker' in navigator) {
      // /api/sw serves the SW with Firebase config injected (env vars)
      navigator.serviceWorker.register('/api/sw', { scope: '/' }).catch(() => {})
    }

    // Request notification permission
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }
  }, [])

  // Register FCM token when we have a profile
  useEffect(() => {
    if (!profile?.uid || !profile?.orgId || tokenRegisteredRef.current) return
    const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY
    if (!vapidKey) return // FCM push requires VAPID key in env vars

    const registerToken = async () => {
      try {
        const permission = await Notification.requestPermission()
        if (permission !== 'granted') return

        const messaging = await getFirebaseMessaging()
        if (!messaging) return

        const { getToken } = await import('firebase/messaging')
        const swReg = await navigator.serviceWorker.getRegistration('/') || undefined
        const token = await getToken(messaging, { vapidKey, serviceWorkerRegistration: swReg })
        if (!token) return

        tokenRegisteredRef.current = true
        // Store token in Firestore under user doc so backend can send push
        await setDoc(
          doc(db, 'fcm_tokens', profile.uid),
          { token, uid: profile.uid, orgId: profile.orgId, updatedAt: new Date() },
          { merge: true }
        )
      } catch (e) {
        console.warn('FCM token registration failed:', e)
      }
    }

    registerToken()
  }, [profile?.uid])

  // Firestore-based in-app notifications (works when tab is open/hidden)
  useEffect(() => {
    if (!profile?.orgId) return

    const startTime = new Date()
    const notifQuery = query(
      collection(db, 'organizations', profile.orgId, 'notifications'),
      where('createdAt', '>', startTime),
      orderBy('createdAt', 'desc'),
      limit(10)
    )

    const unsub = onSnapshot(notifQuery, snap => {
      snap.docChanges().forEach(change => {
        if (change.type !== 'added') return
        const data = change.doc.data()
        // Show browser notification if tab is hidden
        if ('Notification' in window && Notification.permission === 'granted' && document.hidden) {
          const n = new Notification(data.title || '1CRM', {
            body: data.body || 'Nuevo mensaje',
            icon: '/favicon.ico',
            tag: change.doc.id,
            data: { url: data.url || '/dashboard/clients' },
          })
          n.onclick = () => {
            window.focus()
            if (data.url) window.location.href = data.url
            n.close()
          }
        }
      })
    })

    return unsub
  }, [profile?.orgId])
}
