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

  // Public routes that don't require authentication
  const publicRoutes = ['/login', '/register', '/auth', '/api/auth', '/tutorial', '/aguardando-aprovacao']
  const isPublicRoute = publicRoutes.some(route => 
    request.nextUrl.pathname === route || 
    request.nextUrl.pathname.startsWith(route + '/')
  )

  // Skip auth check for public routes - faster response
  if (isPublicRoute) {
    return supabaseResponse
  }

  // Refresh session only for protected routes
  const { data: { user } } = await supabase.auth.getUser()

  // Redirect unauthenticated users to login
  if (!user) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // For admin routes, just let them through - page will handle auth
  if (request.nextUrl.pathname.startsWith('/admin')) {
    return supabaseResponse
  }

  // For other protected routes, let the page handle detailed checks
  // This avoids multiple DB queries in middleware
  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|manifest.json|sw.js|icons/.*|.*\\.(?:svg|png|jpg|jpeg|gif|webp|json|js)$).*)',
  ],
}
