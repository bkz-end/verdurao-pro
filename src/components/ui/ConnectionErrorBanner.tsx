/**
 * ConnectionErrorBanner - Banner de erro de conexão
 * 
 * Exibe mensagem amigável quando há erro de conexão
 * com opção de retry automático ou manual.
 */

'use client'

import { useState, useEffect, useCallback } from 'react'
import { ConnectionError } from '@/lib/errors/connection-error'

export interface ConnectionErrorBannerProps {
  error: ConnectionError | null
  onRetry?: () => void
  onDismiss?: () => void
  autoRetry?: boolean
  autoRetryDelay?: number // segundos
}

export function ConnectionErrorBanner({
  error,
  onRetry,
  onDismiss,
  autoRetry = false,
  autoRetryDelay = 5
}: ConnectionErrorBannerProps) {
  const [countdown, setCountdown] = useState(autoRetryDelay)
  const [isRetrying, setIsRetrying] = useState(false)

  const handleRetry = useCallback(async () => {
    if (!onRetry || isRetrying) return
    
    setIsRetrying(true)
    try {
      await onRetry()
    } finally {
      setIsRetrying(false)
      setCountdown(autoRetryDelay)
    }
  }, [onRetry, isRetrying, autoRetryDelay])

  // Auto retry countdown
  useEffect(() => {
    if (!error || !autoRetry || !error.retryable) return

    const interval = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          handleRetry()
          return autoRetryDelay
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [error, autoRetry, autoRetryDelay, handleRetry])

  // Reset countdown when error changes
  useEffect(() => {
    setCountdown(autoRetryDelay)
  }, [error, autoRetryDelay])

  if (!error) return null

  const bgColor = error.type === 'auth' 
    ? 'bg-yellow-50 border-yellow-200' 
    : 'bg-red-50 border-red-200'
  
  const textColor = error.type === 'auth'
    ? 'text-yellow-800'
    : 'text-red-800'

  const iconColor = error.type === 'auth'
    ? 'text-yellow-500'
    : 'text-red-500'

  return (
    <div 
      className={`${bgColor} border rounded-lg p-4 mb-4 animate-in slide-in-from-top duration-300`}
      role="alert"
      aria-live="assertive"
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className={`flex-shrink-0 ${iconColor}`}>
          {error.type === 'network' ? (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3m8.293 8.293l1.414 1.414" 
              />
            </svg>
          ) : error.type === 'auth' ? (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" 
              />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" 
              />
            </svg>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <h3 className={`text-sm font-semibold ${textColor}`}>
            {error.message}
          </h3>
          <p className={`text-sm ${textColor} opacity-80 mt-0.5`}>
            {error.userMessage}
          </p>
          
          {/* Auto retry countdown */}
          {autoRetry && error.retryable && (
            <p className={`text-xs ${textColor} opacity-60 mt-1`}>
              Tentando novamente em {countdown}s...
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {error.retryable && onRetry && (
            <button
              type="button"
              onClick={handleRetry}
              disabled={isRetrying}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                isRetrying
                  ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  : error.type === 'auth'
                    ? 'bg-yellow-200 text-yellow-800 hover:bg-yellow-300'
                    : 'bg-red-200 text-red-800 hover:bg-red-300'
              }`}
            >
              {isRetrying ? (
                <span className="flex items-center gap-1.5">
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Tentando...
                </span>
              ) : error.type === 'auth' ? (
                'Fazer login'
              ) : (
                'Tentar novamente'
              )}
            </button>
          )}

          {onDismiss && (
            <button
              type="button"
              onClick={onDismiss}
              className={`p-1 rounded-md ${textColor} opacity-60 hover:opacity-100 transition-opacity`}
              aria-label="Fechar"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
