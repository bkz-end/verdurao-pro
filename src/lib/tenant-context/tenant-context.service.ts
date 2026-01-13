import { SupabaseClient } from '@supabase/supabase-js'
import { Tenant, StoreUser, SubscriptionStatus } from '@/types'

/**
 * Tables that require tenant isolation
 * Requirements: 13.2 - Ensure queries always filter by tenant_id
 */
export const TENANT_SCOPED_TABLES = [
  'products',
  'sales',
  'sale_items',
  'losses',
  'stock_history',
  'store_users'
] as const

export type TenantScopedTable = typeof TENANT_SCOPED_TABLES[number]

/**
 * Tenant context information for the current session
 * Requirements: 13.2 - Ensure queries always filter by tenant_id
 */
export interface TenantContext {
  tenantId: string
  tenant: Tenant
  user: StoreUser
  isSuperAdmin: false
}

/**
 * Super admin context (no tenant restriction)
 */
export interface SuperAdminContext {
  userId: string
  email: string
  isSuperAdmin: true
}

/**
 * Union type for all possible session contexts
 */
export type SessionContext = TenantContext | SuperAdminContext

/**
 * Result of tenant context resolution
 */
export type TenantContextResult =
  | { success: true; context: SessionContext }
  | { success: false; error: string; errorCode: TenantAccessError }

/**
 * Error codes for tenant access issues
 */
export type TenantAccessError =
  | 'NOT_AUTHENTICATED'
  | 'USER_NOT_FOUND'
  | 'TENANT_NOT_FOUND'
  | 'TENANT_SUSPENDED'
  | 'TENANT_CANCELLED'
  | 'TENANT_PENDING'
  | 'USER_DEACTIVATED'
  | 'ACCESS_DENIED'

/**
 * Error messages in Portuguese
 */
const ERROR_MESSAGES: Record<TenantAccessError, string> = {
  NOT_AUTHENTICATED: 'Usuário não autenticado',
  USER_NOT_FOUND: 'Usuário não encontrado no sistema',
  TENANT_NOT_FOUND: 'Loja não encontrada',
  TENANT_SUSPENDED: 'Sua loja está suspensa. Entre em contato com o suporte',
  TENANT_CANCELLED: 'Sua loja foi cancelada',
  TENANT_PENDING: 'Sua loja ainda está aguardando aprovação',
  USER_DEACTIVATED: 'Sua conta foi desativada. Entre em contato com o administrador da loja',
  ACCESS_DENIED: 'Acesso negado'
}

/**
 * Checks if a subscription status allows access
 * Requirements: 13.3 - Suspended tenants have data preserved but access blocked
 */
export function isAccessibleStatus(status: SubscriptionStatus): boolean {
  return status === 'active'
}

/**
 * Gets the error code for a given subscription status
 */
export function getStatusErrorCode(status: SubscriptionStatus): TenantAccessError | null {
  switch (status) {
    case 'active':
      return null
    case 'suspended':
      return 'TENANT_SUSPENDED'
    case 'cancelled':
      return 'TENANT_CANCELLED'
    case 'pending':
      return 'TENANT_PENDING'
    default:
      return 'ACCESS_DENIED'
  }
}

/**
 * TenantContextService - Manages tenant isolation and access control
 * Requirements: 13.2 - Ensure queries always filter by tenant_id
 * Requirements: 13.3 - Suspended tenants have data preserved but access blocked
 */
