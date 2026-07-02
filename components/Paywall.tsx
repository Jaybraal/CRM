'use client'

import { Check } from 'lucide-react'

interface PaywallProps {
  onCheckout: () => void
  loading?: boolean
}

export default function Paywall({ onCheckout, loading = false }: PaywallProps) {
  const features = [
    'Unlimited leads and deals',
    'WhatsApp integration',
    '24/7 support',
    'Advanced analytics'
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-white rounded-lg shadow-lg">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-50 to-blue-100 px-6 py-8 rounded-t-lg">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Upgrade to Pro</h2>
          <p className="text-gray-600">Unlock unlimited features for your business</p>
        </div>

        {/* Pricing Section */}
        <div className="px-6 py-8">
          <div className="bg-blue-50 rounded-lg p-6 mb-8">
            <div className="flex items-baseline gap-2">
              <span className="text-5xl font-bold text-gray-900">$150</span>
              <span className="text-gray-600">/month</span>
            </div>
            <p className="text-gray-600 text-sm mt-2">Billed monthly. Cancel anytime.</p>
          </div>

          {/* Features List */}
          <div className="space-y-4 mb-8">
            <h3 className="text-lg font-semibold text-gray-900">What's included:</h3>
            <ul className="space-y-3">
              {features.map((feature, index) => (
                <li key={index} className="flex items-center gap-3">
                  <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
                  <span className="text-gray-700">{feature}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Button */}
          <button
            onClick={onCheckout}
            disabled={loading}
            className={`w-full py-3 px-4 rounded-lg font-semibold text-white transition-colors ${
              loading
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800'
            }`}
          >
            {loading ? 'Processing...' : 'Upgrade Now'}
          </button>

          {/* Disclaimer */}
          <p className="text-center text-xs text-gray-500 mt-4">
            By upgrading, you agree to our Terms of Service and Privacy Policy.
          </p>
        </div>
      </div>
    </div>
  )
}
