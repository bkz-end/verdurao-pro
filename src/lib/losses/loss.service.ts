import { SupabaseClient } from '@supabase/supabase-js'
import { Loss, LossReason, Product } from '@/types'

/**
 * Valid loss reasons
 * Requirements: 7.3
 */
export const VALID_LOSS_REASONS: LossReason[] = ['expiration', 'damage', 'theft', 'other']

/**
 * Input data for loss registration
 * Requirements: 7.1
 */
export interface LossInput {
  product_id: string
  quantity: number
  reason: LossReason
  notes?: string | null
}

/**
 * Validation error for loss operations
 */
export interface LossValidationError {
  field: string
  message: string
}

/**
 * Result of loss operations
 */
export type LossResult =
  | { success: true; loss: Loss }
  | { success: false; errors: LossValidationError[] }

/**
 * Filters for loss queries
 * Requirements: 7.4
 */
export interface LossFilters {
  reason?: LossReason
  startDate?: Date
  endDate?: Date
  productId?: string
}

/**
 * Loss report grouped by reason
 * Requirements: 7.4
 */
export interface LossReportByReason {
  reason: LossReason
  totalQuantity: number
  count: number
  losses: Loss[]
}

/**
 * Loss report result
 * Requirements: 7.4
 */
export interface LossReport {
  byReason: LossReportByReason[]
  totalQuantity: number
  totalCount: number
  startDate: Date
  endDate: Date
}

/**
 * Validates loss reason
 * Requirements: 7.3
 */
export function isValidLossReason(reason: string): reason is LossReason {
  return VALID_LOSS_REASONS.includes(reason as LossReason)
}

/**
 * Validates loss input
 * Requirements: 7.1, 7.3
 */
export function validateLossInput(input: Partial<LossInput>): LossValidationError[] {
  const errors: LossValidationError[] = []

  if (!input.product_id || input.product_id.trim() === '') {
    errors.push({
      field: 'product_id',
      message: 'Campo obrigatório: produto'
    })
  }

  if (input.quantity === undefined || input.quantity === null) {
    errors.push({
      field: 'quantity',
      message: 'Campo obrigatório: quantidade'
    })
  } else if (input.quantity <= 0) {
    errors.push({
      field: 'quantity',
      message: 'Quantidade deve ser maior que zero'
    })
  }

  if (!input.reason) {
    errors.push({
      field: 'reason',
      message: 'Campo obrigatório: motivo'
    })
  } else if (!isValidLossReason(input.reason)) {
    errors.push({
      field: 'reason',
      message: `Motivo inválido. Use: ${VALID_LOSS_REASONS.join(', ')}`
    })
  }

  return errors
}


/**
 * Data structure for loss insert operation
 * Requirements: 7.1
 */
export interface LossInsertData {
  tenant_id: string
  product_id: string
  user_id: string
  quantity: number
  reason: LossReason
  notes: string | null
}

/**
 * Prepares loss data for database insert
 * Requirements: 7.1
 */
export function prepareLossInsertData(
  input: LossInput,
  tenantId: string,
  userId: string
): LossInsertData {
  return {
    tenant_id: tenantId,
    product_id: input.product_id,
    user_id: userId,
    quantity: input.quantity,
    reason: input.reason,
    notes: input.notes ?? null
  }
}

/**
 * Groups losses by reason for reporting
 * Requirements: 7.4
 */
export function groupLossesByReason(losses: Loss[]): LossReportByReason[] {
  const grouped = new Map<LossReason, Loss[]>()

  for (const loss of losses) {
    const existing = grouped.get(loss.reason) || []
    existing.push(loss)
    grouped.set(loss.reason, existing)
  }

  const result: LossReportByReason[] = []

  for (const reason of VALID_LOSS_REASONS) {
    const reasonLosses = grouped.get(reason) || []
    if (reasonLosses.length > 0) {
      result.push({
        reason,
        totalQuantity: reasonLosses.reduce((sum, l) => sum + l.quantity, 0),
        count: reasonLosses.length,
        losses: reasonLosses
      })
    }
  }

  return result
}

