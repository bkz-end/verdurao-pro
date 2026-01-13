/**
 * Mercado Pago Integration Service
 * Requirements: 8.6 - Support payments via Mercado Pago, PIX and boleto
 */

import { SupabaseClient } from '@supabase/supabase-js'
import { Charge, PaymentMethod } from '@/types'

/**
 * Mercado Pago payment preference
 */
export interface MercadoPagoPreference {
  id: string
  init_point: string
  sandbox_init_point: string
}

/**
 * Mercado Pago payment data for PIX
 */
export interface PixPaymentData {
  qr_code: string
  qr_code_base64: string
  transaction_id: string
  expiration_date: string
}

/**
 * Mercado Pago payment data for Boleto
 */
export interface BoletoPaymentData {
  barcode: string
  external_resource_url: string
  transaction_id: string
  expiration_date: string
}

/**
 * Webhook payload from Mercado Pago
 */
export interface MercadoPagoWebhookPayload {
  id: string
  live_mode: boolean
  type: 'payment' | 'plan' | 'subscription' | 'invoice'
  date_created: string
  user_id: string
  api_version: string
  action: 'payment.created' | 'payment.updated'
  data: {
    id: string
  }
}

/**
 * Payment status from Mercado Pago
 */
export type MercadoPagoPaymentStatus = 
  | 'pending'
  | 'approved'
  | 'authorized'
  | 'in_process'
  | 'in_mediation'
  | 'rejected'
  | 'cancelled'
  | 'refunded'
  | 'charged_back'

/**
 * Payment details from Mercado Pago API
 */
export interface MercadoPagoPaymentDetails {
  id: string
  status: MercadoPagoPaymentStatus
  status_detail: string
  payment_method_id: string
  payment_type_id: 'credit_card' | 'debit_card' | 'ticket' | 'bank_transfer' | 'pix'
  external_reference: string
  transaction_amount: number
  date_approved: string | null
  date_created: string
  payer: {
    email: string
    identification?: {
      type: string
      number: string
    }
  }
}

/**
 * Result of creating a payment
 */
export interface CreatePaymentResult {
  success: boolean
  paymentData?: PixPaymentData | BoletoPaymentData
  error?: string
}

/**
 * Result of webhook processing
 */
export interface WebhookProcessResult {
  success: boolean
  chargeId?: string
  newStatus?: string
  error?: string
}

/**
 * Configuration for Mercado Pago
 */
export interface MercadoPagoConfig {
  accessToken: string
  publicKey: string
  webhookSecret?: string
  sandbox?: boolean
}

/**
 * Gets Mercado Pago configuration from environment
 */
export function getMercadoPagoConfig(): MercadoPagoConfig {
  const accessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN
  const publicKey = process.env.MERCADO_PAGO_PUBLIC_KEY
  const webhookSecret = process.env.MERCADO_PAGO_WEBHOOK_SECRET
  const sandbox = process.env.MERCADO_PAGO_SANDBOX === 'true'

  if (!accessToken) {
    throw new Error('MERCADO_PAGO_ACCESS_TOKEN is not configured')
  }

  if (!publicKey) {
    throw new Error('MERCADO_PAGO_PUBLIC_KEY is not configured')
  }

  return {
    accessToken,
    publicKey,
    webhookSecret,
    sandbox
  }
}

/**
 * Validates webhook signature from Mercado Pago
 */
export function validateWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  // Mercado Pago uses x-signature header with format: ts=timestamp,v1=hash
  // For production, implement proper HMAC validation
  // This is a simplified version for development
  if (!signature || !secret) {
    return false
  }

  const parts = signature.split(',')
  const signatureParts: Record<string, string> = {}
  
  for (const part of parts) {
    const [key, value] = part.split('=')
    if (key && value) {
      signatureParts[key] = value
    }
  }

  // In production, compute HMAC-SHA256 of ts.request_id.payload with secret
  // and compare with v1 value
  return signatureParts['v1'] !== undefined
}

/**
 * Maps Mercado Pago payment type to our PaymentMethod
 */
export function mapPaymentType(paymentTypeId: string): PaymentMethod {
  switch (paymentTypeId) {
    case 'pix':
      return 'pix'
    case 'ticket':
      return 'boleto'
    default:
      return 'mercado_pago'
  }
}

