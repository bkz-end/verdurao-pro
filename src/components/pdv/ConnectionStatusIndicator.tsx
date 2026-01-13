/**
 * ConnectionStatusIndicator - Visual indicator for connection status
 * Requirements: 5.3
 * 
 * Features:
 * - Shows online/offline status with icon
 * - Displays pending sync count badge
 * - Provides sync button when online with pending items
 * - Animated sync indicator
 */

'use client'

import { useConnectionStatus } from '@/hooks/useConnectionStatus'
import { haptics } from '@/lib/utils/haptics'

export interface ConnectionStatusIndicatorProps {
  tenantId?: string
  showPendingCount?: boolean
  showSyncButton?: boolean
  compact?: boolean
  onSyncComplete?: (syncedCount: number) => void
}

export function ConnectionStatusIndicator({
  tenantId,
  showPendingCount = true,
  showSyncButton = true,
  compact = false,
  onSyncComplete
}: ConnectionStatusIndicatorProps) {
  const {
    isOnline,
    pendingSyncCount,
    isSyncing,
    triggerSync
  } = useConnectionStatus({
    tenantId,
    onSyncComplete
  })

  const handleSyncClick = () => {
    if (isOnline && pendingSyncCount > 0 && !isSyncing) {
      haptics.tap()
      triggerSync()
    }
  }

  // Compact mode - just the status dot
  if (compact) {
    return (
      <div className="flex items-center gap-1.5">
        <div
          className={`w-2 h-2 rounded-full transition-colors ${
            isOnline ? 'bg-green-500' : 'bg-red-500'
          }`}
          title={isOnline ? 'Online' : 'Offline'}
          aria-label={isOnline ? 'Conectado' : 'Sem conexão'}
        />
        {showPendingCount && pendingSyncCount > 0 && (
          <span className="text-xs text-orange-500 font-medium">
            {pendingSyncCount}
          </span>
        )}
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2">
      {/* Status Indicator */}
      <div
        className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium transition-colors ${
          isOnline
            ? 'bg-green-100 text-green-700'
            : 'bg-red-100 text-red-700'
        }`}
        role="status"
        aria-live="polite"
      >
        {/* Status Icon */}
        {isOnline ? (
          <svg
            className="w-3.5 h-3.5"
            fill="currentColor"
            viewBox="0 0 20 20"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M5.05 3.636a1 1 0 010 1.414 7 7 0 000 9.9 1 1 0 11-1.414 1.414 9 9 0 010-12.728 1 1 0 011.414 0zm9.9 0a1 1 0 011.414 0 9 9 0 010 12.728 1 1 0 11-1.414-1.414 7 7 0 000-9.9 1 1 0 010-1.414zM7.879 6.464a1 1 0 010 1.414 3 3 0 000 4.243 1 1 0 11-1.415 1.414 5 5 0 010-7.07 1 1 0 011.415 0zm4.242 0a1 1 0 011.415 0 5 5 0 010 7.072 1 1 0 01-1.415-1.415 3 3 0 000-4.242 1 1 0 010-1.415zM10 9a1 1 0 011 1v.01a1 1 0 11-2 0V10a1 1 0 011-1z"
              clipRule="evenodd"
            />
          </svg>
        ) : (
          <svg
            className="w-3.5 h-3.5"
            fill="currentColor"
            viewBox="0 0 20 20"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074l-1.78-1.781zm4.261 4.26l1.514 1.515a2.003 2.003 0 012.45 2.45l1.514 1.514a4 4 0 00-5.478-5.478z"
              clipRule="evenodd"
            />
            <path d="M12.454 16.697L9.75 13.992a4 4 0 01-3.742-3.741L2.335 6.578A9.98 9.98 0 00.458 10c1.274 4.057 5.065 7 9.542 7 .847 0 1.669-.105 2.454-.303z" />
          </svg>
        )}
        
        <span>{isOnline ? 'Online' : 'Offline'}</span>
      </div>

      {/* Pending Sync Badge */}
      {showPendingCount && pendingSyncCount > 0 && (
        <div
          className="flex items-center gap-1 px-2 py-1 rounded-full bg-orange-100 text-orange-700 text-xs font-medium"
          title={`${pendingSyncCount} ${pendingSyncCount === 1 ? 'venda pendente' : 'vendas pendentes'} de sincronização`}
        >
          <svg
            className="w-3.5 h-3.5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span>{pendingSyncCount}</span>
        </div>
      )}

      {/* Sync Button */}
      {showSyncButton && isOnline && pendingSyncCount > 0 && (
        <button
          type="button"
          onClick={handleSyncClick}
          disabled={isSyncing}
          className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium transition-colors ${
            isSyncing
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
              : 'bg-blue-100 text-blue-700 hover:bg-blue-200 active:bg-blue-300'
          }`}
          aria-label={isSyncing ? 'Sincronizando...' : 'Sincronizar vendas pendentes'}
        >
          <svg
            className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
          <span>{isSyncing ? 'Sincronizando...' : 'Sincronizar'}</span>
        </button>
      )}
    </div>
  )
}
