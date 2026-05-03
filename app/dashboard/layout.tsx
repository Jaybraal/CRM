'use client'

import AuthGuard from '@/components/auth/AuthGuard'
import Sidebar from '@/components/layout/Sidebar'
import TopBar from '@/components/layout/TopBar'
import { useNotifications } from '@/hooks/useNotifications'
import { usePathname } from 'next/navigation'

function DashboardInner({ children }: { children: React.ReactNode }) {
  useNotifications()
  const pathname = usePathname()
  const isFullHeightPage = pathname === '/dashboard/clients' || pathname === '/dashboard/inbox'

  if (isFullHeightPage) {
    return (
<<<<<<< HEAD
      <div className="flex bg-slate-50 dark:bg-slate-950" style={{ height: '100dvh' }}>
=======
      <div className="flex bg-slate-50" style={{ height: '100dvh' }}>
>>>>>>> origin/main
        <Sidebar />
        <div className="flex-1 min-w-0 lg:ml-72 pt-16 lg:pt-0 flex flex-col overflow-hidden">
          <TopBar />
          <main className="flex-1 overflow-hidden flex flex-col">
            {children}
          </main>
        </div>
      </div>
    )
  }

  return (
<<<<<<< HEAD
    <div className="flex min-h-screen bg-slate-50 dark:bg-slate-950 overflow-x-hidden">
=======
    <div className="flex min-h-screen bg-slate-50 overflow-x-hidden">
>>>>>>> origin/main
      <Sidebar />
      <div className="flex-1 min-w-0 lg:ml-72 pt-16 lg:pt-0 flex flex-col">
        <TopBar />
        <main className="flex-1 px-4 pb-6 sm:px-6 lg:px-8 py-8 overflow-x-hidden">
          {children}
        </main>
      </div>
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