/**
 * MercadoPagoService - Handles Mercado Pago payment integration
 * Requirements: 8.6
 */
export class MercadoPagoService {
  private config: MercadoPagoConfig
  private baseUrl = 'https://api.mercadopago.com'

  constructor(
    private supabase: SupabaseClient,
    config?: MercadoPagoConfig
  ) {
    this.config = config || getMercadoPagoConfig()
  }

  /**
   * Creates a PIX payment for a charge
   * Requirements: 8.6
   */
  async createPixPayment(charge: Charge, payerEmail: string): Promise<CreatePaymentResult> {
    try {
      const response = await fetch(`${this.baseUrl}/v1/payments`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.accessToken}`,
          'Content-Type': 'application/json',
          'X-Idempotency-Key': `pix-${charge.id}`
        },
        body: JSON.stringify({
          transaction_amount: charge.amount,
          description: `VerdurãoPro - Mensalidade`,
          payment_method_id: 'pix',
          payer: {
            email: payerEmail
          },
          external_reference: charge.id,
          notification_url: this.getWebhookUrl()
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        return {
          success: false,
          error: errorData.message || 'Falha ao criar pagamento PIX'
        }
      }

      const paymentData = await response.json()

      // Extract PIX data from response
      const pixData: PixPaymentData = {
        qr_code: paymentData.point_of_interaction?.transaction_data?.qr_code || '',
        qr_code_base64: paymentData.point_of_interaction?.transaction_data?.qr_code_base64 || '',
        transaction_id: paymentData.id.toString(),
        expiration_date: paymentData.date_of_expiration || ''
      }

      // Store payment reference in database
      await this.storePaymentReference(charge.id, paymentData.id.toString(), 'pix')

      return {
        success: true,
        paymentData: pixData
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro ao criar pagamento PIX'
      }
    }
  }

  /**
   * Creates a Boleto payment for a charge
   * Requirements: 8.6
   */
  async createBoletoPayment(
    charge: Charge, 
    payerEmail: string,
    payerName: string,
    payerCpf: string
  ): Promise<CreatePaymentResult> {
    try {
      // Calculate expiration date (3 days from now)
      const expirationDate = new Date()
      expirationDate.setDate(expirationDate.getDate() + 3)

      const response = await fetch(`${this.baseUrl}/v1/payments`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.accessToken}`,
          'Content-Type': 'application/json',
          'X-Idempotency-Key': `boleto-${charge.id}`
        },
        body: JSON.stringify({
          transaction_amount: charge.amount,
          description: `VerdurãoPro - Mensalidade`,
          payment_method_id: 'bolbradesco', // Bradesco boleto
          payer: {
            email: payerEmail,
            first_name: payerName.split(' ')[0],
            last_name: payerName.split(' ').slice(1).join(' ') || payerName,
            identification: {
              type: 'CPF',
              number: payerCpf.replace(/\D/g, '')
            }
          },
          external_reference: charge.id,
          date_of_expiration: expirationDate.toISOString(),
          notification_url: this.getWebhookUrl()
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        return {
          success: false,
          error: errorData.message || 'Falha ao criar boleto'
        }
      }

      const paymentData = await response.json()

      // Extract boleto data from response
      const boletoData: BoletoPaymentData = {
        barcode: paymentData.barcode?.content || '',
        external_resource_url: paymentData.transaction_details?.external_resource_url || '',
        transaction_id: paymentData.id.toString(),
        expiration_date: paymentData.date_of_expiration || ''
      }

      // Store payment reference in database
      await this.storePaymentReference(charge.id, paymentData.id.toString(), 'boleto')

      return {
        success: true,
        paymentData: boletoData
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro ao criar boleto'
      }
    }
  }

