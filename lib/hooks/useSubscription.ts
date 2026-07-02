'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/context/AuthContext'
import type { SubscriptionStatus } from '@/lib/types/subscription'

interface UseSubscriptionReturn {
  status: 'trial' | 'active' | 'canceled' | 'loading'
  trialEndsAt?: number
  isPaid: boolean
  isTrialActive: boolean
  error?: string
  subscription?: SubscriptionStatus
}

export function useSubscription(): UseSubscriptionReturn {
  const { user } = useAuth()
  const [status, setStatus] = useState<'trial' | 'active' | 'canceled' | 'loading'>('loading')
  const [subscription, setSubscription] = useState<SubscriptionStatus | undefined>()
  const [error, setError] = useState<string>()

  useEffect(() => {
    if (!user?.uid) {
      setStatus('loading')
      return
    }

    const fetchSubscription = async () => {
      try {
        const res = await fetch(`/api/subscription/${user.uid}`)
        if (!res.ok) throw new Error('Failed to fetch subscription')
        const data = (await res.json()) as SubscriptionStatus
        setSubscription(data)
        setStatus(data.status)
        setError(undefined)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error')
        setStatus('loading')
      }
    }

    fetchSubscription()
    const interval = setInterval(fetchSubscription, 5000)
    return () => clearInterval(interval)
  }, [user?.uid])

  const now = Math.floor(Date.now() / 1000)
  const isPaid = status === 'active'
  const isTrialActive = status === 'trial' && (subscription?.trialEndsAt ?? 0) > now

  return {
    status,
    trialEndsAt: subscription?.trialEndsAt,
    isPaid,
    isTrialActive,
    error,
    subscription,
  }
}
