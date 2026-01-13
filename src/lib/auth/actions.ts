'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { 
  checkRateLimit, 
  recordFailedAttempt, 
  recordSuccessfulLogin 
} from './rate-limiter'

export interface LoginCredentials {
  email: string
  password: string
  tenantId?: string // Optional: for store user login
}

export interface SignUpCredentials {
  email: string
  password: string
  name: string
}

export interface AuthResult {
  success: boolean
  error?: string
  userType?: 'super_admin' | 'store_user'
  tenantId?: string
}

/**
 * Checks if a store user is active
 * Requirements: 10.2 - Block access immediately after deactivation
 */
async function checkStoreUserActive(supabase: Awaited<ReturnType<typeof createClient>>, email: string): Promise<{ isActive: boolean; tenantId?: string; error?: string }> {
  // Check if user exists in store_users table
  const { data: storeUser, error } = await supabase
    .from('store_users')
    .select('id, tenant_id, is_active')
    .eq('email', email.toLowerCase())
    .single()

  if (error) {
    // User might be a super admin or not in store_users
    if (error.code === 'PGRST116') {
      return { isActive: true } // Not a store user, allow login
    }
    return { isActive: false, error: error.message }
  }

  if (!storeUser.is_active) {
    return { 
      isActive: false, 
      error: 'Sua conta foi desativada. Entre em contato com o administrador da loja.' 
    }
  }

  return { isActive: true, tenantId: storeUser.tenant_id }
}

export async function login(credentials: LoginCredentials): Promise<AuthResult> {
  const supabase = await createClient()

  // First, authenticate with Supabase Auth
  const { error: authError } = await supabase.auth.signInWithPassword({
    email: credentials.email,
    password: credentials.password,
  })

  if (authError) {
    return {
      success: false,
      error: authError.message === 'Invalid login credentials'
        ? 'Email ou senha incorretos'
        : authError.message,
    }
  }

  // Check if user is a super admin
  const { data: superAdmin } = await supabase
    .from('super_admin_users')
    .select('id')
    .eq('email', credentials.email.toLowerCase())
    .maybeSingle()

  if (superAdmin) {
    return { success: true, userType: 'super_admin' }
  }

  // Check if store user exists and is active
  const { data: storeUser } = await supabase
    .from('store_users')
    .select('id, tenant_id, is_active')
    .eq('email', credentials.email.toLowerCase())
    .maybeSingle()

  if (storeUser && !storeUser.is_active) {
    await supabase.auth.signOut()
    return {
      success: false,
      error: 'Sua conta foi desativada. Entre em contato com o administrador.',
    }
  }

  return { 
    success: true, 
    userType: 'store_user',
    tenantId: storeUser?.tenant_id 
  }
}

export async function signUp(credentials: SignUpCredentials): Promise<AuthResult> {
  const supabase = await createClient()

  const { error } = await supabase.auth.signUp({
    email: credentials.email,
    password: credentials.password,
    options: {
      data: {
        name: credentials.name,
      },
    },
  })

  if (error) {
    return {
      success: false,
      error: error.message,
    }
  }

  return { success: true }
}

export async function logout(): Promise<void> {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}

export async function resetPassword(email: string): Promise<AuthResult> {
  const supabase = await createClient()

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/reset-password`,
  })

  if (error) {
    return {
      success: false,
      error: error.message,
    }
  }

  return { success: true }
}

export async function updatePassword(newPassword: string): Promise<AuthResult> {
  const supabase = await createClient()

  const { error } = await supabase.auth.updateUser({
    password: newPassword,
  })

  if (error) {
    return {
      success: false,
      error: error.message,
    }
  }

  return { success: true }
}

export async function getCurrentUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export async function getCurrentSession() {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  return session
}
