'use client'

import { useState, useRef, useEffect } from 'react'
import { ConnectionStatusIndicator } from './ConnectionStatusIndicator'
import Link from 'next/link'

/**
 * PDVHeader - Simple header for PDV screen
 * Requirements: 5.3, 12.5
 * 
 * Features:
 * - Store name display
 * - Profile icon for user actions
 * - Connection status indicator with pending sync count
 * - Subscription badge
 * - Minimal design to maximize screen space
 */
export interface PDVHeaderProps {
  storeName: string
  userName?: string
  tenantId?: string
  isOnline?: boolean
  pendingSyncCount?: number
  trialDaysLeft?: number | null
  subscriptionStatus?: string
  onProfileClick?: () => void
  onSyncComplete?: (syncedCount: number) => void
}

export function PDVHeader({
  storeName,
  userName,
  tenantId,
  isOnline = true,
  pendingSyncCount = 0,
  trialDaysLeft,
  subscriptionStatus,
  onProfileClick,
  onSyncComplete
}: PDVHeaderProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Determine subscription badge
  const getSubscriptionBadge = () => {
    if (subscriptionStatus === 'active' && (trialDaysLeft === null || trialDaysLeft === undefined || trialDaysLeft <= 0)) {
      return null // Active subscription, no badge needed
    }
    
    if (trialDaysLeft !== null && trialDaysLeft !== undefined && trialDaysLeft > 0) {
      // Trial active
      const bgColor = trialDaysLeft <= 2 ? 'bg-red-500' : trialDaysLeft <= 5 ? 'bg-orange-500' : 'bg-blue-500'
      return (
        <Link href="/assinatura" className={`${bgColor} text-white text-xs font-bold px-2 py-1 rounded-full animate-pulse`}>
          {trialDaysLeft}d
        </Link>
      )
    }
    
    // Trial expired or no subscription
    return (
      <Link href="/assinatura" className="bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full animate-pulse">
        Assinar
      </Link>
    )
  }

  return (
    <header className="bg-white border-b border-gray-200 px-4 py-3 safe-area-top">
      <div className="max-w-lg mx-auto flex items-center justify-between">
        {/* Store Name and Subscription Badge */}
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-bold text-gray-800 truncate max-w-[140px]">
            {storeName}
          </h1>
          
          {/* Subscription Badge */}
          {getSubscriptionBadge()}
          
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

        {/* Profile Button with Dropdown */}
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
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

          {/* Dropdown Menu */}
          {isMenuOpen && (
            <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-xl shadow-lg border border-gray-200 py-2 z-50 animate-slide-up">
              {/* User info */}
              <div className="px-4 py-3 border-b border-gray-100">
                <p className="font-semibold text-gray-800">{storeName}</p>
                {userName && <p className="text-sm text-gray-500">{userName}</p>}
              </div>

              {/* Menu items */}
              <div className="py-1">
                <Link
                  href="/estoque"
                  className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors"
                  onClick={() => setIsMenuOpen(false)}
                >
                  <span className="text-xl">📦</span>
                  <span className="text-gray-700">Estoque</span>
                </Link>

                <Link
                  href="/perdas"
                  className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors"
                  onClick={() => setIsMenuOpen(false)}
                >
                  <span className="text-xl">📉</span>
                  <span className="text-gray-700">Perdas</span>
                </Link>

                <Link
                  href="/relatorios"
                  className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors"
                  onClick={() => setIsMenuOpen(false)}
                >
                  <span className="text-xl">📊</span>
                  <span className="text-gray-700">Relatórios</span>
                </Link>

                <Link
                  href="/funcionarios"
                  className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors"
                  onClick={() => setIsMenuOpen(false)}
                >
                  <span className="text-xl">👥</span>
                  <span className="text-gray-700">Funcionários</span>
                </Link>

                <div className="border-t border-gray-100 my-1" />

                <Link
                  href="/assinatura"
                  className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors"
                  onClick={() => setIsMenuOpen(false)}
                >
                  <span className="text-xl">⭐</span>
                  <span className="text-gray-700 font-medium">Assinatura</span>
                </Link>

                <div className="border-t border-gray-100 my-1" />

                <Link
                  href="/login"
                  className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-red-600"
                  onClick={() => setIsMenuOpen(false)}
                >
                  <span className="text-xl">🚪</span>
                  <span>Sair</span>
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
