/**
 * useConnectionStatus Hook
 * Requirements: 5.3
 * 
 * Provides real-time connection status monitoring for React components.
 * Tracks online/offline state and pending sync count.
 */

'use client'

import { useState, useEffect, useCallback } from 'react'

/**
 * Connection status state
 */
export interface ConnectionStatus {
  isOnline: boolean
  pendingSyncCount: number
  lastSyncAt: Date | null
  isSyncing: boolean
}

/**
 * Hook options
 */
export interface UseConnectionStatusOptions {
  tenantId?: string
  onStatusChange?: (isOnline: boolean) => void
  onSyncComplete?: (syncedCount: number) => void
}

/**
 * Hook for monitoring connection status
 * Requirements: 5.3
 * 
 * Features:
 * - Real-time online/offline detection
 * - Pending sync count tracking
 * - Sync status monitoring
 */
export function useConnectionStatus(options: UseConnectionStatusOptions = {}) {
  const { tenantId, onStatusChange, onSyncComplete } = options

  const [status, setStatus] = useState<ConnectionStatus>({
    isOnline: typeof window !== 'undefined' ? navigator.onLine : true,
    pendingSyncCount: 0,
    lastSyncAt: null,
    isSyncing: false
  })

  // Handle online event
  const handleOnline = useCallback(() => {
    setStatus(prev => ({ ...prev, isOnline: true }))
    onStatusChange?.(true)
  }, [onStatusChange])

  // Handle offline event
  const handleOffline = useCallback(() => {
    setStatus(prev => ({ ...prev, isOnline: false }))
    onStatusChange?.(false)
  }, [onStatusChange])

  // Set up event listeners
  useEffect(() => {
    if (typeof window === 'undefined') return

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    // Initial status check
    setStatus(prev => ({
      ...prev,
      isOnline: navigator.onLine
    }))

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [handleOnline, handleOffline])

  // Update pending sync count
  const updatePendingCount = useCallback(async () => {
    if (!tenantId || typeof window === 'undefined') return

    try {
      // Dynamic import to avoid SSR issues
      const { getUnsyncedSalesCount } = await import('@/lib/offline/database')
      const count = await getUnsyncedSalesCount(tenantId)
      setStatus(prev => ({ ...prev, pendingSyncCount: count }))
    } catch (error) {
      console.error('Error getting pending sync count:', error)
    }
  }, [tenantId])

  // Poll for pending count updates
  useEffect(() => {
    if (!tenantId) return

    updatePendingCount()
    
    // Update every 5 seconds
    const interval = setInterval(updatePendingCount, 5000)
    
    return () => clearInterval(interval)
  }, [tenantId, updatePendingCount])

  // Manual sync trigger
  const triggerSync = useCallback(async () => {
    if (!status.isOnline || status.isSyncing) return

    setStatus(prev => ({ ...prev, isSyncing: true }))

    try {
      const { createSyncService } = await import('@/lib/offline/sync.service')
      const { createClient } = await import('@/lib/supabase/client')
      
      const supabase = createClient()
      const syncService = createSyncService(supabase)
      
      const result = await syncService.syncAll(tenantId)
      
      setStatus(prev => ({
        ...prev,
        isSyncing: false,
        lastSyncAt: new Date(),
        pendingSyncCount: Math.max(0, prev.pendingSyncCount - result.syncedCount)
      }))

      onSyncComplete?.(result.syncedCount)
    } catch (error) {
      console.error('Sync error:', error)
      setStatus(prev => ({ ...prev, isSyncing: false }))
    }
  }, [status.isOnline, status.isSyncing, tenantId, onSyncComplete])

  // Increment pending count (for new offline sales)
  const incrementPendingCount = useCallback(() => {
    setStatus(prev => ({
      ...prev,
      pendingSyncCount: prev.pendingSyncCount + 1
    }))
  }, [])

  return {
    ...status,
    triggerSync,
    incrementPendingCount,
    updatePendingCount
  }
}