/**
 * LossService - Manages loss registration and queries
 * Requirements: 7.1, 7.2, 7.3, 7.4
 */
export class LossService {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Records a loss and deducts from stock
   * Requirements: 7.1, 7.2, 7.3
   */
  async recordLoss(
    input: LossInput,
    tenantId: string,
    userId: string
  ): Promise<LossResult> {
    // Validate input
    const validationErrors = validateLossInput(input)
    if (validationErrors.length > 0) {
      return { success: false, errors: validationErrors }
    }

    // Verify product exists and belongs to tenant
    const { data: product, error: productError } = await this.supabase
      .from('products')
      .select('*')
      .eq('id', input.product_id)
      .eq('tenant_id', tenantId)
      .single()

    if (productError || !product) {
      return {
        success: false,
        errors: [{ field: 'product_id', message: 'Produto não encontrado' }]
      }
    }

    // Check if there's enough stock
    if ((product as Product).stock < input.quantity) {
      return {
        success: false,
        errors: [{ field: 'quantity', message: 'Estoque insuficiente para registrar perda' }]
      }
    }

    // Prepare insert data
    const insertData = prepareLossInsertData(input, tenantId, userId)

    // Insert loss record
    const { data: loss, error: lossError } = await this.supabase
      .from('losses')
      .insert(insertData)
      .select()
      .single()

    if (lossError) {
      return {
        success: false,
        errors: [{ field: 'general', message: lossError.message }]
      }
    }

    // Deduct from stock (Requirements: 7.2)
    const newStock = (product as Product).stock - input.quantity
    const { error: stockError } = await this.supabase
      .from('products')
      .update({
        stock: newStock,
        updated_at: new Date().toISOString()
      })
      .eq('id', input.product_id)
      .eq('tenant_id', tenantId)

    if (stockError) {
      // Rollback loss if stock update fails
      await this.supabase.from('losses').delete().eq('id', loss.id)
      return {
        success: false,
        errors: [{ field: 'general', message: 'Falha ao atualizar estoque' }]
      }
    }

    // Record stock history
    await this.supabase.from('stock_history').insert({
      product_id: input.product_id,
      quantity_change: -input.quantity,
      reason: 'loss',
      reference_id: loss.id
    })

    return { success: true, loss: loss as Loss }
  }

  /**
   * Gets losses with optional filters
   * Requirements: 7.4
   */
  async getLosses(tenantId: string, filters?: LossFilters): Promise<Loss[]> {
    let query = this.supabase
      .from('losses')
      .select('*')
      .eq('tenant_id', tenantId)

    if (filters?.reason) {
      query = query.eq('reason', filters.reason)
    }

    if (filters?.productId) {
      query = query.eq('product_id', filters.productId)
    }

    if (filters?.startDate) {
      query = query.gte('created_at', filters.startDate.toISOString())
    }

    if (filters?.endDate) {
      query = query.lte('created_at', filters.endDate.toISOString())
    }

    const { data, error } = await query.order('created_at', { ascending: false })

    if (error) {
      throw new Error(`Failed to fetch losses: ${error.message}`)
    }

    return (data || []) as Loss[]
  }

  /**
   * Gets loss report grouped by reason and period
   * Requirements: 7.4
   */
  async getLossesByReason(
    tenantId: string,
    startDate: Date,
    endDate: Date
  ): Promise<LossReport> {
    const losses = await this.getLosses(tenantId, { startDate, endDate })
    const byReason = groupLossesByReason(losses)

    return {
      byReason,
      totalQuantity: losses.reduce((sum, l) => sum + l.quantity, 0),
      totalCount: losses.length,
      startDate,
      endDate
    }
  }

  /**
   * Gets a loss by ID
   */
  async getLossById(lossId: string, tenantId: string): Promise<Loss | null> {
    const { data, error } = await this.supabase
      .from('losses')
      .select('*')
      .eq('id', lossId)
      .eq('tenant_id', tenantId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return null
      }
      throw new Error(`Failed to fetch loss: ${error.message}`)
    }

    return data as Loss
  }
}
