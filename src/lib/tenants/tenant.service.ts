import { SupabaseClient } from '@supabase/supabase-js'
import { Tenant } from '@/types'

/**
 * Input data for tenant registration
 * Requirements: 1.1, 1.2
 */
export interface TenantRegistrationInput {
  store_name: string
  owner_name: string
  owner_email: string
  owner_phone: string
  cnpj?: string
  address?: string
}

/**
 * Validation error for tenant registration
 */
export interface ValidationError {
  field: string
  message: string
}

/**
 * Result of tenant registration
 */
export type TenantRegistrationResult = 
  | { success: true; tenant: Tenant }
  | { success: false; errors: ValidationError[] }

/**
 * Required fields for tenant registration
 * Requirements: 1.2
 */
const REQUIRED_FIELDS: (keyof TenantRegistrationInput)[] = [
  'store_name',
  'owner_name', 
  'owner_email',
  'owner_phone'
]

/**
 * Validates tenant registration input
 * Requirements: 1.2 - Validate required fields
 */
export function validateTenantRegistration(input: Partial<TenantRegistrationInput>): ValidationError[] {
  const errors: ValidationError[] = []

  for (const field of REQUIRED_FIELDS) {
    const value = input[field]
    if (!value || (typeof value === 'string' && value.trim() === '')) {
      errors.push({
        field,
        message: `Campo obrigatório: ${field}`
      })
    }
  }

  // Validate email format
  if (input.owner_email && !isValidEmail(input.owner_email)) {
    errors.push({
      field: 'owner_email',
      message: 'Email inválido'
    })
  }

  return errors
}

/**
 * Simple email validation
 */
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

/**
 * Result of computing approval update
 * Requirements: 1.4, 3.3
 */
export interface ApprovalUpdate {
  approved_by_admin: boolean
  subscription_status: 'active'
  approved_at: string
  approved_by: string
}

/**
 * Computes the approval update fields for a tenant
 * Requirements: 1.4, 3.3
 * 
 * This is a pure function that computes what fields should be updated
 * when a tenant is approved. It's separated from the database operation
 * to enable property-based testing.
 * 
 * - Sets approved_by_admin to true
 * - Sets subscription_status to "active"
 * - Sets approved_at to the provided timestamp
 * - Sets approved_by to the admin ID
 */
export function computeApprovalUpdate(adminId: string, approvalTimestamp: Date = new Date()): ApprovalUpdate {
  return {
    approved_by_admin: true,
    subscription_status: 'active',
    approved_at: approvalTimestamp.toISOString(),
    approved_by: adminId
  }
}

/**
 * Calculates trial end date (7 days from now)
 * Requirements: 1.3
 * 
 * Uses UTC operations to avoid timezone-related bugs
 */
