/**
 * Tests for Mercado Pago Service
 * Requirements: 8.6
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  validateWebhookSignature,
  mapPaymentType,
  MercadoPagoService,
  MercadoPagoWebhookPayload,
  MercadoPagoConfig
} from './mercado-pago.service'
import { Charge } from '@/types'

// Mock fetch globally
const mockFetch = vi.fn()
global.fetch = mockFetch

// Mock Supabase client
const mockSupabase = {
  from: vi.fn(() => ({
    update: vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ error: null }))
      }))
    })),
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        single: vi.fn(() => Promise.resolve({ 
          data: { tenant_id: 'tenant-123' }, 
          error: null 
        }))
      }))
    }))
  }))
}

const testConfig: MercadoPagoConfig = {
  accessToken: 'TEST-access-token',
  publicKey: 'TEST-public-key',
  webhookSecret: 'test-secret',
  sandbox: true
}

describe('Mercado Pago Service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('mapPaymentType', () => {
    it('should map pix payment type correctly', () => {
      expect(mapPaymentType('pix')).toBe('pix')
    })

    it('should map ticket (boleto) payment type correctly', () => {
      expect(mapPaymentType('ticket')).toBe('boleto')
    })

    it('should map other payment types to mercado_pago', () => {
      expect(mapPaymentType('credit_card')).toBe('mercado_pago')
      expect(mapPaymentType('debit_card')).toBe('mercado_pago')
      expect(mapPaymentType('bank_transfer')).toBe('mercado_pago')
    })
  })

  describe('validateWebhookSignature', () => {
    it('should return false for empty signature', () => {
      expect(validateWebhookSignature('payload', '', 'secret')).toBe(false)
    })

    it('should return false for empty secret', () => {
      expect(validateWebhookSignature('payload', 'ts=123,v1=abc', '')).toBe(false)
    })

    it('should return true for valid signature format', () => {
      expect(validateWebhookSignature('payload', 'ts=123,v1=abc123', 'secret')).toBe(true)
    })

    it('should return false for invalid signature format', () => {
      expect(validateWebhookSignature('payload', 'invalid', 'secret')).toBe(false)
    })
  })

  describe('MercadoPagoService', () => {
    let service: MercadoPagoService

    beforeEach(() => {
      service = new MercadoPagoService(mockSupabase as any, testConfig)
    })

    describe('createPixPayment', () => {
      const mockCharge: Charge = {
        id: 'charge-123',
        tenant_id: 'tenant-123',
        amount: 97.90,
        due_date: '2026-02-01',
        status: 'pending',
        paid_at: null,
        payment_method: null,
        created_at: '2026-01-25T00:00:00Z'
      }

      it('should create PIX payment successfully', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            id: 'mp-payment-123',
            point_of_interaction: {
              transaction_data: {
                qr_code: '00020126580014br.gov.bcb.pix...',
                qr_code_base64: 'base64encodedqrcode'
              }
            },
            date_of_expiration: '2026-01-26T23:59:59Z'
          })
        })

        const result = await service.createPixPayment(mockCharge, 'test@example.com')

        expect(result.success).toBe(true)
        expect(result.paymentData).toBeDefined()
        expect((result.paymentData as any).qr_code).toBe('00020126580014br.gov.bcb.pix...')
        expect((result.paymentData as any).transaction_id).toBe('mp-payment-123')
      })

      it('should handle PIX payment creation error', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          json: () => Promise.resolve({
            message: 'Invalid access token'
          })
        })

        const result = await service.createPixPayment(mockCharge, 'test@example.com')

        expect(result.success).toBe(false)
        expect(result.error).toBe('Invalid access token')
      })

      it('should handle network errors', async () => {
        mockFetch.mockRejectedValueOnce(new Error('Network error'))

        const result = await service.createPixPayment(mockCharge, 'test@example.com')

        expect(result.success).toBe(false)
        expect(result.error).toBe('Network error')
      })
    })

    describe('createBoletoPayment', () => {
      const mockCharge: Charge = {
        id: 'charge-456',
        tenant_id: 'tenant-123',
        amount: 97.90,
        due_date: '2026-02-01',
        status: 'pending',
        paid_at: null,
        payment_method: null,
        created_at: '2026-01-25T00:00:00Z'
      }

      it('should create boleto payment successfully', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            id: 'mp-payment-456',
            barcode: {
              content: '23793.38128 60000.000003 00000.000400 1 84340000009790'
            },
            transaction_details: {
              external_resource_url: 'https://www.mercadopago.com.br/payments/456/ticket'
            },
            date_of_expiration: '2026-01-28T23:59:59Z'
          })
        })

        const result = await service.createBoletoPayment(
          mockCharge, 
          'test@example.com',
          'João Silva',
          '123.456.789-00'
        )

        expect(result.success).toBe(true)
        expect(result.paymentData).toBeDefined()
        expect((result.paymentData as any).barcode).toBe('23793.38128 60000.000003 00000.000400 1 84340000009790')
        expect((result.paymentData as any).transaction_id).toBe('mp-payment-456')
      })

      it('should handle boleto creation error', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          json: () => Promise.resolve({
            message: 'Invalid CPF'
          })
        })

        const result = await service.createBoletoPayment(
          mockCharge,
          'test@example.com',
          'João Silva',
          'invalid-cpf'
        )

        expect(result.success).toBe(false)
        expect(result.error).toBe('Invalid CPF')
      })
    })

    describe('processWebhook', () => {
      it('should process approved payment webhook', async () => {
        const payload: MercadoPagoWebhookPayload = {
          id: 'webhook-123',
          live_mode: false,
          type: 'payment',
          date_created: '2026-01-25T10:00:00Z',
          user_id: 'user-123',
          api_version: 'v1',
          action: 'payment.updated',
          data: { id: 'payment-123' }
        }

        // Mock getPaymentDetails
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            id: 'payment-123',
            status: 'approved',
            status_detail: 'accredited',
            payment_method_id: 'pix',
            payment_type_id: 'pix',
            external_reference: 'charge-123',
            transaction_amount: 97.90,
            date_approved: '2026-01-25T10:05:00Z',
            date_created: '2026-01-25T10:00:00Z',
            payer: { email: 'test@example.com' }
          })
        })

        const result = await service.processWebhook(payload)

        expect(result.success).toBe(true)
        expect(result.chargeId).toBe('charge-123')
        expect(result.newStatus).toBe('paid')
      })

      it('should handle rejected payment webhook', async () => {
        const payload: MercadoPagoWebhookPayload = {
          id: 'webhook-456',
          live_mode: false,
          type: 'payment',
          date_created: '2026-01-25T10:00:00Z',
          user_id: 'user-123',
          api_version: 'v1',
          action: 'payment.updated',
          data: { id: 'payment-456' }
        }

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            id: 'payment-456',
            status: 'rejected',
            status_detail: 'cc_rejected_insufficient_amount',
            payment_method_id: 'pix',
            payment_type_id: 'pix',
            external_reference: 'charge-456',
            transaction_amount: 97.90,
            date_approved: null,
            date_created: '2026-01-25T10:00:00Z',
            payer: { email: 'test@example.com' }
          })
        })

        const result = await service.processWebhook(payload)

        expect(result.success).toBe(true)
        expect(result.chargeId).toBe('charge-456')
        expect(result.newStatus).toBe('rejected')
      })

      it('should ignore non-payment webhooks', async () => {
        const payload: MercadoPagoWebhookPayload = {
          id: 'webhook-789',
          live_mode: false,
          type: 'subscription',
          date_created: '2026-01-25T10:00:00Z',
          user_id: 'user-123',
          api_version: 'v1',
          action: 'payment.created',
          data: { id: 'sub-123' }
        }

        const result = await service.processWebhook(payload)

        expect(result.success).toBe(true)
        expect(result.error).toBe('Notification type not handled')
      })

      it('should handle payment not found', async () => {
        const payload: MercadoPagoWebhookPayload = {
          id: 'webhook-999',
          live_mode: false,
          type: 'payment',
          date_created: '2026-01-25T10:00:00Z',
          user_id: 'user-123',
          api_version: 'v1',
          action: 'payment.updated',
          data: { id: 'nonexistent-payment' }
        }

        mockFetch.mockResolvedValueOnce({
          ok: false
        })

        const result = await service.processWebhook(payload)

        expect(result.success).toBe(false)
        expect(result.error).toBe('Payment not found in Mercado Pago')
      })
    })

    describe('getPaymentDetails', () => {
      it('should fetch payment details successfully', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            id: 'payment-123',
            status: 'approved',
            external_reference: 'charge-123'
          })
        })

        const details = await service.getPaymentDetails('payment-123')

        expect(details).toBeDefined()
        expect(details?.id).toBe('payment-123')
        expect(details?.status).toBe('approved')
      })

      it('should return null for non-existent payment', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false
        })

        const details = await service.getPaymentDetails('nonexistent')

        expect(details).toBeNull()
      })
    })

    describe('checkPaymentStatus', () => {
      it('should check payment status by charge ID', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            results: [{
              id: 'payment-123',
              status: 'approved',
              external_reference: 'charge-123'
            }]
          })
        })

        const result = await service.checkPaymentStatus('charge-123')

        expect(result.status).toBe('approved')
        expect(result.details).toBeDefined()
      })

      it('should return not_found when no payments exist', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            results: []
          })
        })

        const result = await service.checkPaymentStatus('charge-999')

        expect(result.status).toBe('not_found')
      })
    })
  })
})
