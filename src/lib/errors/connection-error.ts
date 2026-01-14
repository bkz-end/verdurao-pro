/**
 * Connection Error Handler
 * 
 * Tratamento centralizado de erros de conexão com:
 * - Detecção automática de tipo de erro
 * - Retry com exponential backoff
 * - Mensagens amigáveis em português
 */

export type ConnectionErrorType = 
  | 'network'      // Sem internet
  | 'timeout'      // Timeout
  | 'server'       // Erro do servidor (5xx)
  | 'auth'         // Erro de autenticação
  | 'rate_limit'   // Rate limiting
  | 'unknown'      // Erro desconhecido

export interface ConnectionError {
  type: ConnectionErrorType
  message: string
  userMessage: string
  retryable: boolean
  retryAfter?: number // segundos
  originalError?: unknown
}

/**
 * Mensagens amigáveis para cada tipo de erro
 */
const ERROR_MESSAGES: Record<ConnectionErrorType, { title: string; description: string }> = {
  network: {
    title: 'Sem conexão',
    description: 'Verifique sua internet e tente novamente.'
  },
  timeout: {
    title: 'Conexão lenta',
    description: 'O servidor demorou para responder. Tente novamente.'
  },
  server: {
    title: 'Erro no servidor',
    description: 'Estamos com problemas técnicos. Tente novamente em alguns minutos.'
  },
  auth: {
    title: 'Sessão expirada',
    description: 'Faça login novamente para continuar.'
  },
  rate_limit: {
    title: 'Muitas requisições',
    description: 'Aguarde um momento antes de tentar novamente.'
  },
  unknown: {
    title: 'Erro inesperado',
    description: 'Algo deu errado. Tente novamente.'
  }
}

/**
 * Detecta o tipo de erro baseado na resposta/exceção
 */
export function detectErrorType(error: unknown): ConnectionErrorType {
  // Erro de rede (fetch failed, no internet)
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return 'network'
  }

  // Verificar se é um erro do Supabase/PostgreSQL
  if (error && typeof error === 'object') {
    const err = error as Record<string, unknown>
    
    // Erro de conexão do Supabase
    if (err.code === 'PGRST301' || err.code === 'ECONNREFUSED') {
      return 'network'
    }

    // Timeout
    if (err.code === 'ETIMEDOUT' || err.code === 'ESOCKETTIMEDOUT') {
      return 'timeout'
    }

    // Rate limiting
    if (err.code === '429' || err.status === 429) {
      return 'rate_limit'
    }

    // Auth errors
    if (err.code === 'PGRST401' || err.status === 401 || err.code === 'invalid_token') {
      return 'auth'
    }

    // Server errors
    const status = err.status as number
    if (status >= 500 && status < 600) {
      return 'server'
    }

    // Supabase specific errors
    if (err.message && typeof err.message === 'string') {
      const msg = err.message.toLowerCase()
      if (msg.includes('network') || msg.includes('connection') || msg.includes('offline')) {
        return 'network'
      }
      if (msg.includes('timeout')) {
        return 'timeout'
      }
      if (msg.includes('jwt') || msg.includes('token') || msg.includes('auth')) {
        return 'auth'
      }
    }
  }

  // AbortError (timeout via AbortController)
  if (error instanceof DOMException && error.name === 'AbortError') {
    return 'timeout'
  }

  return 'unknown'
}

/**
 * Cria um objeto ConnectionError padronizado
 */
export function createConnectionError(error: unknown): ConnectionError {
  const type = detectErrorType(error)
  const messages = ERROR_MESSAGES[type]

  return {
    type,
    message: messages.title,
    userMessage: messages.description,
    retryable: type !== 'auth',
    retryAfter: type === 'rate_limit' ? 30 : undefined,
    originalError: error
  }
}

/**
 * Verifica se o navegador está online
 */
export function isOnline(): boolean {
  return typeof navigator !== 'undefined' ? navigator.onLine : true
}

/**
 * Configuração de retry
 */
export interface RetryConfig {
  maxRetries?: number
  baseDelay?: number      // ms
  maxDelay?: number       // ms
  onRetry?: (attempt: number, error: ConnectionError) => void
}

const DEFAULT_RETRY_CONFIG: Required<Omit<RetryConfig, 'onRetry'>> = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 10000
}

/**
 * Calcula delay com exponential backoff + jitter
 */
function calculateDelay(attempt: number, config: Required<Omit<RetryConfig, 'onRetry'>>): number {
  const exponentialDelay = config.baseDelay * Math.pow(2, attempt)
  const jitter = Math.random() * 0.3 * exponentialDelay // 30% jitter
  return Math.min(exponentialDelay + jitter, config.maxDelay)
}

/**
 * Executa uma função com retry automático em caso de erro de conexão
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  config: RetryConfig = {}
): Promise<T> {
  const { maxRetries, baseDelay, maxDelay } = { ...DEFAULT_RETRY_CONFIG, ...config }
  const { onRetry } = config

  let lastError: ConnectionError | null = null

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // Verifica se está online antes de tentar
      if (!isOnline()) {
        throw new Error('No network connection')
      }

      return await fn()
    } catch (error) {
      lastError = createConnectionError(error)

      // Não faz retry se não for retryable ou se for o último attempt
      if (!lastError.retryable || attempt === maxRetries) {
        throw lastError
      }

      // Callback de retry
      onRetry?.(attempt + 1, lastError)

      // Aguarda antes do próximo retry
      const delay = lastError.retryAfter 
        ? lastError.retryAfter * 1000 
        : calculateDelay(attempt, { maxRetries, baseDelay, maxDelay })
      
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }

  throw lastError
}

/**
 * Wrapper para operações do Supabase com tratamento de erro
 */
export async function safeSupabaseCall<T>(
  operation: () => Promise<{ data: T | null; error: unknown }>,
  config?: RetryConfig
): Promise<{ data: T | null; error: ConnectionError | null }> {
  try {
    const result = await withRetry(async () => {
      const { data, error } = await operation()
      if (error) throw error
      return data
    }, config)

    return { data: result, error: null }
  } catch (error) {
    if ((error as ConnectionError).type) {
      return { data: null, error: error as ConnectionError }
    }
    return { data: null, error: createConnectionError(error) }
  }
}
