'use client'

import AuthGuard from '@/components/auth/AuthGuard'
import Sidebar from '@/components/layout/Sidebar'
import TopBar from '@/components/layout/TopBar'
import { useNotifications } from '@/hooks/useNotifications'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { useAuth } from '@/context/AuthContext'
import { getOrganization } from '@/lib/firestore'

function DashboardInner({ children }: { children: React.ReactNode }) {
  useNotifications()
  const pathname = usePathname()
  const router = useRouter()
  const { profile, loading } = useAuth()

  const isFullHeight = ['/dashboard/clients', '/dashboard/inbox'].some(
    p => pathname === p || pathname.startsWith(p + '/')
  )

  useEffect(() => {
    if (loading || !profile?.orgId || pathname === '/dashboard/onboarding') return
    getOrganization(profile.orgId).then(org => {
      if (org && org.settings.onboardingCompleted !== true) {
        router.replace('/dashboard/onboarding')
      }
    })
  }, [loading, profile?.orgId, pathname])

  if (isFullHeight) {
    return (
      <div className="flex bg-[#F4F5F7] dark:bg-[#080E1C]" style={{ height: '100dvh' }}>
        <Sidebar />
        <div className="flex-1 min-w-0 lg:ml-16 pt-14 lg:pt-0 flex flex-col overflow-hidden">
          <TopBar />
          <main className="flex-1 overflow-hidden flex flex-col">
            {children}
          </main>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen bg-[#F4F5F7] dark:bg-[#080E1C] overflow-x-hidden">
      <Sidebar />
      <div className="flex-1 min-w-0 lg:ml-16 pt-14 lg:pt-0 flex flex-col">
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
