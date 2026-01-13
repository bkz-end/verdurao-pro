'use client'

import { ConnectionStatusIndicator } from './ConnectionStatusIndicator'

/**
 * PDVHeader - Simple header for PDV screen
 * Requirements: 5.3, 12.5
 * 
 * Features:
 * - Store name display
 * - Profile icon for user actions
 * - Connection status indicator with pending sync count
 * - Minimal design to maximize screen space
 */
export interface PDVHeaderProps {
  storeName: string
  userName?: string
  tenantId?: string
  isOnline?: boolean
  pendingSyncCount?: number
  onProfileClick?: () => void
  onSyncComplete?: (syncedCount: number) => void
}

export function PDVHeader({
  storeName,
  userName,
  tenantId,
  isOnline = true,
  pendingSyncCount = 0,
  onProfileClick,
  onSyncComplete
}: PDVHeaderProps) {
  return (
    <header className="bg-white border-b border-gray-200 px-4 py-3 safe-area-top">
      <div className="max-w-lg mx-auto flex items-center justify-between">
        {/* Store Name */}
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-bold text-gray-800 truncate max-w-[180px]">
            {storeName}
          </h1>
          
          {/* Connection Status Indicator */}
          {tenantId ? (
            <ConnectionStatusIndicator
              tenantId={tenantId}
              compact={true}
              showPendingCount={true}
              showSyncButton={false}
              onSyncComplete={onSyncComplete}
            />
          ) : (
            <div
              className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-500' : 'bg-red-500'}`}
              title={isOnline ? 'Online' : 'Offline'}
              aria-label={isOnline ? 'Conectado' : 'Sem conexão'}
            />
          )}
        </div>

        {/* Profile Button */}
        <button
          type="button"
          onClick={onProfileClick}
          className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-100 active:bg-gray-200 transition-colors"
          aria-label="Menu do usuário"
        >
          {userName && (
            <span className="text-sm text-gray-600 hidden sm:inline">
              {userName}
            </span>
          )}
          <div className="w-9 h-9 bg-green-100 rounded-full flex items-center justify-center">
            <svg
              className="w-5 h-5 text-green-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
              />
            </svg>
          </div>
        </button>
      </div>
    </header>
  )
}
