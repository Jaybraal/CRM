export const dynamic = 'force-dynamic'

import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { AuthProvider } from '@/context/AuthContext'
import { Toaster } from 'react-hot-toast'
import ServiceWorkerRegister from '@/components/ui/ServiceWorkerRegister'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: '1CRM',
  description: 'Sistema CRM profesional con WhatsApp integrado',
  manifest: '/manifest.json',
  other: {
    'mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-status-bar-style': 'default',
    'apple-mobile-web-app-title': '1CRM',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className={`${inter.className} bg-white text-gray-900 antialiased`}>
        <AuthProvider>
          <ServiceWorkerRegister />
          {children}
          <Toaster
            position="top-right"
            toastOptions={{
              style: { background: '#ffffff', color: '#111827', border: '1px solid #e5e7eb' },
            }}
          />
        </AuthProvider>
      </body>
    </html>
  )
}
