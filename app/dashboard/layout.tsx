'use client'

import AuthGuard from '@/components/auth/AuthGuard'
import Sidebar from '@/components/layout/Sidebar'
import { useNotifications } from '@/hooks/useNotifications'

function DashboardInner({ children }: { children: React.ReactNode }) {
  useNotifications()
  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="flex-1 lg:ml-64 p-6 lg:p-8">
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
