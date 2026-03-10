'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import type { UserRole } from '@/types'

interface AuthGuardProps {
  children: React.ReactNode
  allowedRoles?: UserRole[]
}

export default function AuthGuard({ children, allowedRoles }: AuthGuardProps) {
  const { user, profile, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (loading) return
    if (!user) {
      router.replace('/login')
      return
    }
    if (allowedRoles && profile && !allowedRoles.includes(profile.role)) {
      router.replace('/dashboard')
    }
  }, [user, profile, loading, router, allowedRoles])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-gray-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-gray-400 text-sm">Cargando...</span>
        </div>
      </div>
    )
  }

  if (!user) return null

  return <>{children}</>
}
