import { NextRequest, NextResponse } from 'next/server'
import { login, LoginCredentials } from '@/lib/auth/actions'
import { checkRateLimit, recordFailedAttempt, recordSuccessfulLogin } from '@/lib/auth/rate-limiter'
import { createConnectionError, detectErrorType } from '@/lib/errors/connection-error'

/**
 * POST /api/auth/login
 * 
 * Handles user login requests.
 * Returns success status and redirect URL based on user type.
 * Includes rate limiting protection.
 */
export async function POST(request: NextRequest) {
  try {
    let body: LoginCredentials
    
    try {
      body = await request.json()
    } catch (error) {
      return NextResponse.json(
        { success: false, error: 'Formato de requisição inválido' },
        { status: 400 }
      )
    }
    
    // Validate required fields
    if (!body.email || !body.password) {
      return NextResponse.json(
        { success: false, error: 'Email e senha são obrigatórios' },
        { status: 400 }
      )
    }

    // Normalize email
    const normalizedEmail = body.email.trim().toLowerCase()

    // Check rate limit before attempting login
    const rateLimitCheck = checkRateLimit(normalizedEmail)
    if (!rateLimitCheck.allowed) {
      return NextResponse.json(
        { 
          success: false, 
          error: rateLimitCheck.error || 'Muitas tentativas. Tente novamente mais tarde.',
          rateLimit: {
            lockedUntil: rateLimitCheck.lockedUntil?.toISOString(),
            remainingAttempts: rateLimitCheck.remainingAttempts
          }
        },
        { status: 429 }
      )
    }

    // Call the login function
    const result = await login({ ...body, email: normalizedEmail })

    if (!result.success) {
      // Record failed attempt for rate limiting
      const rateLimitResult = recordFailedAttempt(normalizedEmail)
      
      // If account is now locked after this attempt
      if (!rateLimitResult.allowed) {
        return NextResponse.json(
          { 
            success: false, 
            error: rateLimitResult.error || 'Muitas tentativas falhas. Conta bloqueada temporariamente.',
            rateLimit: {
              lockedUntil: rateLimitResult.lockedUntil?.toISOString(),
              remainingAttempts: 0
            }
          },
          { status: 429 }
        )
      }

      // Return error with remaining attempts info
      const errorType = detectErrorType(result.error)
      const connectionError = createConnectionError(result.error || new Error(result.error || 'Login failed'))
      
      return NextResponse.json(
        { 
          success: false, 
          error: result.error || 'Erro ao fazer login',
          rateLimit: {
            remainingAttempts: rateLimitResult.remainingAttempts,
            lockedUntil: null
          },
          errorType: connectionError.type
        },
        { status: 401 }
      )
    }

    // Record successful login (clears rate limit)
    recordSuccessfulLogin(normalizedEmail)

    // Determine redirect URL based on user type
    let redirect = '/dashboard'
    if (result.userType === 'super_admin') {
      redirect = '/admin'
    } else if (result.userType === 'store_user') {
      redirect = '/dashboard'
    }

    return NextResponse.json({
      success: true,
      userType: result.userType,
      redirect,
      tenantId: result.tenantId
    })
  } catch (error) {
    console.error('[Login API] Error:', error)
    
    // Detect error type for better error messages
    const errorType = detectErrorType(error)
    const connectionError = createConnectionError(error)
    
    const statusCode = errorType === 'server' ? 500 : 
                      errorType === 'network' ? 503 : 
                      errorType === 'timeout' ? 504 : 500
    
    return NextResponse.json(
      { 
        success: false, 
        error: connectionError.userMessage || (error instanceof Error ? error.message : 'Erro ao processar login'),
        errorType: connectionError.type
      },
      { status: statusCode }
    )
  }
}