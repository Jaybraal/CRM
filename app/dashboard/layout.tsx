'use client'

import AuthGuard from '@/components/auth/AuthGuard'
import Sidebar from '@/components/layout/Sidebar'
import { useNotifications } from '@/hooks/useNotifications'

function DashboardInner({ children }: { children: React.ReactNode }) {
  useNotifications()
  return (
    <div className="flex min-h-screen bg-gray-50 overflow-x-hidden">
      <Sidebar />
      <main className="flex-1 min-w-0 lg:ml-64 pt-16 px-4 pb-6 sm:px-6 lg:pt-8 lg:px-8 lg:pb-8 overflow-x-hidden">
        {children}
      </main>
    </div>
  )
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <DashboardInner>{children}</DashboardInner>
    </AuthGuard>
  )
}
