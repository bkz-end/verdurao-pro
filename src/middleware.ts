import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/lib/supabase/config'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Refresh session
  const { data: { user } } = await supabase.auth.getUser()

  // Public routes that don't require authentication
  const publicRoutes = ['/login', '/register', '/auth', '/api/auth', '/tutorial', '/aguardando-aprovacao']
  const isPublicRoute = publicRoutes.some(route => 
    request.nextUrl.pathname === route || 
    request.nextUrl.pathname.startsWith(route + '/')
  )

  // Redirect unauthenticated users to login (except public routes)
  if (!user && !isPublicRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Redirect authenticated users away from login/register
  if (user && (request.nextUrl.pathname === '/login' || request.nextUrl.pathname === '/register')) {
    // Check if super admin
    const { data: superAdmin } = await supabase
      .from('super_admin_users')
      .select('id')
      .eq('email', user.email?.toLowerCase() || '')
      .maybeSingle()

    if (superAdmin) {
      const url = request.nextUrl.clone()
      url.pathname = '/admin'
      return NextResponse.redirect(url)
    }

    // Check tenant status
    const { data: tenant } = await supabase
      .from('tenants')
      .select('subscription_status')
      .eq('owner_email', user.email?.toLowerCase() || '')
      .maybeSingle()

    const url = request.nextUrl.clone()
    
    if (!tenant || tenant.subscription_status === 'pending') {
      url.pathname = '/aguardando-aprovacao'
    } else {
      url.pathname = '/dashboard'
    }
    
    return NextResponse.redirect(url)
  }

  // Check if user is trying to access protected routes without approval
  if (user && !isPublicRoute && !request.nextUrl.pathname.startsWith('/admin')) {
    // Check if super admin (they can access anything)
    const { data: superAdmin } = await supabase
      .from('super_admin_users')
      .select('id')
      .eq('email', user.email?.toLowerCase() || '')
      .maybeSingle()

    if (!superAdmin) {
      // Check tenant status
      const { data: tenant } = await supabase
        .from('tenants')
        .select('subscription_status')
        .eq('owner_email', user.email?.toLowerCase() || '')
        .maybeSingle()

      // Redirect pending users to waiting page
      if (!tenant || tenant.subscription_status === 'pending') {
        if (request.nextUrl.pathname !== '/aguardando-aprovacao') {
          const url = request.nextUrl.clone()
          url.pathname = '/aguardando-aprovacao'
          return NextResponse.redirect(url)
        }
      }
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
