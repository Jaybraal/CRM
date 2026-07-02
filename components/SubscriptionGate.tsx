'use client'

import { ReactNode, useState } from 'react'
import { useSubscription } from '@/lib/hooks/useSubscription'
import Paywall from './Paywall'
import { TrialTimer } from './TrialTimer'
import { Spinner } from './ui/primitives'

interface SubscriptionGateProps {
  children: ReactNode
  allowTrial?: boolean
}

export default function SubscriptionGate({ children, allowTrial = true }: SubscriptionGateProps) {
  const { status, isPaid, isTrialActive, trialEndsAt, subscription, error } = useSubscription()
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [checkoutError, setCheckoutError] = useState<string>()

  // Determine if user has access to the app
  const hasAccess = isPaid || (allowTrial && isTrialActive)

  // Handle checkout button click
  const handleCheckout = async () => {
    if (!subscription?.customerId) {
      setCheckoutError('Unable to process checkout: customer information missing')
      return
    }

    try {
      setCheckoutLoading(true)
      setCheckoutError(undefined)

      // Fetch checkout session from API
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          customerId: subscription.customerId,
          returnUrl: `${window.location.origin}/app/dashboard`,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to create checkout session')
      }

      const { sessionUrl } = (await response.json()) as { sessionUrl: string }

      if (!sessionUrl) {
        throw new Error('No checkout URL provided by server')
      }

      // Redirect to Stripe checkout
      window.location.href = sessionUrl
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred'
      setCheckoutError(errorMessage)
      console.error('Checkout error:', err)
    } finally {
      setCheckoutLoading(false)
    }
  }

  // Show loading spinner while fetching subscription status
  if (status === 'loading') {
    return <Spinner />
  }

  // Show paywall if user doesn't have access
  if (!hasAccess) {
    return (
      <div>
        <Paywall onCheckout={handleCheckout} loading={checkoutLoading} />
        {checkoutError && (
          <div className="fixed bottom-4 left-4 right-4 z-40 bg-red-50 border border-red-300 text-red-800 px-4 py-3 rounded">
            <p className="font-semibold">Checkout Error</p>
            <p className="text-sm mt-1">{checkoutError}</p>
          </div>
        )}
      </div>
    )
  }

  // Show trial timer if trial is active
  return (
    <div>
      {isTrialActive && trialEndsAt && (
        <div className="mb-4">
          <TrialTimer
            trialEndsAt={trialEndsAt}
            onExpired={() => {
              // Optionally refresh page or show upgrade prompt when trial expires
              window.location.reload()
            }}
          />
        </div>
      )}
      {children}
    </div>
  )
}
