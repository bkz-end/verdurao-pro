import { SupabaseClient } from '@supabase/supabase-js'
import { Charge, ChargeStatus, PaymentMethod, Tenant } from '@/types'

/**
 * Input for creating a charge
 */
export interface ChargeInput {
  tenant_id: string
  amount: number
  due_date: string
}

/**
 * Result of charge generation
 */
export interface ChargeGenerationResult {
  success: boolean
  chargesCreated: number
  errors: string[]
}

/**
 * Result of status update operation
 */
export interface StatusUpdateResult {
  success: boolean
  updatedCount: number
  suspendedCount: number
  errors: string[]
}

/**
 * Payment processing result
 */
export interface PaymentResult {
  success: boolean
  charge?: Charge
  error?: string
}

/**
 * Calculates the due date for the next month's charge
 * Charges are due on the 1st of the next month
 * Requirements: 8.1
 */
export function calculateNextMonthDueDate(fromDate: Date = new Date()): string {
  const nextMonth = new Date(fromDate)
  nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1)
  nextMonth.setUTCDate(1)
  
  const year = nextMonth.getUTCFullYear()
  const month = String(nextMonth.getUTCMonth() + 1).padStart(2, '0')
  const day = String(nextMonth.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Determines the new tenant status based on days overdue
 * Requirements: 8.3, 8.4, 8.5
 * 
 * - After day 1: status remains 'pending' (charge is overdue)
 * - After day 5: access limited (tenant status changes to 'suspended' with limited access)
 * - After day 10: fully suspended
 */
export function determineOverdueStatus(daysOverdue: number): {
  chargeStatus: ChargeStatus
  tenantAction: 'none' | 'limit_access' | 'suspend'
} {
  if (daysOverdue <= 0) {
    return { chargeStatus: 'pending', tenantAction: 'none' }
  }
  
  if (daysOverdue >= 10) {
    return { chargeStatus: 'overdue', tenantAction: 'suspend' }
  }
  
  if (daysOverdue >= 5) {
    return { chargeStatus: 'overdue', tenantAction: 'limit_access' }
  }
  
  // Days 1-4: charge is overdue but tenant still has access
  return { chargeStatus: 'overdue', tenantAction: 'none' }
}

/**
 * Calculates days overdue from due date
 */
export function calculateDaysOverdue(dueDate: string, currentDate: Date = new Date()): number {
  const due = new Date(dueDate)
  due.setUTCHours(0, 0, 0, 0)
  
  const current = new Date(currentDate)
  current.setUTCHours(0, 0, 0, 0)
  
  const diffTime = current.getTime() - due.getTime()
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
  
  return diffDays
}

/**
 * Checks if today is the charge generation day (25th)
 * Requirements: 8.1
 */
export function isChargeGenerationDay(date: Date = new Date()): boolean {
  return date.getUTCDate() === 25
}


/**
 * BillingService - Manages billing and charges for tenants
 * Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6
 */
export class BillingService {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Generates monthly charges for all active tenants
   * Requirements: 8.1
   * 
   * - Should be called on day 25 of each month
   * - Creates one charge per active tenant for the next month
   * - Charge amount is the tenant's monthly_price
   * - Due date is the 1st of the next month
   */
  async generateMonthlyCharges(generationDate: Date = new Date()): Promise<ChargeGenerationResult> {
    const errors: string[] = []
    let chargesCreated = 0

    // Get all active tenants
    const { data: activeTenants, error: tenantsError } = await this.supabase
      .from('tenants')
      .select('id, monthly_price, store_name')
      .eq('subscription_status', 'active')

    if (tenantsError) {
      return {
        success: false,
        chargesCreated: 0,
        errors: [`Failed to fetch active tenants: ${tenantsError.message}`]
      }
    }

    if (!activeTenants || activeTenants.length === 0) {
      return {
        success: true,
        chargesCreated: 0,
        errors: []
      }
    }

    const dueDate = calculateNextMonthDueDate(generationDate)

    // Check for existing charges for the same due date to avoid duplicates
    const { data: existingCharges } = await this.supabase
      .from('charges')
      .select('tenant_id')
      .eq('due_date', dueDate)

    const existingTenantIds = new Set(existingCharges?.map(c => c.tenant_id) || [])

    // Create charges for tenants that don't have one yet
    for (const tenant of activeTenants) {
      if (existingTenantIds.has(tenant.id)) {
        continue // Skip if charge already exists
      }

      const { error: chargeError } = await this.supabase
        .from('charges')
        .insert({
          tenant_id: tenant.id,
          amount: tenant.monthly_price,
          due_date: dueDate
        })

      if (chargeError) {
        errors.push(`Failed to create charge for tenant ${tenant.store_name}: ${chargeError.message}`)
      } else {
        chargesCreated++
      }
    }

    return {
      success: errors.length === 0,
      chargesCreated,
      errors
    }
  }

  /**
   * Updates overdue statuses for unpaid charges
   * Requirements: 8.3, 8.4, 8.5
   * 
   * Status transitions:
   * - After day 1 (due date passed): charge status -> 'overdue'
   * - After day 5: tenant access limited (subscription_status -> 'suspended' but can still view)
   * - After day 10: tenant fully suspended
   */
  async updateOverdueStatuses(currentDate: Date = new Date()): Promise<StatusUpdateResult> {
    const errors: string[] = []
    let updatedCount = 0
    let suspendedCount = 0

    // Get all pending charges that are past due date
    const { data: pendingCharges, error: chargesError } = await this.supabase
      .from('charges')
      .select('id, tenant_id, due_date, status')
      .in('status', ['pending', 'overdue'])

    if (chargesError) {
      return {
        success: false,
        updatedCount: 0,
        suspendedCount: 0,
        errors: [`Failed to fetch pending charges: ${chargesError.message}`]
      }
    }

    if (!pendingCharges || pendingCharges.length === 0) {
      return {
        success: true,
        updatedCount: 0,
        suspendedCount: 0,
        errors: []
      }
    }

    for (const charge of pendingCharges) {
      const daysOverdue = calculateDaysOverdue(charge.due_date, currentDate)
      
      if (daysOverdue <= 0) {
        continue // Not overdue yet
      }

      const { chargeStatus, tenantAction } = determineOverdueStatus(daysOverdue)

      // Update charge status if needed
      if (charge.status !== chargeStatus) {
        const { error: updateError } = await this.supabase
          .from('charges')
          .update({ status: chargeStatus })
          .eq('id', charge.id)

        if (updateError) {
          errors.push(`Failed to update charge ${charge.id}: ${updateError.message}`)
        } else {
          updatedCount++
        }
      }

      // Handle tenant status changes
      if (tenantAction === 'suspend') {
        const { error: suspendError } = await this.supabase
          .from('tenants')
          .update({ subscription_status: 'suspended' })
          .eq('id', charge.tenant_id)
          .eq('subscription_status', 'active') // Only suspend if currently active

        if (suspendError) {
          errors.push(`Failed to suspend tenant ${charge.tenant_id}: ${suspendError.message}`)
        } else {
          suspendedCount++
        }
      }
    }

    return {
      success: errors.length === 0,
      updatedCount,
      suspendedCount,
      errors
    }
  }


  /**
   * Processes a payment for a charge
   * Requirements: 8.6
   */
  async processPayment(
    chargeId: string, 
    paymentMethod: PaymentMethod
  ): Promise<PaymentResult> {
    // Get the charge
    const { data: charge, error: chargeError } = await this.supabase
      .from('charges')
      .select('*, tenants(subscription_status)')
      .eq('id', chargeId)
      .single()

    if (chargeError || !charge) {
      return {
        success: false,
        error: 'Cobrança não encontrada'
      }
    }

    if (charge.status === 'paid') {
      return {
        success: false,
        error: 'Cobrança já foi paga'
      }
    }

    if (charge.status === 'cancelled') {
      return {
        success: false,
        error: 'Cobrança foi cancelada'
      }
    }

    // Update charge to paid
    const { data: updatedCharge, error: updateError } = await this.supabase
      .from('charges')
      .update({
        status: 'paid',
        paid_at: new Date().toISOString(),
        payment_method: paymentMethod
      })
      .eq('id', chargeId)
      .select()
      .single()

    if (updateError) {
      return {
        success: false,
        error: `Falha ao processar pagamento: ${updateError.message}`
      }
    }

    // If tenant was suspended due to non-payment, reactivate
    if (charge.tenants?.subscription_status === 'suspended') {
      await this.supabase
        .from('tenants')
        .update({ subscription_status: 'active' })
        .eq('id', charge.tenant_id)
    }

    return {
      success: true,
      charge: updatedCharge as Charge
    }
  }

  /**
   * Gets all charges for a tenant
   */
  async getChargesByTenant(tenantId: string): Promise<Charge[]> {
    const { data, error } = await this.supabase
      .from('charges')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('due_date', { ascending: false })

    if (error) {
      throw new Error(`Failed to fetch charges: ${error.message}`)
    }

    return (data || []) as Charge[]
  }

  /**
   * Gets all pending charges across all tenants
   * Requirements: 8.2
   */
  async getPendingCharges(): Promise<(Charge & { tenant?: Tenant })[]> {
    const { data, error } = await this.supabase
      .from('charges')
      .select('*, tenants(*)')
      .in('status', ['pending', 'overdue'])
      .order('due_date', { ascending: true })

    if (error) {
      throw new Error(`Failed to fetch pending charges: ${error.message}`)
    }

    return (data || []).map(item => ({
      ...item,
      tenant: item.tenants as Tenant
    })) as (Charge & { tenant?: Tenant })[]
  }

  /**
   * Gets all paid charges
   */
  async getPaidCharges(): Promise<(Charge & { tenant?: Tenant })[]> {
    const { data, error } = await this.supabase
      .from('charges')
      .select('*, tenants(*)')
      .eq('status', 'paid')
      .order('paid_at', { ascending: false })

    if (error) {
      throw new Error(`Failed to fetch paid charges: ${error.message}`)
    }

    return (data || []).map(item => ({
      ...item,
      tenant: item.tenants as Tenant
    })) as (Charge & { tenant?: Tenant })[]
  }

  /**
   * Gets a charge by ID
   */
  async getChargeById(chargeId: string): Promise<Charge | null> {
    const { data, error } = await this.supabase
      .from('charges')
      .select('*')
      .eq('id', chargeId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return null
      }
      throw new Error(`Failed to fetch charge: ${error.message}`)
    }

    return data as Charge
  }

  /**
   * Cancels a charge
   */
  async cancelCharge(chargeId: string): Promise<Charge> {
    const charge = await this.getChargeById(chargeId)
    if (!charge) {
      throw new Error('Cobrança não encontrada')
    }

    if (charge.status === 'paid') {
      throw new Error('Não é possível cancelar cobrança já paga')
    }

    const { data, error } = await this.supabase
      .from('charges')
      .update({ status: 'cancelled' })
      .eq('id', chargeId)
      .select()
      .single()

    if (error) {
      throw new Error(`Falha ao cancelar cobrança: ${error.message}`)
    }

    return data as Charge
  }

  /**
   * Sends payment reminder for a charge
   * Requirements: 8.2
   */
  async sendPaymentReminder(chargeId: string): Promise<{ success: boolean; error?: string }> {
    const { data: charge, error } = await this.supabase
      .from('charges')
      .select('*, tenants(owner_email, owner_phone, store_name)')
      .eq('id', chargeId)
      .single()

    if (error || !charge) {
      return { success: false, error: 'Cobrança não encontrada' }
    }

    if (charge.status === 'paid') {
      return { success: false, error: 'Cobrança já foi paga' }
    }

    // TODO: Integrate with email and WhatsApp services
    // For now, just log the reminder
    console.log(`Payment reminder sent to ${charge.tenants?.owner_email} for charge ${chargeId}`)
    console.log(`WhatsApp reminder to ${charge.tenants?.owner_phone}`)

    return { success: true }
  }
}
