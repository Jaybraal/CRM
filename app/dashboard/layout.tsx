'use client'

import AuthGuard from '@/components/auth/AuthGuard'
import Sidebar from '@/components/layout/Sidebar'
import { useNotifications } from '@/hooks/useNotifications'
import { usePathname } from 'next/navigation'

function DashboardInner({ children }: { children: React.ReactNode }) {
  useNotifications()
  const pathname = usePathname()
  const isChatsPage = pathname === '/dashboard/clients'
  return (
    <div className="flex overflow-x-hidden" style={{ height: '100dvh' }}>
      <Sidebar />
      <main className={
        isChatsPage
          ? 'flex-1 min-w-0 lg:ml-64 pt-16 lg:pt-0 overflow-hidden flex flex-col'
          : 'flex-1 min-w-0 lg:ml-64 pt-16 px-4 pb-6 sm:px-6 lg:pt-8 lg:px-8 lg:pb-8 overflow-x-hidden overflow-y-auto'
      }>
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
