'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'

export default function Home() {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (loading) return
    if (user) router.replace('/dashboard')
    else router.replace('/login')
  }, [user, loading, router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950">
      <div className="w-10 h-10 border-4 border-gray-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )
}
