import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { SubscriptionStatus } from '@/types'

/**
 * Checks if a subscription status allows access
 * Requirements: 13.3 - Suspended tenants have data preserved but access blocked
 */
function isAccessibleStatus(status: SubscriptionStatus): boolean {
  return status === 'active'
}

/**
 * Gets the error message for a given subscription status
 */
function getStatusErrorMessage(status: SubscriptionStatus): string {
  switch (status) {
    case 'suspended':
      return 'tenant_suspended'
    case 'cancelled':
      return 'tenant_cancelled'
    case 'pending':
      return 'tenant_pending'
    default:
      return 'access_denied'
  }
}

/**
 * Validates tenant access and returns tenant context
 * Requirements: 13.2 - Validate access based on session
 */
async function validateTenantAccess(
  supabase: ReturnType<typeof createServerClient>,
  email: string
): Promise<{
  isValid: boolean
  tenantId?: string
  error?: string
  isSuperAdmin?: boolean
}> {
  // Check if user is a super admin (they bypass store user checks)
  const { data: superAdmin } = await supabase
    .from('super_admin_users')
    .select('id')
    .eq('email', email)
    .single()

  if (superAdmin) {
    return { isValid: true, isSuperAdmin: true }
  }

  // Check store_users table for tenant context
  const { data: storeUser } = await supabase
    .from('store_users')
    .select('id, tenant_id, is_active')
    .eq('email', email)
    .single()

  if (!storeUser) {
    return { isValid: false, error: 'user_not_found' }
  }

  // Check if user is deactivated
  // Requirements: 10.2 - Block access immediately after deactivation
  if (!storeUser.is_active) {
    return { isValid: false, error: 'account_deactivated' }
  }

  // Check tenant status
  // Requirements: 13.3 - Block access for suspended tenants
  const { data: tenant } = await supabase
    .from('tenants')
    .select('id, subscription_status')
    .eq('id', storeUser.tenant_id)
    .single()

  if (!tenant) {
    return { isValid: false, error: 'tenant_not_found' }
  }

  if (!isAccessibleStatus(tenant.subscription_status as SubscriptionStatus)) {
    return {
      isValid: false,
      error: getStatusErrorMessage(tenant.subscription_status as SubscriptionStatus)
    }
  }

  return { isValid: true, tenantId: storeUser.tenant_id, isSuperAdmin: false }
}

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Refresh session if expired
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Define public routes that don't require authentication
  const publicRoutes = ['/login', '/register', '/auth/callback', '/tutorial']
  const isPublicRoute = publicRoutes.some(
    (route) => request.nextUrl.pathname === route || request.nextUrl.pathname.startsWith('/auth/')
  )

  // Define admin routes (only accessible by super admins)
  const isAdminRoute = request.nextUrl.pathname.startsWith('/admin')

  // Define API routes that need tenant context
  const isApiRoute = request.nextUrl.pathname.startsWith('/api/')

  // Redirect unauthenticated users to login
  if (!user && !isPublicRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Check if authenticated user has valid tenant access
  // Requirements: 10.2 - Block access immediately after deactivation
  // Requirements: 13.2 - Validate access based on session
  // Requirements: 13.3 - Block access for suspended tenants
  if (user && !isPublicRoute) {
    const email = user.email?.toLowerCase() || ''

    // Validate tenant access using the helper function
    const accessResult = await validateTenantAccess(supabase, email)

    if (accessResult.isSuperAdmin) {
      // Super admin - allow access to admin routes, set header
      supabaseResponse.headers.set('x-is-super-admin', 'true')
      
      // If super admin is trying to access non-admin routes, redirect to admin
      if (!isAdminRoute && request.nextUrl.pathname !== '/') {
        const url = request.nextUrl.clone()
        url.pathname = '/admin'
        return NextResponse.redirect(url)
      }
      
      return supabaseResponse
    }

    // Not a super admin - block access to admin routes
    // Requirements: 13.2 - Validate access based on session
    if (isAdminRoute) {
      const url = request.nextUrl.clone()
      url.pathname = '/dashboard'
      return NextResponse.redirect(url)
    }

    // Check if access is valid
    if (!accessResult.isValid) {
      await supabase.auth.signOut()
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      url.searchParams.set('error', accessResult.error || 'access_denied')
      return NextResponse.redirect(url)
    }

    // Set tenant context in response headers for downstream use
    // Requirements: 13.2 - Inject tenant_id in all queries
    if (accessResult.tenantId) {
      supabaseResponse.headers.set('x-tenant-id', accessResult.tenantId)
      
      // For API routes, also set a cookie for easier access in server components
      if (isApiRoute) {
        supabaseResponse.cookies.set('x-tenant-id', accessResult.tenantId, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict',
          path: '/'
        })
      }
    }
  }

  // Redirect authenticated users away from login/register
  if (user && (request.nextUrl.pathname === '/login' || request.nextUrl.pathname === '/register')) {
    const email = user.email?.toLowerCase() || ''
    
    // Check if user is super admin
    const { data: superAdmin } = await supabase
      .from('super_admin_users')
      .select('id')
      .eq('email', email)
      .single()

    const url = request.nextUrl.clone()
    url.pathname = superAdmin ? '/admin' : '/dashboard'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