export function calculateTrialEndDate(fromDate: Date = new Date()): string {
  const trialEnd = new Date(fromDate)
  // Use UTC methods to avoid timezone issues
  trialEnd.setUTCDate(trialEnd.getUTCDate() + 7)
  // Format as YYYY-MM-DD using UTC values
  const year = trialEnd.getUTCFullYear()
  const month = String(trialEnd.getUTCMonth() + 1).padStart(2, '0')
  const day = String(trialEnd.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Data retention policy constants
 * Requirements: 13.4
 */
export const DATA_RETENTION_DAYS = 90

/**
 * Calculates the data deletion date based on cancellation date
 * Requirements: 13.4
 * 
 * Returns the date when data can be deleted (90 days after cancellation)
 */
export function calculateDeletionDate(cancelledAt: Date): Date {
  const deletionDate = new Date(cancelledAt)
  deletionDate.setDate(deletionDate.getDate() + DATA_RETENTION_DAYS)
  return deletionDate
}

/**
 * Checks if a cancelled tenant is within the retention period
 * Requirements: 13.4
 * 
 * Pure function for property-based testing
 * Returns true if the tenant data should be preserved (within 90 days of cancellation)
 */
export function isWithinRetentionPeriodPure(
  cancelledAt: Date | null,
  currentDate: Date = new Date()
): boolean {
  // If no cancellation date, data should be preserved
  if (!cancelledAt) {
    return true
  }

  const deletionDate = calculateDeletionDate(cancelledAt)
  return currentDate < deletionDate
}

/**
 * Checks if a tenant is eligible for data deletion
 * Requirements: 13.4
 * 
 * Pure function for property-based testing
 * Returns true if the tenant data can be deleted (past 90 days of cancellation)
 */
export function isEligibleForDeletion(
  subscriptionStatus: string,
  cancelledAt: Date | null,
  currentDate: Date = new Date()
): boolean {
  // Only cancelled tenants can be deleted
  if (subscriptionStatus !== 'cancelled') {
    return false
  }

  // If no cancellation date, not eligible for deletion
  if (!cancelledAt) {
    return false
  }

  return !isWithinRetentionPeriodPure(cancelledAt, currentDate)
}

/**
 * TenantService - Manages tenant registration and lifecycle
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 3.3, 13.1
 */
export class TenantService {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Registers a new tenant with pending status
   * Requirements: 1.1, 1.2, 1.3
   * 
   * - Creates tenant with status "pending"
   * - Sets trial_ends_at to 7 days from creation
   * - Validates required fields
   */
  async registerTenant(input: TenantRegistrationInput): Promise<TenantRegistrationResult> {
    // Validate input
    const validationErrors = validateTenantRegistration(input)
    if (validationErrors.length > 0) {
      return { success: false, errors: validationErrors }
    }

    // Check for duplicate email
    const { data: existingTenant } = await this.supabase
      .from('tenants')
      .select('id')
      .eq('owner_email', input.owner_email)
      .single()

    if (existingTenant) {
      return {
        success: false,
        errors: [{ field: 'owner_email', message: 'Email já cadastrado' }]
      }
    }

    // Insert new tenant
    // Note: trial_ends_at and subscription_status have defaults in the database
    const { data: tenant, error } = await this.supabase
      .from('tenants')
      .insert({
        store_name: input.store_name.trim(),
        owner_name: input.owner_name.trim(),
        owner_email: input.owner_email.trim().toLowerCase(),
        owner_phone: input.owner_phone.trim(),
        cnpj: input.cnpj?.trim() || null,
        address: input.address?.trim() || null
      })
      .select()
      .single()

    if (error) {
      return {
        success: false,
        errors: [{ field: 'general', message: error.message }]
      }
    }

    return { success: true, tenant: tenant as Tenant }
  }

  /**
   * Gets all pending tenants ordered by creation date (oldest first)
   * Requirements: 3.2
   */
  async getPendingTenants(): Promise<Tenant[]> {
    const { data, error } = await this.supabase
      .from('tenants')
      .select('*')
      .eq('subscription_status', 'pending')
      .order('created_at', { ascending: true })

    if (error) {
      throw new Error(`Failed to fetch pending tenants: ${error.message}`)
    }

    return (data || []) as Tenant[]
  }

  /**
   * Gets a tenant by ID
   */
  async getTenantById(id: string): Promise<Tenant | null> {
    const { data, error } = await this.supabase
      .from('tenants')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return null // Not found
      }
      throw new Error(`Failed to fetch tenant: ${error.message}`)
    }

    return data as Tenant
  }

  /**
   * Approves a pending tenant
   * Requirements: 1.4, 3.3, 13.1
   * 
   * - Updates approved_by_admin to true
   * - Updates subscription_status to "active"
   * - Sets approved_at timestamp
   * - Sets approved_by to the admin ID
   * - Creates store_user for the owner
   */
  async approveTenant(tenantId: string, adminId: string): Promise<Tenant> {
    // Verify tenant exists and is pending
    const tenant = await this.getTenantById(tenantId)
    if (!tenant) {
      throw new Error('Tenant não encontrado')
    }
    if (tenant.subscription_status !== 'pending') {
      throw new Error('Apenas tenants pendentes podem ser aprovados')
    }

    // Update tenant status
    const { data, error } = await this.supabase
      .from('tenants')
      .update({
        approved_by_admin: true,
        subscription_status: 'active',
        approved_at: new Date().toISOString(),
        approved_by: adminId
      })
      .eq('id', tenantId)
      .select()
      .single()

    if (error) {
      throw new Error(`Falha ao aprovar tenant: ${error.message}`)
    }

    // Create store_user for the owner
    // Use store_name as the display name (not owner_name)
    const { error: userError } = await this.supabase
      .from('store_users')
      .insert({
        tenant_id: tenantId,
        email: tenant.owner_email.toLowerCase(),
        name: tenant.store_name,
        role: 'owner',
        is_active: true
      })

    if (userError) {
      console.error('Erro ao criar store_user:', userError)
      // Don't throw - tenant is already approved
    }

    return data as Tenant
  }

  /**
   * Rejects a pending tenant
   * Requirements: 1.5
   * 
   * - Updates subscription_status to "cancelled"
   * - In a real implementation, would send rejection email with reason
   */
  async rejectTenant(tenantId: string, reason: string): Promise<void> {
    // Verify tenant exists and is pending
    const tenant = await this.getTenantById(tenantId)
    if (!tenant) {
      throw new Error('Tenant não encontrado')
    }
    if (tenant.subscription_status !== 'pending') {
      throw new Error('Apenas tenants pendentes podem ser rejeitados')
    }

    if (!reason || reason.trim() === '') {
      throw new Error('Motivo da rejeição é obrigatório')
    }

    // Update tenant status to cancelled
    const { error } = await this.supabase
      .from('tenants')
      .update({
        subscription_status: 'cancelled'
      })
      .eq('id', tenantId)

    if (error) {
      throw new Error(`Falha ao rejeitar tenant: ${error.message}`)
    }

    // TODO: Send rejection email with reason
    // This would be implemented with an email service
    console.log(`Tenant ${tenantId} rejected. Reason: ${reason}`)
  }

  /**
   * Requests more information from a pending tenant
   * Requirements: 3.4
   * 
   * - In a real implementation, would send email with questions
   */
  async requestMoreInfo(tenantId: string, questions: string[]): Promise<void> {
    // Verify tenant exists and is pending
    const tenant = await this.getTenantById(tenantId)
    if (!tenant) {
      throw new Error('Tenant não encontrado')
    }
    if (tenant.subscription_status !== 'pending') {
      throw new Error('Apenas tenants pendentes podem receber solicitação de informações')
    }

    if (!questions || questions.length === 0) {
      throw new Error('Pelo menos uma pergunta é obrigatória')
    }

    // TODO: Send email with questions
    // This would be implemented with an email service
    console.log(`Requesting more info from tenant ${tenantId}. Questions:`, questions)
  }

  /**
   * Suspends an active tenant
   * Requirements: 13.3
   * 
   * - Updates subscription_status to "suspended"
   * - Data is preserved but access is blocked
   */
  async suspendTenant(tenantId: string, reason: string): Promise<Tenant> {
    const tenant = await this.getTenantById(tenantId)
    if (!tenant) {
      throw new Error('Tenant não encontrado')
    }
    if (tenant.subscription_status !== 'active') {
      throw new Error('Apenas tenants ativos podem ser suspensos')
    }

    const { data, error } = await this.supabase
      .from('tenants')
      .update({
        subscription_status: 'suspended'
      })
      .eq('id', tenantId)
      .select()
      .single()

    if (error) {
      throw new Error(`Falha ao suspender tenant: ${error.message}`)
    }

    // TODO: Log suspension reason
    console.log(`Tenant ${tenantId} suspended. Reason: ${reason}`)

    return data as Tenant
  }

  /**
   * Reactivates a suspended tenant
   * Requirements: 13.3
   */
  async reactivateTenant(tenantId: string): Promise<Tenant> {
    const tenant = await this.getTenantById(tenantId)
    if (!tenant) {
      throw new Error('Tenant não encontrado')
    }
    if (tenant.subscription_status !== 'suspended') {
      throw new Error('Apenas tenants suspensos podem ser reativados')
    }

    const { data, error } = await this.supabase
      .from('tenants')
      .update({
        subscription_status: 'active'
      })
      .eq('id', tenantId)
      .select()
      .single()

    if (error) {
      throw new Error(`Falha ao reativar tenant: ${error.message}`)
    }

    return data as Tenant
  }

  /**
   * Cancels a tenant (marks for deletion after retention period)
   * Requirements: 13.4
   * 
   * - Updates subscription_status to "cancelled"
   * - Sets cancelled_at timestamp for retention policy tracking
   * - Data is preserved for 90 days before deletion
   */
  async cancelTenant(tenantId: string, reason: string): Promise<Tenant> {
    const tenant = await this.getTenantById(tenantId)
    if (!tenant) {
      throw new Error('Tenant não encontrado')
    }
    if (tenant.subscription_status === 'cancelled') {
      throw new Error('Tenant já está cancelado')
    }

    const { data, error } = await this.supabase
      .from('tenants')
      .update({
        subscription_status: 'cancelled',
        cancelled_at: new Date().toISOString()
      })
      .eq('id', tenantId)
      .select()
      .single()

    if (error) {
      throw new Error(`Falha ao cancelar tenant: ${error.message}`)
    }

    // TODO: Log cancellation reason
    console.log(`Tenant ${tenantId} cancelled. Reason: ${reason}`)

    return data as Tenant
  }

  /**
   * Gets tenants that are past the retention period and eligible for deletion
   * Requirements: 13.4
   * 
   * Returns tenants that have been cancelled for more than 90 days
   */
  async getTenantsEligibleForDeletion(): Promise<Tenant[]> {
    const retentionDays = 90
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays)

    const { data, error } = await this.supabase
      .from('tenants')
      .select('*')
      .eq('subscription_status', 'cancelled')
      .lt('cancelled_at', cutoffDate.toISOString())

    if (error) {
      throw new Error(`Failed to fetch tenants eligible for deletion: ${error.message}`)
    }

    return (data || []) as Tenant[]
  }

  /**
   * Checks if a tenant is within the retention period
   * Requirements: 13.4
   * 
   * Returns true if the tenant is cancelled but still within the 90-day retention period
   */
  async isWithinRetentionPeriod(tenantId: string): Promise<boolean> {
    const tenant = await this.getTenantById(tenantId)
    if (!tenant) {
      return false
    }
    if (tenant.subscription_status !== 'cancelled') {
      return false
    }

    // Check if cancelled_at exists and is within 90 days
    const cancelledAt = tenant.cancelled_at ? new Date(tenant.cancelled_at) : null
    if (!cancelledAt) {
      return true // No cancellation date means we preserve data
    }

    const retentionDays = 90
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays)

    return cancelledAt > cutoffDate
  }

  /**
   * Gets all active tenants
   */
  async getActiveTenants(): Promise<Tenant[]> {
    const { data, error } = await this.supabase
      .from('tenants')
      .select('*')
      .eq('subscription_status', 'active')
      .order('store_name', { ascending: true })

    if (error) {
      throw new Error(`Failed to fetch active tenants: ${error.message}`)
    }

    return (data || []) as Tenant[]
  }
}
