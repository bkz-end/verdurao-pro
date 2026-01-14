/**
 * ConnectionErrorContext
 * 
 * Contexto global para gerenciar erros de conexão.
 * Permite que qualquer componente reporte erros e exiba notificações.
 */

'use client'

import { createContext, useContext, useState, useCallback, ReactNode } from 'react'
import { ConnectionError, createConnectionError } from '@/lib/errors/connection-error'
import { ConnectionToast } from '@/components/ui/ConnectionToast'
import { ConnectionErrorBanner } from '@/components/ui/ConnectionErrorBanner'

interface ConnectionErrorContextValue {
  error: ConnectionError | null
  showError: (error: unknown) => void
  clearError: () => void
  showToast: (error: unknown) => void
  showBanner: (error: unknown) => void
}

const ConnectionErrorContext = createContext<ConnectionErrorContextValue | null>(null)

export interface ConnectionErrorProviderProps {
  children: ReactNode
  defaultMode?: 'toast' | 'banner'
  toastDuration?: number
  toastPosition?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'top-center' | 'bottom-center'
  autoRetry?: boolean
}

export function ConnectionErrorProvider({
  children,
  defaultMode = 'toast',
  toastDuration = 5000,
  toastPosition = 'top-center',
  autoRetry = false
}: ConnectionErrorProviderProps) {
  const [error, setError] = useState<ConnectionError | null>(null)
  const [mode, setMode] = useState<'toast' | 'banner'>(defaultMode)

  const clearError = useCallback(() => {
    setError(null)
  }, [])

  const showError = useCallback((err: unknown) => {
    const connectionError = createConnectionError(err)
    setError(connectionError)
    setMode(defaultMode)
  }, [defaultMode])

  const showToast = useCallback((err: unknown) => {
    const connectionError = createConnectionError(err)
    setError(connectionError)
    setMode('toast')
  }, [])

  const showBanner = useCallback((err: unknown) => {
    const connectionError = createConnectionError(err)
    setError(connectionError)
    setMode('banner')
  }, [])

  return (
    <ConnectionErrorContext.Provider
      value={{
        error,
        showError,
        clearError,
        showToast,
        showBanner
      }}
    >
      {children}

      {/* Toast notification */}
      {mode === 'toast' && (
        <ConnectionToast
          error={error}
          duration={toastDuration}
          position={toastPosition}
          onDismiss={clearError}
        />
      )}

      {/* Banner notification (rendered at top of page via portal would be ideal) */}
      {mode === 'banner' && error && (
        <div className="fixed top-0 left-0 right-0 z-50 p-4">
          <ConnectionErrorBanner
            error={error}
            onDismiss={clearError}
            autoRetry={autoRetry}
          />
        </div>
      )}
    </ConnectionErrorContext.Provider>
  )
}

/**
 * Hook para usar o contexto de erro de conexão
 */
export function useConnectionErrorContext() {
  const context = useContext(ConnectionErrorContext)
  
  if (!context) {
    throw new Error('useConnectionErrorContext must be used within ConnectionErrorProvider')
  }
  
  return context
}

/**
 * Hook simplificado para mostrar erros
 */
export function useShowConnectionError() {
  const { showError, showToast, showBanner, clearError } = useConnectionErrorContext()
  return { showError, showToast, showBanner, clearError }
}
