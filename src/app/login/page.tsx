'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createConnectionError, detectErrorType, isOnline } from '@/lib/errors/connection-error'

interface FormErrors {
  email?: string
  password?: string
  general?: string
}

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [errors, setErrors] = useState<FormErrors>({})
  const [loading, setLoading] = useState(false)

  // Validação de email
  const validateEmail = useCallback((email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email.trim())
  }, [])

  // Validação do formulário
  const validateForm = useCallback((): boolean => {
    const newErrors: FormErrors = {}

    if (!email.trim()) {
      newErrors.email = 'Email é obrigatório'
    } else if (!validateEmail(email)) {
      newErrors.email = 'Email inválido'
    }

    if (!password) {
      newErrors.password = 'Senha é obrigatória'
    } else if (password.length < 6) {
      newErrors.password = 'Senha deve ter pelo menos 6 caracteres'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }, [email, password, validateEmail])

  // Limpar erro quando o usuário digita
  const handleEmailChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value)
    if (errors.email) {
      setErrors(prev => ({ ...prev, email: undefined }))
    }
    if (errors.general) {
      setErrors(prev => ({ ...prev, general: undefined }))
    }
  }, [errors])

  const handlePasswordChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setPassword(e.target.value)
    if (errors.password) {
      setErrors(prev => ({ ...prev, password: undefined }))
    }
    if (errors.general) {
      setErrors(prev => ({ ...prev, general: undefined }))
    }
  }, [errors])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrors({})

    // Validação no cliente
    if (!validateForm()) {
      return
    }

    // Verificar se está online
    if (!isOnline()) {
      setErrors({
        general: 'Sem conexão com a internet. Verifique sua conexão e tente novamente.'
      })
      return
    }

    setLoading(true)

    try {
      // Criar AbortController para timeout
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 30000) // 30 segundos

      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        let result
        try {
          result = await response.json()
        } catch {
          const errorType = detectErrorType(new Error(`HTTP ${response.status}`))
          const connectionError = createConnectionError(new Error(`HTTP ${response.status}`))
          setErrors({ general: connectionError.userMessage })
          return
        }

        // Tratar diferentes tipos de erro
        const errorMessage = result.error || 'Erro ao fazer login'
        const errorType = detectErrorType(result)
        const connectionError = createConnectionError(result)

        // Mensagens específicas para rate limiting
        if (errorType === 'rate_limit' || errorMessage.includes('bloqueada') || errorMessage.includes('bloqueado')) {
          setErrors({ general: errorMessage })
        } else {
          setErrors({ general: connectionError.userMessage || errorMessage })
        }
        return
      }

      const result = await response.json()

      if (result.success) {
        // Pequeno delay para melhorar UX
        await new Promise(resolve => setTimeout(resolve, 300))
        router.push(result.redirect || '/dashboard')
        router.refresh()
      } else {
        setErrors({ general: result.error || 'Erro ao fazer login' })
      }
    } catch (error) {
      console.error('Login error:', error)

      // Tratar diferentes tipos de erro
      if (error instanceof DOMException && error.name === 'AbortError') {
        setErrors({
          general: 'A requisição demorou muito. Verifique sua conexão e tente novamente.'
        })
      } else {
        const connectionError = createConnectionError(error)
        setErrors({ general: connectionError.userMessage })
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h1 className="text-center text-3xl font-bold text-green-600">
            VerdurãoPro
          </h1>
          <h2 className="mt-6 text-center text-2xl font-semibold text-gray-900">
            Entrar na sua conta
          </h2>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit} noValidate>
          {errors.general && (
            <div 
              className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md animate-in fade-in slide-in-from-top-2"
              role="alert"
              aria-live="polite"
            >
              <div className="flex items-start">
                <svg 
                  className="w-5 h-5 mr-2 mt-0.5 flex-shrink-0" 
                  fill="currentColor" 
                  viewBox="0 0 20 20"
                  aria-hidden="true"
                >
                  <path 
                    fillRule="evenodd" 
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" 
                    clipRule="evenodd" 
                  />
                </svg>
                <span className="text-sm font-medium">{errors.general}</span>
              </div>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label 
                htmlFor="email" 
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={handleEmailChange}
                onBlur={() => {
                  if (email && !validateEmail(email)) {
                    setErrors(prev => ({ ...prev, email: 'Email inválido' }))
                  }
                }}
                aria-invalid={errors.email ? 'true' : 'false'}
                aria-describedby={errors.email ? 'email-error' : undefined}
                className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-0 text-gray-900 transition-colors ${
                  errors.email
                    ? 'border-red-300 focus:ring-red-500 focus:border-red-500'
                    : 'border-gray-300 focus:ring-green-500 focus:border-green-500'
                }`}
                placeholder="seu@email.com"
                disabled={loading}
              />
              {errors.email && (
                <p 
                  id="email-error" 
                  className="mt-1 text-sm text-red-600"
                  role="alert"
                >
                  {errors.email}
                </p>
              )}
            </div>

            <div>
              <label 
                htmlFor="password" 
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Senha
              </label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={handlePasswordChange}
                  aria-invalid={errors.password ? 'true' : 'false'}
                  aria-describedby={errors.password ? 'password-error' : undefined}
                  className={`mt-1 block w-full px-3 py-2 pr-10 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-0 text-gray-900 transition-colors ${
                    errors.password
                      ? 'border-red-300 focus:ring-red-500 focus:border-red-500'
                      : 'border-gray-300 focus:ring-green-500 focus:border-green-500'
                  }`}
                  placeholder="••••••••"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 focus:outline-none"
                  aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <svg 
                      className="h-5 w-5" 
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path 
                        strokeLinecap="round" 
                        strokeLinejoin="round" 
                        strokeWidth={2} 
                        d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" 
                      />
                    </svg>
                  ) : (
                    <svg 
                      className="h-5 w-5" 
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path 
                        strokeLinecap="round" 
                        strokeLinejoin="round" 
                        strokeWidth={2} 
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" 
                      />
                      <path 
                        strokeLinecap="round" 
                        strokeLinejoin="round" 
                        strokeWidth={2} 
                        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" 
                      />
                    </svg>
                  )}
                </button>
              </div>
              {errors.password && (
                <p 
                  id="password-error" 
                  className="mt-1 text-sm text-red-600"
                  role="alert"
                >
                  {errors.password}
                </p>
              )}
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
            style={{ minHeight: '56px' }}
            aria-busy={loading}
          >
            {loading ? (
              <>
                <svg 
                  className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" 
                  xmlns="http://www.w3.org/2000/svg" 
                  fill="none" 
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <circle 
                    className="opacity-25" 
                    cx="12" 
                    cy="12" 
                    r="10" 
                    stroke="currentColor" 
                    strokeWidth="4"
                  />
                  <path 
                    className="opacity-75" 
                    fill="currentColor" 
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Entrando...
              </>
            ) : (
              'Entrar'
            )}
          </button>

          <p className="text-center text-sm text-gray-600">
            Não tem uma conta?{' '}
            <Link 
              href="/register" 
              className="text-green-600 hover:text-green-500 font-medium focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 rounded"
            >
              Cadastre sua loja
            </Link>
          </p>
        </form>
      </div>
    </div>
  )
}
