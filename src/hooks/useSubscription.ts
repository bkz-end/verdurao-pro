'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { SubscriptionStatus } from '@/types'

export interface SubscriptionInfo {
  status: SubscriptionStatus
  trialEndsAt: string | null
  daysLeft: number | null
  isTrialActive: boolean
  isTrialExpired: boolean
  isActive: boolean
  isSuspended: boolean
  storeName: string
  loading: boolean
}

export function useSubscription(): SubscriptionInfo {
  const [info, setInfo] = useState<SubscriptionInfo>({
    status: 'pending',
    trialEndsAt: null,
    daysLeft: null,
    isTrialActive: false,
    isTrialExpired: false,
    isActive: false,
    isSuspended: false,
    storeName: '',
    loading: true
  })

  useEffect(() => {
    async function loadSubscription() {
      const supabase = createClient()
      
      const { data: { user } } = await supabase.auth.getUser()
      if (!user?.email) {
        setInfo(prev => ({ ...prev, loading: false }))
        return
      }

      // Get store user
      const { data: storeUser } = await supabase
        .from('store_users')
        .select('tenant_id')
        .eq('email', user.email.toLowerCase())
        .single()

      if (!storeUser) {
        setInfo(prev => ({ ...prev, loading: false }))
        return
      }

      // Get tenant info
      const { data: tenant } = await supabase
        .from('tenants')
        .select('store_name, subscription_status, trial_ends_at')
        .eq('id', storeUser.tenant_id)
        .single()

      if (!tenant) {
        setInfo(prev => ({ ...prev, loading: false }))
        return
      }

      // Calculate days left in trial
      const trialEnd = new Date(tenant.trial_ends_at)
      const now = new Date()
      const diffTime = trialEnd.getTime() - now.getTime()
      const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

      const isTrialActive = daysLeft > 0 && tenant.subscription_status === 'active'
      const isTrialExpired = daysLeft <= 0 && tenant.subscription_status === 'active'

      setInfo({
        status: tenant.subscription_status,
        trialEndsAt: tenant.trial_ends_at,
        daysLeft: daysLeft > 0 ? daysLeft : 0,
        isTrialActive,
        isTrialExpired,
        isActive: tenant.subscription_status === 'active',
        isSuspended: tenant.subscription_status === 'suspended',
        storeName: tenant.store_name,
        loading: false
      })
    }

    loadSubscription()
  }, [])

  return info
}
