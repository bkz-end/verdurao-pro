'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

interface TrialBannerProps {
  trialEndsAt: string
  onDismiss?: () => void
}

export function TrialBanner({ trialEndsAt, onDismiss }: TrialBannerProps) {
  const [daysLeft, setDaysLeft] = useState<number | null>(null)
  const [isVisible, setIsVisible] = useState(true)

  useEffect(() => {
    const trialEnd = new Date(trialEndsAt)
    const now = new Date()
    const diffTime = trialEnd.getTime() - now.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    setDaysLeft(diffDays)
  }, [trialEndsAt])

  if (!isVisible || daysLeft === null || daysLeft < 0) return null

  const handleDismiss = () => {
    setIsVisible(false)
    onDismiss?.()
  }

  // Determine urgency level
  const isUrgent = daysLeft <= 2
  const isWarning = daysLeft <= 5 && daysLeft > 2

  return (
    <div 
      className={`
        w-full px-4 py-3 flex items-center justify-between gap-3
        ${isUrgent 
          ? 'bg-gradient-to-r from-red-500 to-red-600' 
          : isWarning 
            ? 'bg-gradient-to-r from-orange-500 to-orange-600'
            : 'bg-gradient-to-r from-blue-500 to-blue-600'
        }
      `}
    >
      <div className="flex items-center gap-3 flex-1 min-w-0">
        {/* Icon */}
        <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0">
          {isUrgent ? (
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          ) : (
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          )}
        </div>

        {/* Text */}
        <div className="flex-1 min-w-0">
          <p className="text-white font-semibold text-sm truncate">
            {daysLeft === 0 
              ? '⚠️ Último dia do teste grátis!'
              : daysLeft === 1 
                ? '⚠️ Falta 1 dia para acabar o teste!'
                : `🎁 ${daysLeft} dias restantes de teste grátis`
            }
          </p>
          <p className="text-white/80 text-xs truncate">
            {isUrgent 
              ? 'Assine agora para não perder acesso'
              : 'Aproveite todas as funcionalidades'
            }
          </p>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <Link
          href="/assinatura"
          className="px-4 py-2 bg-white text-gray-800 font-bold text-sm rounded-lg 
                     hover:bg-gray-100 active:scale-95 transition-all shadow-lg"
        >
          Assinar
        </Link>
        <button
          onClick={handleDismiss}
          className="p-2 text-white/70 hover:text-white transition-colors"
          aria-label="Fechar"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  )
}
