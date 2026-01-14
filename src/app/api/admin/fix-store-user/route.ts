import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// This endpoint fixes tenants that were approved but store_user wasn't created
export async function POST(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    
    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    })

    const { tenantId, adminEmail } = await request.json()

    // Verify admin
    const { data: admin } = await supabaseAdmin
      .from('super_admin_users')
      .select('id')
      .eq('email', adminEmail.toLowerCase())
      .single()

    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // Get tenant
    const { data: tenant, error: tenantError } = await supabaseAdmin
      .from('tenants')
      .select('*')
      .eq('id', tenantId)
      .single()

    if (tenantError || !tenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })
    }

    // Check if store_user exists
    const { data: existingUser } = await supabaseAdmin
      .from('store_users')
      .select('id, email')
      .eq('email', tenant.owner_email.toLowerCase())
      .maybeSingle()

    if (existingUser) {
      return NextResponse.json({ 
        success: true, 
        message: 'Store user already exists',
        user: existingUser
      })
    }

    // Create store_user
    const { data: newUser, error: userError } = await supabaseAdmin
      .from('store_users')
      .insert({
        tenant_id: tenantId,
        email: tenant.owner_email.toLowerCase(),
        name: tenant.owner_name,
        role: 'owner',
        is_active: true
      })
      .select()
      .single()

    if (userError) {
      return NextResponse.json({ 
        error: 'Failed to create store user',
        details: userError.message,
        code: userError.code
      }, { status: 500 })
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Store user created',
      user: newUser
    })
  } catch (error) {
    console.error('Fix store user error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
