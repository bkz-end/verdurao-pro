/**
 * useConnectionError Hook
 * 
 * Hook para gerenciar erros de conexão em componentes React.
 * Integra com o sistema de tratamento de erros centralizado.
 */

'use client'

import { useState, useCallback, useRef } from 'react'
import { 
  ConnectionError, 
  createConnectionError, 
  withRetry, 
  RetryConfig,
  isOnline 
} from '@/lib/errors/connection-error'

export interface UseConnectionErrorOptions {
  autoRetry?: boolean
  retryConfig?: RetryConfig
  onError?: (error: ConnectionError) => void
  onSuccess?: () => void
}

export interface UseConnectionErrorReturn {
  error: ConnectionError | null
  isLoading: boolean
  isRetrying: boolean
  retryCount: number
  clearError: () => void
  setError: (error: unknown) => void
  execute: <T>(fn: () => Promise<T>) => Promise<T | null>
  executeWithRetry: <T>(fn: () => Promise<T>) => Promise<T | null>
}

export function useConnectionError(
  options: UseConnectionErrorOptions = {}
): UseConnectionErrorReturn {
  const { autoRetry = false, retryConfig, onError, onSuccess } = options

  const [error, setErrorState] = useState<ConnectionError | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isRetrying, setIsRetrying] = useState(false)
  const [retryCount, setRetryCount] = useState(0)
  
  const abortControllerRef = useRef<AbortController | null>(null)

  const clearError = useCallback(() => {
    setErrorState(null)
    setRetryCount(0)
  }, [])

  const setError = useCallback((err: unknown) => {
    const connectionError = createConnectionError(err)
    setErrorState(connectionError)
    onError?.(connectionError)
  }, [onError])

  /**
   * Executa uma função async com tratamento de erro (sem retry)
   */
  const execute = useCallback(async <T>(fn: () => Promise<T>): Promise<T | null> => {
    // Cancela operação anterior se existir
    abortControllerRef.current?.abort()
    abortControllerRef.current = new AbortController()

    setIsLoading(true)
    clearError()

    try {
      // Verifica conexão antes de executar
      if (!isOnline()) {
        throw new Error('No network connection')
      }

      const result = await fn()
      onSuccess?.()
      return result
    } catch (err) {
      // Ignora erros de abort
      if (err instanceof DOMException && err.name === 'AbortError') {
        return null
      }
      
      setError(err)
      return null
    } finally {
      setIsLoading(false)
    }
  }, [clearError, setError, onSuccess])

  /**
   * Executa uma função async com retry automático
   */
  const executeWithRetry = useCallback(async <T>(fn: () => Promise<T>): Promise<T | null> => {
    abortControllerRef.current?.abort()
    abortControllerRef.current = new AbortController()

    setIsLoading(true)
    setIsRetrying(false)
    clearError()
    setRetryCount(0)

    try {
      const result = await withRetry(fn, {
        ...retryConfig,
        onRetry: (attempt, err) => {
          setIsRetrying(true)
          setRetryCount(attempt)
          retryConfig?.onRetry?.(attempt, err)
        }
      })

      onSuccess?.()
      return result
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return null
      }

      // Se já é um ConnectionError, usa direto
      if ((err as ConnectionError).type) {
        setErrorState(err as ConnectionError)
        onError?.(err as ConnectionError)
      } else {
        setError(err)
      }
      return null
    } finally {
      setIsLoading(false)
      setIsRetrying(false)
    }
  }, [clearError, setError, retryConfig, onError, onSuccess])

  return {
    error,
    isLoading,
    isRetrying,
    retryCount,
    clearError,
    setError,
    execute,
    executeWithRetry
  }
}

/**
 * Hook simplificado para operações com retry automático
 */
export function useAsyncOperation<T>(
  operation: () => Promise<T>,
  options: UseConnectionErrorOptions = {}
) {
  const { error, isLoading, isRetrying, retryCount, clearError, executeWithRetry } = 
    useConnectionError(options)

  const run = useCallback(() => {
    return executeWithRetry(operation)
  }, [executeWithRetry, operation])

  return {
    run,
    error,
    isLoading,
    isRetrying,
    retryCount,
    clearError
  }
}
