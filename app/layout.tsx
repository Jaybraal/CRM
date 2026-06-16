export const dynamic = 'force-dynamic'

import type { Metadata } from 'next'
import { Plus_Jakarta_Sans, JetBrains_Mono } from 'next/font/google'
import './globals.css'
import { AuthProvider } from '@/context/AuthContext'
import { Toaster } from 'react-hot-toast'
import ServiceWorkerRegister from '@/components/ui/ServiceWorkerRegister'

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-jakarta',
  display: 'swap',
  weight: ['400', '500', '600', '700', '800'],
})

const mono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono-code',
  display: 'swap',
  weight: ['400', '600'],
})

export const metadata: Metadata = {
  title: 'NEXO CRM',
  description: 'Sistema CRM profesional multi-negocio con WhatsApp integrado',
  manifest: '/manifest.json',
  other: {
    'mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-status-bar-style': 'default',
    'apple-mobile-web-app-title': 'NEXO CRM',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${jakarta.variable} ${mono.variable}`}>
      <body className="font-sans bg-[#F4F5F7] text-[#0C1224] antialiased">
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
