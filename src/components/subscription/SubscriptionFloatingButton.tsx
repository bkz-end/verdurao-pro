'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useSubscription } from '@/hooks/useSubscription'

export function SubscriptionFloatingButton() {
  const subscription = useSubscription()
  const [isVisible, setIsVisible] = useState(true)

  // Don't show if loading or if user has paid subscription (not in trial)
  if (subscription.loading) return null
  
  // Show only during trial or if not active
  const shouldShow = subscription.isTrialActive || !subscription.isActive
  if (!shouldShow) return null

  if (!isVisible) return null

  return (
    <div className="fixed bottom-24 right-4 z-40 animate-slide-up">
      <Link
        href="/assinatura"
        className="flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-yellow-400 to-orange-500 
                   text-white font-bold rounded-full shadow-lg hover:shadow-xl 
                   active:scale-95 transition-all"
      >
        <span className="text-xl">⭐</span>
        <span>
          {subscription.isTrialActive && subscription.daysLeft !== null
            ? `${subscription.daysLeft} dias grátis`
            : 'Assinar'
          }
        </span>
        <button
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            setIsVisible(false)
          }}
          className="ml-1 p-1 hover:bg-white/20 rounded-full"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </Link>
    </div>
  )
}
