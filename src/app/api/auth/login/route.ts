import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json()

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: 'Email e senha são obrigatórios' },
        { status: 400 }
      )
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json(
        { success: false, error: 'Configuração do servidor incompleta' },
        { status: 500 }
      )
    }

    const cookieStore = await cookies()
    const supabase = createServerClient(
      supabaseUrl,
      supabaseAnonKey,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              )
            } catch {
              // Ignore cookie errors in API routes
            }
          },
        },
      }
    )

    // Authenticate with Supabase
    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (authError) {
      return NextResponse.json(
        { 
          success: false, 
          error: authError.message === 'Invalid login credentials'
            ? 'Email ou senha incorretos'
            : authError.message
        },
        { status: 401 }
      )
    }

    // Check if super admin
    const { data: superAdmin } = await supabase
      .from('super_admin_users')
      .select('id')
      .eq('email', email.toLowerCase())
      .maybeSingle()

    if (superAdmin) {
      return NextResponse.json({
        success: true,
        userType: 'super_admin',
        redirect: '/admin'
      })
    }

    // Check store user
    const { data: storeUser } = await supabase
      .from('store_users')
      .select('id, tenant_id, is_active')
      .eq('email', email.toLowerCase())
      .maybeSingle()

    if (storeUser && !storeUser.is_active) {
      await supabase.auth.signOut()
      return NextResponse.json(
        { success: false, error: 'Sua conta foi desativada' },
        { status: 403 }
      )
    }

    return NextResponse.json({
      success: true,
      userType: 'store_user',
      tenantId: storeUser?.tenant_id,
      redirect: '/dashboard'
    })

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido'
    console.error('Login error:', errorMessage)
    return NextResponse.json(
      { success: false, error: `Erro: ${errorMessage}` },
      { status: 500 }
    )
  }
}
