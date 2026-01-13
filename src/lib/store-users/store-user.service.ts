import { SupabaseClient } from '@supabase/supabase-js'
import { StoreUser, UserRole } from '@/types'

/**
 * Input data for adding an employee
 * Requirements: 10.1
 */
export interface AddEmployeeInput {
  tenant_id: string
  email: string
  name: string
  role: UserRole
}

/**
 * Validation error for employee operations
 */
export interface ValidationError {
  field: string
  message: string
}

/**
 * Result of employee operations
 */
export type AddEmployeeResult =
  | { success: true; employee: StoreUser }
  | { success: false; errors: ValidationError[] }

export type DeactivateEmployeeResult =
  | { success: true; employee: StoreUser }
  | { success: false; error: string }

/**
 * Required fields for adding an employee
 * Requirements: 10.1
 */
const REQUIRED_FIELDS: (keyof AddEmployeeInput)[] = [
  'tenant_id',
  'email',
  'name',
  'role'
]

/**
 * Valid roles for store users
 */
const VALID_ROLES: UserRole[] = ['owner', 'manager', 'cashier']

/**
 * Simple email validation
 */
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

/**
 * Validates add employee input
 * Requirements: 10.1
 */
export function validateAddEmployeeInput(input: Partial<AddEmployeeInput>): ValidationError[] {
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
  if (input.email && !isValidEmail(input.email)) {
    errors.push({
      field: 'email',
      message: 'Email inválido'
    })
  }

  // Validate role
  if (input.role && !VALID_ROLES.includes(input.role)) {
    errors.push({
      field: 'role',
      message: `Papel inválido. Deve ser: ${VALID_ROLES.join(', ')}`
    })
  }

  return errors
}

/**
 * Checks if a store user is active
 * Requirements: 10.2
 * 
 * Pure function for checking if a user can access the system
 */
export function isUserActive(user: StoreUser): boolean {
  return user.is_active === true
}

/**
 * StoreUserService - Manages store employees
 * Requirements: 10.1, 10.2, 10.3, 10.4
 * 
 * Note: This service enforces NO artificial limits on the number of users.
 * Per Requirement 10.4, tenants can create unlimited users per store.
 */
export class StoreUserService {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Adds a new employee to a store
   * Requirements: 10.1, 10.3
   * 
   * - Creates store_user record with email and role
   * - Sends invitation email for password creation (via Supabase Auth)
   * - Allows unlimited users per store (10.4)
   */
  async addEmployee(input: AddEmployeeInput): Promise<AddEmployeeResult> {
    // Validate input
    const validationErrors = validateAddEmployeeInput(input)
    if (validationErrors.length > 0) {
      return { success: false, errors: validationErrors }
    }

    // Check for duplicate email within the same tenant
    const { data: existingUser } = await this.supabase
      .from('store_users')
      .select('id')
      .eq('tenant_id', input.tenant_id)
      .eq('email', input.email.trim().toLowerCase())
      .single()

    if (existingUser) {
      return {
        success: false,
        errors: [{ field: 'email', message: 'Email já cadastrado nesta loja' }]
      }
    }

    // Insert new store user
    const { data: employee, error } = await this.supabase
      .from('store_users')
      .insert({
        tenant_id: input.tenant_id,
        email: input.email.trim().toLowerCase(),
        name: input.name.trim(),
        role: input.role
      })
      .select()
      .single()

    if (error) {
      return {
        success: false,
        errors: [{ field: 'general', message: error.message }]
      }
    }

    // Send invitation email via Supabase Auth
    // Requirements: 10.3 - Send invite for password creation
    await this.sendInvitationEmail(input.email.trim().toLowerCase())

    return { success: true, employee: employee as StoreUser }
  }

  /**
   * Sends invitation email for new employee to create password
   * Requirements: 10.3
   */
  private async sendInvitationEmail(email: string): Promise<void> {
    try {
      // Use Supabase Auth to send magic link / invite
      const { error } = await this.supabase.auth.admin.inviteUserByEmail(email, {
        redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`
      })

      if (error) {
        // Log error but don't fail the operation
        // The user record is created, they can request password reset later
        console.error(`Failed to send invitation email to ${email}:`, error.message)
      }
    } catch (err) {
      // If admin API is not available, try password reset flow
      console.log(`Admin invite not available, using password reset for ${email}`)
      await this.supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`
      })
    }
  }

