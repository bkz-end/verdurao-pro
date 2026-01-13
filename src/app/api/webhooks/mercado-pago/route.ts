/**
 * Mercado Pago Webhook Handler
 * Requirements: 8.6 - Configure webhook for payment confirmation
 * 
 * This endpoint receives payment notifications from Mercado Pago
 * and updates charge status accordingly.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { 
  MercadoPagoService, 
  MercadoPagoWebhookPayload 
} from '@/lib/billing/mercado-pago.service'

/**
 * Creates a Supabase admin client for webhook processing
 * Uses service role key for full database access
 */
function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase configuration')
  }

  return createClient(supabaseUrl, supabaseServiceKey)
}

/**
 * POST /api/webhooks/mercado-pago
 * 
 * Handles incoming webhook notifications from Mercado Pago.
 * Mercado Pago sends notifications for payment status changes.
 */
export async function POST(request: NextRequest) {
  try {
    // Get signature header for validation
    const signature = request.headers.get('x-signature') || undefined

    // Parse webhook payload
    const payload: MercadoPagoWebhookPayload = await request.json()

    // Log webhook receipt (for debugging)
    console.log('[Mercado Pago Webhook] Received:', {
      type: payload.type,
      action: payload.action,
      dataId: payload.data?.id,
      timestamp: new Date().toISOString()
    })

    // Validate required fields
    if (!payload.type || !payload.data?.id) {
      return NextResponse.json(
        { error: 'Invalid webhook payload' },
        { status: 400 }
      )
    }

    // Create admin client and service
    const supabase = createAdminClient()
    const mercadoPagoService = new MercadoPagoService(supabase)

    // Process the webhook
    const result = await mercadoPagoService.processWebhook(payload, signature)

    if (!result.success) {
      console.error('[Mercado Pago Webhook] Processing error:', result.error)
      
      // Return 200 to acknowledge receipt even on processing errors
      // This prevents Mercado Pago from retrying indefinitely
      return NextResponse.json({
        received: true,
        processed: false,
        error: result.error
      })
    }

    console.log('[Mercado Pago Webhook] Processed successfully:', {
      chargeId: result.chargeId,
      newStatus: result.newStatus
    })

    return NextResponse.json({
      received: true,
      processed: true,
      chargeId: result.chargeId,
      status: result.newStatus
    })
  } catch (error) {
    console.error('[Mercado Pago Webhook] Error:', error)
    
    // Return 200 to acknowledge receipt
    // Mercado Pago expects 200 response to stop retrying
    return NextResponse.json({
      received: true,
      processed: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

/**
 * GET /api/webhooks/mercado-pago
 * 
 * Health check endpoint for webhook configuration verification.
 * Mercado Pago may ping this endpoint to verify it's accessible.
 */
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'mercado-pago-webhook',
    timestamp: new Date().toISOString()
  })
}
