// Serves the service worker with Firebase config injected as env vars
// This is necessary because public/sw.js is static and can't access Next.js env vars
export const dynamic = 'force-dynamic'

export async function GET() {
  const config = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || '',
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || '',
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '',
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || '',
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '',
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '',
  }

  const sw = `
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js')

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()))

try {
  firebase.initializeApp(${JSON.stringify(config)})
  const messaging = firebase.messaging()

  messaging.onBackgroundMessage(payload => {
    const notification = payload.notification || {}
    const data = payload.data || {}
    const title = notification.title || data.title || '1CRM'
    const body = notification.body || data.body || 'Nuevo mensaje'
    const url = data.url || notification.click_action || '/dashboard/clients'
    self.registration.showNotification(title, {
      body,
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      tag: 'crm-' + Date.now(),
      data: { url },
    })
  })
} catch (e) {
  console.warn('[SW] Firebase init failed:', e.message)
}

self.addEventListener('push', event => {
  const data = event.data?.json() || {}
  event.waitUntil(
    self.registration.showNotification(data.title || '1CRM', {
      body: data.body || 'Nuevo mensaje',
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      tag: data.tag || 'crm-notification',
      data: { url: data.url || '/dashboard/clients' },
    })
  )
})

self.addEventListener('notificationclick', event => {
  event.notification.close()
  const url = event.notification.data?.url || '/dashboard/clients'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
      const existing = clients.find(c => c.url.includes(self.location.origin))
      if (existing) { existing.focus(); existing.navigate(url) }
      else self.clients.openWindow(url)
    })
  )
})

self.addEventListener('fetch', () => {})
`

  return new Response(sw, {
    headers: {
      'Content-Type': 'application/javascript',
      'Service-Worker-Allowed': '/',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  })
}