export class TenantContextService {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Resolves the current session context
   * Returns tenant context for store users or super admin context for admins
   * 
   * Requirements: 13.2 - Validate access based on session
   * Requirements: 10.2 - Block access for deactivated users
   * Requirements: 13.3 - Block access for suspended tenants
   */
  async resolveContext(): Promise<TenantContextResult> {
    // Get current authenticated user
    const { data: { user }, error: authError } = await this.supabase.auth.getUser()

    if (authError || !user) {
      return {
        success: false,
        error: ERROR_MESSAGES.NOT_AUTHENTICATED,
        errorCode: 'NOT_AUTHENTICATED'
      }
    }

    const email = user.email?.toLowerCase()
    if (!email) {
      return {
        success: false,
        error: ERROR_MESSAGES.NOT_AUTHENTICATED,
        errorCode: 'NOT_AUTHENTICATED'
      }
    }

    // Check if user is a super admin
    const { data: superAdmin } = await this.supabase
      .from('super_admin_users')
      .select('id, email')
      .eq('email', email)
      .single()

    if (superAdmin) {
      return {
        success: true,
        context: {
          userId: superAdmin.id,
          email: superAdmin.email,
          isSuperAdmin: true
        }
      }
    }

    // Check store_users table
    const { data: storeUser, error: storeUserError } = await this.supabase
      .from('store_users')
      .select('*')
      .eq('email', email)
      .single()

    if (storeUserError || !storeUser) {
      return {
        success: false,
        error: ERROR_MESSAGES.USER_NOT_FOUND,
        errorCode: 'USER_NOT_FOUND'
      }
    }

    // Check if user is active
    // Requirements: 10.2 - Block access immediately after deactivation
    if (!storeUser.is_active) {
      return {
        success: false,
        error: ERROR_MESSAGES.USER_DEACTIVATED,
        errorCode: 'USER_DEACTIVATED'
      }
    }

    // Get tenant information
    const { data: tenant, error: tenantError } = await this.supabase
      .from('tenants')
      .select('*')
      .eq('id', storeUser.tenant_id)
      .single()

    if (tenantError || !tenant) {
      return {
        success: false,
        error: ERROR_MESSAGES.TENANT_NOT_FOUND,
        errorCode: 'TENANT_NOT_FOUND'
      }
    }

    // Check tenant subscription status
    // Requirements: 13.3 - Suspended tenants have data preserved but access blocked
    const statusError = getStatusErrorCode(tenant.subscription_status)
    if (statusError) {
      return {
        success: false,
        error: ERROR_MESSAGES[statusError],
        errorCode: statusError
      }
    }

    return {
      success: true,
      context: {
        tenantId: tenant.id,
        tenant: tenant as Tenant,
        user: storeUser as StoreUser,
        isSuperAdmin: false
      }
    }
  }

  /**
   * Gets the tenant ID for the current session
   * Throws an error if not authenticated or not a store user
   * 
   * Requirements: 13.2 - Inject tenant_id in all queries
   */
  async getTenantId(): Promise<string> {
    const result = await this.resolveContext()

    if (!result.success) {
      throw new Error(result.error)
    }

    if (result.context.isSuperAdmin) {
      throw new Error('Super admin não possui tenant_id')
    }

    return result.context.tenantId
  }

  /**
   * Validates that the current user has access to a specific tenant
   * Used for operations that need to verify tenant ownership
   * 
   * Requirements: 13.2 - Validate access based on session
   */
  async validateTenantAccess(tenantId: string): Promise<TenantContextResult> {
    const result = await this.resolveContext()

    if (!result.success) {
      return result
    }

    // Super admins have access to all tenants
    if (result.context.isSuperAdmin) {
      return result
    }

    // Store users can only access their own tenant
    if (result.context.tenantId !== tenantId) {
      return {
        success: false,
        error: ERROR_MESSAGES.ACCESS_DENIED,
        errorCode: 'ACCESS_DENIED'
      }
    }

    return result
  }

  /**
   * Creates a query builder that automatically filters by tenant_id
   * This is a helper to ensure all queries are properly scoped
   * 
   * Requirements: 13.2 - Ensure queries always filter by tenant_id
   */
  async createTenantScopedQuery<T extends string>(
    table: T
  ): Promise<{ query: ReturnType<SupabaseClient['from']>; tenantId: string }> {
    const tenantId = await this.getTenantId()

    const query = this.supabase.from(table)

    return { query, tenantId }
  }

  /**
   * Checks if the current user is a super admin
   */
  async isSuperAdmin(): Promise<boolean> {
    const result = await this.resolveContext()
    return result.success && result.context.isSuperAdmin
  }

  /**
   * Gets the current store user (throws if super admin or not authenticated)
   */
  async getCurrentStoreUser(): Promise<StoreUser> {
    const result = await this.resolveContext()

    if (!result.success) {
      throw new Error(result.error)
    }

    if (result.context.isSuperAdmin) {
      throw new Error('Super admin não é um store user')
    }

    return result.context.user
  }

  /**
   * Gets the current tenant (throws if super admin or not authenticated)
   */
  async getCurrentTenant(): Promise<Tenant> {
    const result = await this.resolveContext()

    if (!result.success) {
      throw new Error(result.error)
    }

    if (result.context.isSuperAdmin) {
      throw new Error('Super admin não possui tenant')
    }

    return result.context.tenant
  }
}

/**
 * Helper function to create a tenant-scoped service wrapper
 * This ensures all operations are automatically filtered by tenant_id
 * 
 * Requirements: 13.2 - Inject tenant_id in all queries
 */
export function withTenantScope<T>(
  operation: (tenantId: string) => Promise<T>,
  contextService: TenantContextService
): () => Promise<T> {
  return async () => {
    const tenantId = await contextService.getTenantId()
    return operation(tenantId)
  }
}

