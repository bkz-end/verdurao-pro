import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * POST /api/checkout
 * Creates a Mercado Pago checkout preference for subscription
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    // Get store user and tenant
    const { data: storeUser } = await supabase
      .from('store_users')
      .select('tenant_id')
      .eq('email', user.email?.toLowerCase())
      .single()

    if (!storeUser) {
      return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })
    }

    const { data: tenant } = await supabase
      .from('tenants')
      .select('id, store_name, owner_email, monthly_price')
      .eq('id', storeUser.tenant_id)
      .single()

    if (!tenant) {
      return NextResponse.json({ error: 'Loja não encontrada' }, { status: 404 })
    }

    // Create Mercado Pago preference
    const accessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN
    console.log('Access token exists:', !!accessToken)
    console.log('Access token length:', accessToken?.length)
    
    if (!accessToken) {
      console.error('MERCADO_PAGO_ACCESS_TOKEN not found in environment')
      return NextResponse.json({ error: 'Mercado Pago não configurado' }, { status: 500 })
    }

    // Use hardcoded production URL to avoid any env var issues
    const baseUrl = 'https://verdurao-pro.vercel.app'

    const preference = {
      items: [
        {
          id: `subscription-${tenant.id}`,
          title: 'FeiraPro - Assinatura Mensal',
          description: `Assinatura mensal do FeiraPro para ${tenant.store_name}`,
          quantity: 1,
          currency_id: 'BRL',
          unit_price: tenant.monthly_price || 45.90
        }
      ],
      payer: {
        email: tenant.owner_email
      },
      back_urls: {
        success: baseUrl + '/assinatura',
        failure: baseUrl + '/assinatura',
        pending: baseUrl + '/assinatura'
      },
      auto_return: 'approved',
      external_reference: tenant.id,
      notification_url: baseUrl + '/api/webhooks/mercado-pago',
      statement_descriptor: 'FEIRAPRO'
    }

    console.log('Creating preference with:', JSON.stringify(preference, null, 2))

    const response = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(preference)
    })

    const responseText = await response.text()
    console.log('Mercado Pago response status:', response.status)
    console.log('Mercado Pago response:', responseText)

    if (!response.ok) {
      let errorData
      try {
        errorData = JSON.parse(responseText)
      } catch {
        errorData = { message: responseText }
      }
      console.error('Mercado Pago API error:', JSON.stringify(errorData, null, 2))
      return NextResponse.json({ 
        error: 'Erro ao criar checkout', 
        details: errorData.message || errorData.error || 'Unknown error'
      }, { status: 500 })
    }

    const data = JSON.parse(responseText)

    // Return the checkout URL - prefer init_point (production), fallback to sandbox
    const checkoutUrl = data.init_point || data.sandbox_init_point

    if (!checkoutUrl) {
      console.error('No checkout URL returned:', data)
      return NextResponse.json({ error: 'URL de checkout não disponível' }, { status: 500 })
    }

    return NextResponse.json({
      checkoutUrl,
      preferenceId: data.id
    })

  } catch (error) {
    console.error('Checkout error:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
