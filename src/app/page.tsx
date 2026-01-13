import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function Home() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Redirect authenticated users to appropriate dashboard
  if (user) {
    const email = user.email?.toLowerCase() || ''
    
    // Check if user is super admin
    const { data: superAdmin } = await supabase
      .from('super_admin_users')
      .select('id')
      .eq('email', email)
      .single()

    if (superAdmin) {
      redirect('/admin')
    } else {
      redirect('/dashboard')
    }
  }

  // Redirect unauthenticated users to login
  redirect('/login')
}