/**
 * Middleware helper for API routes and server components
 * Validates session and returns tenant context
 * 
 * Requirements: 13.2 - Validate access based on session
 */
export async function requireTenantContext(
  supabase: SupabaseClient
): Promise<TenantContext> {
  const service = new TenantContextService(supabase)
  const result = await service.resolveContext()

  if (!result.success) {
    throw new TenantAccessDeniedError(result.error, result.errorCode)
  }

  if (result.context.isSuperAdmin) {
    throw new TenantAccessDeniedError(
      'Super admin não possui contexto de tenant',
      'ACCESS_DENIED'
    )
  }

  return result.context
}

/**
 * Middleware helper for API routes that allows super admin access
 * Returns either tenant context or super admin context
 * 
 * Requirements: 13.2 - Validate access based on session
 */
export async function requireAuthContext(
  supabase: SupabaseClient
): Promise<SessionContext> {
  const service = new TenantContextService(supabase)
  const result = await service.resolveContext()

  if (!result.success) {
    throw new TenantAccessDeniedError(result.error, result.errorCode)
  }

  return result.context
}

/**
 * Custom error class for tenant access denied
 * Requirements: 13.2, 13.3
 */
export class TenantAccessDeniedError extends Error {
  constructor(
    message: string,
    public readonly errorCode: TenantAccessError
  ) {
    super(message)
    this.name = 'TenantAccessDeniedError'
  }
}

/**
 * Type guard to check if context is a tenant context
 */
export function isTenantContext(context: SessionContext): context is TenantContext {
  return !context.isSuperAdmin
}

/**
 * Type guard to check if context is a super admin context
 */
export function isSuperAdminContext(context: SessionContext): context is SuperAdminContext {
  return context.isSuperAdmin
}

/**
 * Creates a tenant-isolated query builder
 * Automatically adds tenant_id filter to all queries
 * 
 * Requirements: 13.2 - Inject tenant_id in all queries
 */
export class TenantScopedQueryBuilder {
  constructor(
    private supabase: SupabaseClient,
    private tenantId: string
  ) {}

  /**
   * Creates a SELECT query with automatic tenant_id filter
   */
  from<T extends TenantScopedTable>(table: T) {
    return {
      select: (columns: string = '*') => {
        return this.supabase
          .from(table)
          .select(columns)
          .eq('tenant_id', this.tenantId)
      },
      insert: (data: Record<string, unknown> | Record<string, unknown>[]) => {
        const dataWithTenant = Array.isArray(data)
          ? data.map(d => ({ ...d, tenant_id: this.tenantId }))
          : { ...data, tenant_id: this.tenantId }
        return this.supabase.from(table).insert(dataWithTenant)
      },
      update: (data: Record<string, unknown>) => {
        return this.supabase
          .from(table)
          .update(data)
          .eq('tenant_id', this.tenantId)
      },
      delete: () => {
        return this.supabase
          .from(table)
          .delete()
          .eq('tenant_id', this.tenantId)
      }
    }
  }

  /**
   * Gets the tenant ID for this query builder
   */
  getTenantId(): string {
    return this.tenantId
  }
}

/**
 * Creates a tenant-scoped query builder from context
 * 
 * Requirements: 13.2 - Inject tenant_id in all queries
 */
export function createTenantScopedQueryBuilder(
  supabase: SupabaseClient,
  context: TenantContext
): TenantScopedQueryBuilder {
  return new TenantScopedQueryBuilder(supabase, context.tenantId)
}

/**
 * Validates that a record belongs to the specified tenant
 * Used for additional security checks on individual records
 * 
 * Requirements: 13.2 - Validate access based on session
 */
export function validateRecordTenantOwnership<T extends { tenant_id: string }>(
  record: T | null,
  tenantId: string
): boolean {
  if (!record) return false
  return record.tenant_id === tenantId
}

/**
 * Asserts that a record belongs to the specified tenant
 * Throws TenantAccessDeniedError if validation fails
 * 
 * Requirements: 13.2 - Validate access based on session
 */
export function assertRecordTenantOwnership<T extends { tenant_id: string }>(
  record: T | null,
  tenantId: string,
  resourceName: string = 'recurso'
): asserts record is T {
  if (!record) {
    throw new TenantAccessDeniedError(
      `${resourceName} não encontrado`,
      'ACCESS_DENIED'
    )
  }
  if (record.tenant_id !== tenantId) {
    throw new TenantAccessDeniedError(
      `Acesso negado ao ${resourceName}`,
      'ACCESS_DENIED'
    )
  }
}
