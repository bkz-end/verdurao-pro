import { NextRequest, NextResponse } from 'next/server'
import { login, LoginCredentials } from '@/lib/auth/actions'

/**
 * POST /api/auth/login
 * 
 * Handles user login requests.
 * Returns success status and redirect URL based on user type.
 */
export async function POST(request: NextRequest) {
  try {
    const body: LoginCredentials = await request.json()
    
    // Validate required fields
    if (!body.email || !body.password) {
      return NextResponse.json(
        { success: false, error: 'Email e senha são obrigatórios' },
        { status: 400 }
      )
    }

    // Call the login function
    const result = await login(body)

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error || 'Erro ao fazer login' },
        { status: 401 }
      )
    }

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
    
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Erro ao processar login'
      },
      { status: 500 }
    )
  }
}