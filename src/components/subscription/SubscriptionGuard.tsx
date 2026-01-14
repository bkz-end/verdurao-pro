'use client'

import { useSubscription } from '@/hooks/useSubscription'
import { TrialBanner } from './TrialBanner'
import { SubscriptionExpiredModal } from './SubscriptionExpiredModal'

interface SubscriptionGuardProps {
  children: React.ReactNode
}

export function SubscriptionGuard({ children }: SubscriptionGuardProps) {
  const subscription = useSubscription()

  if (subscription.loading) {
    return <>{children}</>
  }

  // Show expired modal if trial ended or suspended
  if (subscription.isTrialExpired) {
    return (
      <>
        {children}
        <SubscriptionExpiredModal 
          storeName={subscription.storeName} 
          status="trial_expired" 
        />
      </>
    )
  }

  if (subscription.isSuspended) {
    return (
      <>
        {children}
        <SubscriptionExpiredModal 
          storeName={subscription.storeName} 
          status="suspended" 
        />
      </>
    )
  }

  if (subscription.status === 'cancelled') {
    return (
      <>
        {children}
        <SubscriptionExpiredModal 
          storeName={subscription.storeName} 
          status="cancelled" 
        />
      </>
    )
  }

  // Show trial banner if in trial period
  if (subscription.isTrialActive && subscription.trialEndsAt) {
    return (
      <>
        <TrialBanner trialEndsAt={subscription.trialEndsAt} />
        {children}
      </>
    )
  }

  return <>{children}</>
}
