// 1CRM Service Worker — handles both FCM background push and custom push
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js')

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()))

// Initialize Firebase in SW (required for background FCM)
const firebaseConfig = {
  apiKey: self.FIREBASE_API_KEY,
  authDomain: self.FIREBASE_AUTH_DOMAIN,
  projectId: self.FIREBASE_PROJECT_ID,
  storageBucket: self.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: self.FIREBASE_MESSAGING_SENDER_ID,
  appId: self.FIREBASE_APP_ID,
}

// Only init if config values are present
let messaging = null
try {
  if (firebaseConfig.apiKey && firebaseConfig.projectId) {
    firebase.initializeApp(firebaseConfig)
    messaging = firebase.messaging()

    // Handle background FCM messages
    messaging.onBackgroundMessage(payload => {
      const { title, body, url } = payload.notification || payload.data || {}
      self.registration.showNotification(title || '1CRM', {
        body: body || 'Tienes un nuevo mensaje',
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        tag: 'crm-' + Date.now(),
        data: { url: url || '/dashboard/clients' },
      })
    })
  }
} catch (e) {
  // Firebase not configured — fallback to basic push
}

// Handle Web Push API (non-FCM fallback)
self.addEventListener('push', event => {
  const data = event.data?.json() || {}
  event.waitUntil(
    self.registration.showNotification(data.title || '1CRM', {
      body: data.body || 'Tienes un nuevo mensaje',
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
