/**
 * ConnectionToast - Toast de notificação de conexão
 * 
 * Toast não-intrusivo para erros de conexão.
 * Aparece no canto da tela e some automaticamente.
 */

'use client'

import { useEffect, useState } from 'react'
import { ConnectionError } from '@/lib/errors/connection-error'

export interface ConnectionToastProps {
  error: ConnectionError | null
  duration?: number // ms
  onDismiss?: () => void
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'top-center' | 'bottom-center'
}

const positionClasses = {
  'top-right': 'top-4 right-4',
  'top-left': 'top-4 left-4',
  'bottom-right': 'bottom-4 right-4',
  'bottom-left': 'bottom-4 left-4',
  'top-center': 'top-4 left-1/2 -translate-x-1/2',
  'bottom-center': 'bottom-4 left-1/2 -translate-x-1/2'
}

export function ConnectionToast({
  error,
  duration = 5000,
  onDismiss,
  position = 'top-center'
}: ConnectionToastProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [isLeaving, setIsLeaving] = useState(false)

  useEffect(() => {
    if (error) {
      setIsVisible(true)
      setIsLeaving(false)

      const timer = setTimeout(() => {
        setIsLeaving(true)
        setTimeout(() => {
          setIsVisible(false)
          onDismiss?.()
        }, 300) // animation duration
      }, duration)

      return () => clearTimeout(timer)
    }
  }, [error, duration, onDismiss])

  if (!isVisible || !error) return null

  const handleDismiss = () => {
    setIsLeaving(true)
    setTimeout(() => {
      setIsVisible(false)
      onDismiss?.()
    }, 300)
  }

  return (
    <div
      className={`fixed ${positionClasses[position]} z-50 max-w-sm w-full pointer-events-auto`}
      role="alert"
      aria-live="polite"
    >
      <div
        className={`
          bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden
          transform transition-all duration-300 ease-out
          ${isLeaving 
            ? 'opacity-0 translate-y-2 scale-95' 
            : 'opacity-100 translate-y-0 scale-100'
          }
        `}
      >
        {/* Progress bar */}
        <div className="h-1 bg-gray-100">
          <div 
            className={`h-full ${error.type === 'auth' ? 'bg-yellow-500' : 'bg-red-500'}`}
            style={{
              animation: `shrink ${duration}ms linear forwards`
            }}
          />
        </div>

        <div className="p-4 flex items-start gap-3">
          {/* Icon */}
          <div className={`flex-shrink-0 ${
            error.type === 'auth' ? 'text-yellow-500' : 'text-red-500'
          }`}>
            {error.type === 'network' ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                  d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3m8.293 8.293l1.414 1.414" 
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
            <p className="text-sm font-medium text-gray-900">
              {error.message}
            </p>
            <p className="text-sm text-gray-500 mt-0.5">
              {error.userMessage}
            </p>
          </div>

          {/* Close button */}
          <button
            type="button"
            onClick={handleDismiss}
            className="flex-shrink-0 p-1 rounded-md text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Fechar"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      <style jsx>{`
        @keyframes shrink {
          from { width: 100%; }
          to { width: 0%; }
        }
      `}</style>
    </div>
  )
}