  /**
   * Processes webhook notification from Mercado Pago
   * Requirements: 8.6
   */
  async processWebhook(
    payload: MercadoPagoWebhookPayload,
    signature?: string
  ): Promise<WebhookProcessResult> {
    // Validate signature if webhook secret is configured
    if (this.config.webhookSecret && signature) {
      const isValid = validateWebhookSignature(
        JSON.stringify(payload),
        signature,
        this.config.webhookSecret
      )
      if (!isValid) {
        return {
          success: false,
          error: 'Invalid webhook signature'
        }
      }
    }

    // Only process payment notifications
    if (payload.type !== 'payment') {
      return {
        success: true,
        error: 'Notification type not handled'
      }
    }

    try {
      // Get payment details from Mercado Pago
      const paymentDetails = await this.getPaymentDetails(payload.data.id)
      
      if (!paymentDetails) {
        return {
          success: false,
          error: 'Payment not found in Mercado Pago'
        }
      }

      // Get charge ID from external reference
      const chargeId = paymentDetails.external_reference
      if (!chargeId) {
        return {
          success: false,
          error: 'No charge reference in payment'
        }
      }

      // Process based on payment status
      if (paymentDetails.status === 'approved') {
        // Payment approved - update charge to paid
        const paymentMethod = mapPaymentType(paymentDetails.payment_type_id)
        
        const { error: updateError } = await this.supabase
          .from('charges')
          .update({
            status: 'paid',
            paid_at: paymentDetails.date_approved || new Date().toISOString(),
            payment_method: paymentMethod
          })
          .eq('id', chargeId)

        if (updateError) {
          return {
            success: false,
            error: `Failed to update charge: ${updateError.message}`
          }
        }

        // Reactivate tenant if suspended
        const { data: charge } = await this.supabase
          .from('charges')
          .select('tenant_id')
          .eq('id', chargeId)
          .single()

        if (charge) {
          await this.supabase
            .from('tenants')
            .update({ subscription_status: 'active' })
            .eq('id', charge.tenant_id)
            .eq('subscription_status', 'suspended')
        }

        return {
          success: true,
          chargeId,
          newStatus: 'paid'
        }
      }

      if (paymentDetails.status === 'rejected' || paymentDetails.status === 'cancelled') {
        // Payment failed - log but don't change charge status
        // Charge remains pending/overdue for retry
        return {
          success: true,
          chargeId,
          newStatus: paymentDetails.status
        }
      }

      // Other statuses (pending, in_process, etc.) - no action needed
      return {
        success: true,
        chargeId,
        newStatus: paymentDetails.status
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Webhook processing error'
      }
    }
  }

  /**
   * Gets payment details from Mercado Pago API
   */
  async getPaymentDetails(paymentId: string): Promise<MercadoPagoPaymentDetails | null> {
    try {
      const response = await fetch(`${this.baseUrl}/v1/payments/${paymentId}`, {
        headers: {
          'Authorization': `Bearer ${this.config.accessToken}`
        }
      })

      if (!response.ok) {
        return null
      }

      return await response.json()
    } catch {
      return null
    }
  }

  /**
   * Gets the webhook URL for notifications
   */
  private getWebhookUrl(): string {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.verduraopro.com.br'
    return `${baseUrl}/api/webhooks/mercado-pago`
  }

  /**
   * Stores payment reference for tracking
   */
  private async storePaymentReference(
    chargeId: string,
    mercadoPagoId: string,
    paymentType: 'pix' | 'boleto'
  ): Promise<void> {
    // Store in a metadata field or separate table
    // For now, we'll use the charge's payment_method field to track pending payments
    await this.supabase
      .from('charges')
      .update({
        // Store MP payment ID in a way we can track it
        // In production, consider a separate payment_attempts table
      })
      .eq('id', chargeId)
  }

  /**
   * Checks payment status directly with Mercado Pago
   * Useful for manual verification
   */
  async checkPaymentStatus(chargeId: string): Promise<{
    status: MercadoPagoPaymentStatus | 'not_found'
    details?: MercadoPagoPaymentDetails
  }> {
    // Search for payments with this charge as external reference
    try {
      const response = await fetch(
        `${this.baseUrl}/v1/payments/search?external_reference=${chargeId}`,
        {
          headers: {
            'Authorization': `Bearer ${this.config.accessToken}`
          }
        }
      )

      if (!response.ok) {
        return { status: 'not_found' }
      }

      const data = await response.json()
      
      if (!data.results || data.results.length === 0) {
        return { status: 'not_found' }
      }

      // Get the most recent payment
      const latestPayment = data.results[0]
      return {
        status: latestPayment.status,
        details: latestPayment
      }
    } catch {
      return { status: 'not_found' }
    }
  }
}
