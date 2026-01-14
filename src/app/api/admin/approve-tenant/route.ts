import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Use service role key to bypass RLS
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export async function POST(request: NextRequest) {
  try {
    const { tenantId, adminEmail } = await request.json()

    if (!tenantId || !adminEmail) {
      return NextResponse.json({ error: 'Missing tenantId or adminEmail' }, { status: 400 })
    }

    // Verify admin is super admin
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

    if (tenant.subscription_status !== 'pending') {
      return NextResponse.json({ error: 'Tenant already processed' }, { status: 400 })
    }

    // Update tenant status
    const { error: updateError } = await supabaseAdmin
      .from('tenants')
      .update({
        approved_by_admin: true,
        subscription_status: 'active',
        approved_at: new Date().toISOString(),
        approved_by: admin.id
      })
      .eq('id', tenantId)

    if (updateError) {
      return NextResponse.json({ error: 'Failed to update tenant: ' + updateError.message }, { status: 500 })
    }

    // Create store_user for owner (using admin client to bypass RLS)
    const { error: userError } = await supabaseAdmin
      .from('store_users')
      .insert({
        tenant_id: tenantId,
        email: tenant.owner_email.toLowerCase(),
        name: tenant.owner_name,
        role: 'owner',
        is_active: true
      })

    if (userError) {
      // Rollback tenant status if user creation fails
      await supabaseAdmin
        .from('tenants')
        .update({ subscription_status: 'pending', approved_by_admin: false })
        .eq('id', tenantId)
      
      return NextResponse.json({ error: 'Failed to create store user: ' + userError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: 'Tenant approved successfully' })
  } catch (error) {
    console.error('Approve tenant error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
