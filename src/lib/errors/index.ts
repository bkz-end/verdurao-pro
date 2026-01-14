/**
 * Error handling exports
 */

export {
  type ConnectionErrorType,
  type ConnectionError,
  type RetryConfig,
  detectErrorType,
  createConnectionError,
  isOnline,
  withRetry,
  safeSupabaseCall
} from './connection-error'