  /**
   * Deactivates an employee (blocks access immediately)
   * Requirements: 10.2
   * 
   * - Sets is_active to false
   * - User is blocked from login immediately
   */
  async deactivateEmployee(employeeId: string): Promise<DeactivateEmployeeResult> {
    // Verify employee exists
    const employee = await this.getEmployeeById(employeeId)
    if (!employee) {
      return { success: false, error: 'Funcionário não encontrado' }
    }

    if (!employee.is_active) {
      return { success: false, error: 'Funcionário já está desativado' }
    }

    // Update is_active to false
    const { data, error } = await this.supabase
      .from('store_users')
      .update({ is_active: false })
      .eq('id', employeeId)
      .select()
      .single()

    if (error) {
      return { success: false, error: `Falha ao desativar funcionário: ${error.message}` }
    }

    return { success: true, employee: data as StoreUser }
  }

  /**
   * Reactivates a deactivated employee
   */
  async reactivateEmployee(employeeId: string): Promise<DeactivateEmployeeResult> {
    const employee = await this.getEmployeeById(employeeId)
    if (!employee) {
      return { success: false, error: 'Funcionário não encontrado' }
    }

    if (employee.is_active) {
      return { success: false, error: 'Funcionário já está ativo' }
    }

    const { data, error } = await this.supabase
      .from('store_users')
      .update({ is_active: true })
      .eq('id', employeeId)
      .select()
      .single()

    if (error) {
      return { success: false, error: `Falha ao reativar funcionário: ${error.message}` }
    }

    return { success: true, employee: data as StoreUser }
  }

  /**
   * Gets an employee by ID
   */
  async getEmployeeById(id: string): Promise<StoreUser | null> {
    const { data, error } = await this.supabase
      .from('store_users')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return null // Not found
      }
      throw new Error(`Failed to fetch employee: ${error.message}`)
    }

    return data as StoreUser
  }

  /**
   * Gets an employee by email within a tenant
   */
  async getEmployeeByEmail(tenantId: string, email: string): Promise<StoreUser | null> {
    const { data, error } = await this.supabase
      .from('store_users')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('email', email.toLowerCase())
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return null // Not found
      }
      throw new Error(`Failed to fetch employee: ${error.message}`)
    }

    return data as StoreUser
  }

  /**
   * Gets all employees for a tenant
   * Requirements: 10.4 - Unlimited users per store
   */
  async getEmployeesByTenant(tenantId: string): Promise<StoreUser[]> {
    const { data, error } = await this.supabase
      .from('store_users')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('name', { ascending: true })

    if (error) {
      throw new Error(`Failed to fetch employees: ${error.message}`)
    }

    return (data || []) as StoreUser[]
  }

  /**
   * Gets active employees for a tenant
   */
  async getActiveEmployeesByTenant(tenantId: string): Promise<StoreUser[]> {
    const { data, error } = await this.supabase
      .from('store_users')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .order('name', { ascending: true })

    if (error) {
      throw new Error(`Failed to fetch active employees: ${error.message}`)
    }

    return (data || []) as StoreUser[]
  }

  /**
   * Checks if a user can access the system (is active)
   * Requirements: 10.2
   * 
   * Used during login to verify the user is not deactivated
   */
  async canUserAccess(tenantId: string, email: string): Promise<boolean> {
    const employee = await this.getEmployeeByEmail(tenantId, email)
    if (!employee) {
      return false
    }
    return isUserActive(employee)
  }

  /**
   * Updates employee role
   */
  async updateEmployeeRole(employeeId: string, newRole: UserRole): Promise<DeactivateEmployeeResult> {
    if (!VALID_ROLES.includes(newRole)) {
      return { success: false, error: `Papel inválido. Deve ser: ${VALID_ROLES.join(', ')}` }
    }

    const employee = await this.getEmployeeById(employeeId)
    if (!employee) {
      return { success: false, error: 'Funcionário não encontrado' }
    }

    const { data, error } = await this.supabase
      .from('store_users')
      .update({ role: newRole })
      .eq('id', employeeId)
      .select()
      .single()

    if (error) {
      return { success: false, error: `Falha ao atualizar papel: ${error.message}` }
    }

    return { success: true, employee: data as StoreUser }
  }
}
