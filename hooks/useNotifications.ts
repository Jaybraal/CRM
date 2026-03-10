'use client'

import { useEffect, useRef } from 'react'
import { useAuth } from '@/context/AuthContext'
import { collection, query, where, onSnapshot, orderBy, limit } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { Message } from '@/types'

export function useNotifications() {
  const { profile } = useAuth()
  const lastSeenRef = useRef<Date>(new Date())
  const permissionRef = useRef<NotificationPermission>('default')

  useEffect(() => {
    // Register service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {})
    }

    // Request notification permission
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().then(p => {
        permissionRef.current = p
      })
    } else if ('Notification' in window) {
      permissionRef.current = Notification.permission
    }
  }, [])

  useEffect(() => {
    if (!profile?.orgId) return

    // Listen to all new messages across all clients in this org
    // We query the collectionGroup for messages
    const q = query(
      collection(db, 'organizations', profile.orgId, 'clients'),
    )

    // For now we listen to each client's messages via a collectionGroup workaround
    // We track the start time and only notify for messages after that
    const startTime = new Date()

    // Listen to recent messages (last 1 minute, source=whatsapp)
    // We can't easily do collectionGroup without indexes, so we rely on
    // a simple polling approach by reading client list periodically
    // Instead, use an activity feed document that the webhook updates

    // Actually, we'll just show a document-level listener on a special notifications collection
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
        if ('Notification' in window && Notification.permission === 'granted' && document.hidden) {
          new Notification(data.title || '1CRM', {
            body: data.body || 'Nuevo mensaje de WhatsApp',
            icon: '/favicon.ico',
          })
        }
      })
    })

    return unsub
  }, [profile?.orgId])
}
