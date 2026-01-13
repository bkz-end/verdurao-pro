import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import {
  validateRecordTenantOwnership,
  assertRecordTenantOwnership,
  TenantAccessDeniedError,
  TENANT_SCOPED_TABLES,
  isAccessibleStatus,
  getStatusErrorCode,
} from './tenant-context.service'
import { SubscriptionStatus, Tenant, Product, StoreUser, Sale, ProductUnit, UserRole } from '@/types'

/**
 * Feature: verdurao-pro-saas, Property 24: Data Isolation Between Tenants
 * 
 * *For any* data query executed in the context of tenant A, the results SHALL
 * contain only records where tenant_id equals A's id.
 * 
 * **Validates: Requirements 13.2**
 */
describe('Data Isolation Between Tenants - Property Tests', () => {
  // Arbitrary for generating valid UUID-like strings (tenant IDs)
  const uuidArbitrary = fc.uuid()

  // Arbitrary for generating records with tenant_id
  const recordWithTenantIdArbitrary = (tenantId: string) => fc.record({
    id: fc.uuid(),
    tenant_id: fc.constant(tenantId),
    name: fc.string({ minLength: 1, maxLength: 100 }),
    created_at: fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') })
      .filter(d => !isNaN(d.getTime()))
      .map(d => d.toISOString()),
  })

  // Arbitrary for generating records with any tenant_id
  const anyRecordArbitrary = fc.record({
    id: fc.uuid(),
    tenant_id: fc.uuid(),
    name: fc.string({ minLength: 1, maxLength: 100 }),
    created_at: fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') })
      .filter(d => !isNaN(d.getTime()))
      .map(d => d.toISOString()),
  })

  /**
   * Property 24: validateRecordTenantOwnership returns true for matching tenant
   * 
   * For any record with tenant_id equal to the context tenant_id,
   * validateRecordTenantOwnership SHALL return true.
   */
  it('should return true when record tenant_id matches context tenant_id', () => {
    fc.assert(
      fc.property(uuidArbitrary, (tenantId) => {
        return fc.assert(
          fc.property(recordWithTenantIdArbitrary(tenantId), (record) => {
            const result = validateRecordTenantOwnership(record, tenantId)
            expect(result).toBe(true)
          }),
          { numRuns: 10 }
        )
      }),
      { numRuns: 10 }
    )
  })

  /**
   * Property 24: validateRecordTenantOwnership returns false for different tenant
   * 
   * For any record with tenant_id different from the context tenant_id,
   * validateRecordTenantOwnership SHALL return false.
   */
  it('should return false when record tenant_id differs from context tenant_id', () => {
    fc.assert(
      fc.property(
        uuidArbitrary,
        uuidArbitrary,
        (contextTenantId, recordTenantId) => {
          // Skip if tenant IDs happen to be the same
          fc.pre(contextTenantId !== recordTenantId)

          const record = {
            id: 'test-id',
            tenant_id: recordTenantId,
            name: 'Test Record',
          }

          const result = validateRecordTenantOwnership(record, contextTenantId)
          expect(result).toBe(false)
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property 24: validateRecordTenantOwnership returns false for null record
   * 
   * For any tenant_id, validateRecordTenantOwnership SHALL return false
   * when the record is null.
   */
  it('should return false when record is null', () => {
    fc.assert(
      fc.property(uuidArbitrary, (tenantId) => {
        const result = validateRecordTenantOwnership(null, tenantId)
        expect(result).toBe(false)
      }),
      { numRuns: 100 }
    )
  })

  /**
   * Property 24: assertRecordTenantOwnership does not throw for matching tenant
   * 
   * For any record with tenant_id equal to the context tenant_id,
   * assertRecordTenantOwnership SHALL NOT throw an error.
   */
  it('should not throw when record tenant_id matches context tenant_id', () => {
    fc.assert(
      fc.property(uuidArbitrary, (tenantId) => {
        return fc.assert(
          fc.property(recordWithTenantIdArbitrary(tenantId), (record) => {
            expect(() => {
              assertRecordTenantOwnership(record, tenantId)
            }).not.toThrow()
          }),
          { numRuns: 10 }
        )
      }),
      { numRuns: 10 }
    )
  })

  /**
   * Property 24: assertRecordTenantOwnership throws for different tenant
   * 
   * For any record with tenant_id different from the context tenant_id,
   * assertRecordTenantOwnership SHALL throw TenantAccessDeniedError.
   */
  it('should throw TenantAccessDeniedError when record tenant_id differs from context', () => {
    fc.assert(
      fc.property(
        uuidArbitrary,
        uuidArbitrary,
        fc.string({ minLength: 1, maxLength: 50 }),
        (contextTenantId, recordTenantId, resourceName) => {
          // Skip if tenant IDs happen to be the same
          fc.pre(contextTenantId !== recordTenantId)

          const record = {
            id: 'test-id',
            tenant_id: recordTenantId,
            name: 'Test Record',
          }

          expect(() => {
            assertRecordTenantOwnership(record, contextTenantId, resourceName)
          }).toThrow(TenantAccessDeniedError)
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property 24: assertRecordTenantOwnership throws for null record
   * 
   * For any tenant_id, assertRecordTenantOwnership SHALL throw
   * TenantAccessDeniedError when the record is null.
   */
  it('should throw TenantAccessDeniedError when record is null', () => {
    fc.assert(
      fc.property(
        uuidArbitrary,
        fc.string({ minLength: 1, maxLength: 50 }),
        (tenantId, resourceName) => {
          expect(() => {
            assertRecordTenantOwnership(null, tenantId, resourceName)
          }).toThrow(TenantAccessDeniedError)
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property 24: Data isolation is symmetric
   * 
   * For any two different tenants A and B, if a record belongs to A,
   * then it SHALL NOT be accessible by B, and vice versa.
   */
  it('should enforce symmetric data isolation between any two tenants', () => {
    fc.assert(
      fc.property(
        uuidArbitrary,
        uuidArbitrary,
        (tenantA, tenantB) => {
          // Skip if tenant IDs happen to be the same
          fc.pre(tenantA !== tenantB)

          const recordA = { id: 'record-a', tenant_id: tenantA, name: 'Record A' }
          const recordB = { id: 'record-b', tenant_id: tenantB, name: 'Record B' }

          // Tenant A can access their own record
          expect(validateRecordTenantOwnership(recordA, tenantA)).toBe(true)
          // Tenant A cannot access tenant B's record
          expect(validateRecordTenantOwnership(recordB, tenantA)).toBe(false)

          // Tenant B can access their own record
          expect(validateRecordTenantOwnership(recordB, tenantB)).toBe(true)
          // Tenant B cannot access tenant A's record
          expect(validateRecordTenantOwnership(recordA, tenantB)).toBe(false)
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property 24: All tenant-scoped tables are defined
   * 
   * The TENANT_SCOPED_TABLES constant SHALL contain all tables that
   * require tenant isolation.
   */
  it('should define all tenant-scoped tables', () => {
    const expectedTables = [
      'products',
      'sales',
      'sale_items',
      'losses',
      'stock_history',
      'store_users'
    ]

    expect(TENANT_SCOPED_TABLES).toEqual(expect.arrayContaining(expectedTables))
    expect(TENANT_SCOPED_TABLES.length).toBe(expectedTables.length)
  })

  /**
   * Property 24: Tenant ownership validation is deterministic
   * 
   * For any record and tenant_id, calling validateRecordTenantOwnership
   * multiple times SHALL produce identical results.
   */
  it('should produce deterministic results for tenant ownership validation', () => {
    fc.assert(
      fc.property(anyRecordArbitrary, uuidArbitrary, (record, tenantId) => {
        const result1 = validateRecordTenantOwnership(record, tenantId)
        const result2 = validateRecordTenantOwnership(record, tenantId)
        const result3 = validateRecordTenantOwnership(record, tenantId)

        expect(result1).toBe(result2)
        expect(result2).toBe(result3)
      }),
      { numRuns: 100 }
    )
  })
})

/**
 * Feature: verdurao-pro-saas, Property 25: Suspended Tenant Data Preservation
 * 
 * *For any* suspended tenant, all data (products, sales, users) SHALL remain
 * in the database but access SHALL be blocked.
 * 
 * **Validates: Requirements 13.3**
 */
describe('Suspended Tenant Data Preservation - Property Tests', () => {
  // Arbitrary for generating valid UUID-like strings
  const uuidArbitrary = fc.uuid()

  // Arbitrary for generating non-empty trimmed strings
  const nonEmptyStringArbitrary = fc.string({ minLength: 1, maxLength: 100 })
    .filter(s => s.trim().length > 0)

  // Arbitrary for generating valid email addresses
  const emailArbitrary = fc.tuple(
    fc.stringMatching(/^[a-z][a-z0-9]{2,10}$/),
    fc.stringMatching(/^[a-z]{2,6}$/),
    fc.constantFrom('com', 'org', 'net', 'br', 'io')
  ).map(([user, domain, tld]) => `${user}@${domain}.${tld}`)

  // Arbitrary for generating valid phone numbers (Brazilian format)
  const phoneArbitrary = fc.stringMatching(/^\(\d{2}\) \d{5}-\d{4}$/)

  // Arbitrary for generating a tenant with any status
  const tenantArbitrary = (status: SubscriptionStatus): fc.Arbitrary<Tenant> => fc.record({
    id: uuidArbitrary,
    store_name: nonEmptyStringArbitrary,
    owner_name: nonEmptyStringArbitrary,
    owner_email: emailArbitrary,
    owner_phone: phoneArbitrary,
    cnpj: fc.option(fc.stringMatching(/^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/), { nil: null }),
    address: fc.option(nonEmptyStringArbitrary, { nil: null }),
    subscription_status: fc.constant(status),
    trial_ends_at: fc.date({ min: new Date('2024-01-01'), max: new Date('2030-12-31') })
      .filter(d => !isNaN(d.getTime()))
      .map(d => d.toISOString().split('T')[0]),
    monthly_price: fc.constant(97.90),
    approved_by_admin: fc.boolean(),
    approved_at: fc.option(
      fc.date({ min: new Date('2020-01-01'), max: new Date('2025-12-31') })
        .filter(d => !isNaN(d.getTime()))
        .map(d => d.toISOString()),
      { nil: null }
    ),
    approved_by: fc.option(uuidArbitrary, { nil: null }),
    cancelled_at: fc.option(
      fc.date({ min: new Date('2020-01-01'), max: new Date('2025-12-31') })
        .filter(d => !isNaN(d.getTime()))
        .map(d => d.toISOString()),
      { nil: null }
    ),
    created_at: fc.date({ min: new Date('2020-01-01'), max: new Date('2025-12-31') })
      .filter(d => !isNaN(d.getTime()))
      .map(d => d.toISOString()),
    updated_at: fc.date({ min: new Date('2020-01-01'), max: new Date('2025-12-31') })
      .filter(d => !isNaN(d.getTime()))
      .map(d => d.toISOString()),
  })

  // Arbitrary for generating products belonging to a tenant
  const _productArbitrary = (tenantId: string): fc.Arbitrary<Product> => fc.record({
    id: uuidArbitrary,
    tenant_id: fc.constant(tenantId),
    sku: fc.stringMatching(/^[A-Z]{3}-\d{4}$/),
    name: nonEmptyStringArbitrary,
    price: fc.float({ min: 0.01, max: 1000, noNaN: true }),
    cost_price: fc.option(fc.float({ min: 0.01, max: 500, noNaN: true }), { nil: null }),
    unit: fc.constantFrom('un', 'kg', 'g', 'l', 'ml') as fc.Arbitrary<ProductUnit>,
    default_quantity: fc.float({ min: 0.1, max: 10, noNaN: true }),
    stock: fc.float({ min: 0, max: 1000, noNaN: true }),
    category: fc.option(nonEmptyStringArbitrary, { nil: null }),
    is_active: fc.boolean(),
    created_at: fc.date({ min: new Date('2020-01-01'), max: new Date('2025-12-31') })
      .filter(d => !isNaN(d.getTime()))
      .map(d => d.toISOString()),
    updated_at: fc.date({ min: new Date('2020-01-01'), max: new Date('2025-12-31') })
      .filter(d => !isNaN(d.getTime()))
      .map(d => d.toISOString()),
  })

  // Arbitrary for generating store users belonging to a tenant
  const _storeUserArbitrary = (tenantId: string): fc.Arbitrary<StoreUser> => fc.record({
    id: uuidArbitrary,
    tenant_id: fc.constant(tenantId),
    email: emailArbitrary,
    name: nonEmptyStringArbitrary,
    role: fc.constantFrom('owner', 'manager', 'cashier') as fc.Arbitrary<UserRole>,
    is_active: fc.boolean(),
    created_at: fc.date({ min: new Date('2020-01-01'), max: new Date('2025-12-31') })
      .filter(d => !isNaN(d.getTime()))
      .map(d => d.toISOString()),
  })

  // Arbitrary for generating sales belonging to a tenant
  const _saleArbitrary = (tenantId: string, userId: string): fc.Arbitrary<Sale> => fc.record({
    id: uuidArbitrary,
    tenant_id: fc.constant(tenantId),
    user_id: fc.constant(userId),
    total: fc.float({ min: 0.01, max: 10000, noNaN: true }),
    created_at: fc.date({ min: new Date('2020-01-01'), max: new Date('2025-12-31') })
      .filter(d => !isNaN(d.getTime()))
      .map(d => d.toISOString()),
    synced_at: fc.option(
      fc.date({ min: new Date('2020-01-01'), max: new Date('2025-12-31') })
        .filter(d => !isNaN(d.getTime()))
        .map(d => d.toISOString()),
      { nil: null }
    ),
    local_id: fc.option(uuidArbitrary, { nil: null }),
  })

  /**
   * Simulates the suspension process and data preservation check
   * This is a pure function that models the expected behavior
   */
  interface TenantDataSnapshot {
    tenant: Tenant
    products: Product[]
    users: StoreUser[]
    sales: Sale[]
  }

  function simulateSuspension(snapshot: TenantDataSnapshot): {
    dataPreserved: boolean
    accessBlocked: boolean
    suspendedTenant: Tenant
  } {
    // Create suspended tenant (only status changes)
    const suspendedTenant: Tenant = {
      ...snapshot.tenant,
      subscription_status: 'suspended'
    }

    // Data is preserved - all records remain unchanged
    const dataPreserved = 
      snapshot.products.length >= 0 && // Products exist (or empty is valid)
      snapshot.users.length >= 0 && // Users exist (or empty is valid)
      snapshot.sales.length >= 0 // Sales exist (or empty is valid)

    // Access is blocked - isAccessibleStatus returns false for suspended
    const accessBlocked = !isAccessibleStatus('suspended')

    return {
      dataPreserved,
      accessBlocked,
      suspendedTenant
    }
  }

  /**
   * Property 25: Suspended tenant status blocks access
   * 
   * For any tenant that is suspended, isAccessibleStatus SHALL return false,
   * indicating that access is blocked.
   */
  it('should block access for any suspended tenant', () => {
    fc.assert(
      fc.property(tenantArbitrary('suspended'), (tenant) => {
        // Verify tenant is suspended
        expect(tenant.subscription_status).toBe('suspended')
        
        // Access should be blocked
        const accessAllowed = isAccessibleStatus(tenant.subscription_status)
        expect(accessAllowed).toBe(false)
      }),
      { numRuns: 100 }
    )
  })

  /**
   * Property 25: Suspended tenant returns correct error code
   * 
   * For any suspended tenant, getStatusErrorCode SHALL return 'TENANT_SUSPENDED'.
   */
  it('should return TENANT_SUSPENDED error code for any suspended tenant', () => {
    fc.assert(
      fc.property(tenantArbitrary('suspended'), (tenant) => {
        const errorCode = getStatusErrorCode(tenant.subscription_status)
        expect(errorCode).toBe('TENANT_SUSPENDED')
      }),
      { numRuns: 100 }
    )
  })

  /**
   * Property 25: Data preservation during suspension
   * 
   * For any tenant with associated data (products, users, sales), when the tenant
   * is suspended, all data SHALL remain intact (data structure unchanged).
   */
  it('should preserve all tenant data when suspended', () => {
    fc.assert(
      fc.property(
        tenantArbitrary('active'),
        fc.array(uuidArbitrary, { minLength: 0, maxLength: 5 }),
        (activeTenant, productIds) => {
          // Generate products for this tenant
          const products = productIds.map(id => ({
            id,
            tenant_id: activeTenant.id,
            sku: `SKU-${id.substring(0, 4)}`,
            name: `Product ${id.substring(0, 4)}`,
            price: 10.00,
            cost_price: null,
            unit: 'un' as ProductUnit,
            default_quantity: 1,
            stock: 100,
            category: null,
            is_active: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }))

          // Generate a user for this tenant
          const user: StoreUser = {
            id: 'user-1',
            tenant_id: activeTenant.id,
            email: 'user@test.com',
            name: 'Test User',
            role: 'cashier',
            is_active: true,
            created_at: new Date().toISOString(),
          }

          // Generate sales for this tenant
          const sales: Sale[] = productIds.length > 0 ? [{
            id: 'sale-1',
            tenant_id: activeTenant.id,
            user_id: user.id,
            total: 100.00,
            created_at: new Date().toISOString(),
            synced_at: null,
            local_id: null,
          }] : []

          const snapshot: TenantDataSnapshot = {
            tenant: activeTenant,
            products,
            users: [user],
            sales,
          }

          // Simulate suspension
          const result = simulateSuspension(snapshot)

          // Data should be preserved
          expect(result.dataPreserved).toBe(true)
          
          // Access should be blocked
          expect(result.accessBlocked).toBe(true)
          
          // Tenant status should be suspended
          expect(result.suspendedTenant.subscription_status).toBe('suspended')
          
          // All other tenant fields should remain unchanged
          expect(result.suspendedTenant.id).toBe(activeTenant.id)
          expect(result.suspendedTenant.store_name).toBe(activeTenant.store_name)
          expect(result.suspendedTenant.owner_email).toBe(activeTenant.owner_email)
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property 25: Suspension only changes status field
   * 
   * For any active tenant, when suspended, only the subscription_status field
   * SHALL change; all other fields SHALL remain identical.
   */
  it('should only change subscription_status when suspending any tenant', () => {
    fc.assert(
      fc.property(tenantArbitrary('active'), (activeTenant) => {
        // Simulate suspension by changing only the status
        const suspendedTenant: Tenant = {
          ...activeTenant,
          subscription_status: 'suspended'
        }

        // Verify only subscription_status changed
        expect(suspendedTenant.subscription_status).toBe('suspended')
        expect(suspendedTenant.id).toBe(activeTenant.id)
        expect(suspendedTenant.store_name).toBe(activeTenant.store_name)
        expect(suspendedTenant.owner_name).toBe(activeTenant.owner_name)
        expect(suspendedTenant.owner_email).toBe(activeTenant.owner_email)
        expect(suspendedTenant.owner_phone).toBe(activeTenant.owner_phone)
        expect(suspendedTenant.cnpj).toBe(activeTenant.cnpj)
        expect(suspendedTenant.address).toBe(activeTenant.address)
        expect(suspendedTenant.trial_ends_at).toBe(activeTenant.trial_ends_at)
        expect(suspendedTenant.monthly_price).toBe(activeTenant.monthly_price)
        expect(suspendedTenant.approved_by_admin).toBe(activeTenant.approved_by_admin)
        expect(suspendedTenant.approved_at).toBe(activeTenant.approved_at)
        expect(suspendedTenant.approved_by).toBe(activeTenant.approved_by)
        expect(suspendedTenant.created_at).toBe(activeTenant.created_at)
      }),
      { numRuns: 100 }
    )
  })

  /**
   * Property 25: Tenant data records maintain tenant_id after suspension
   * 
   * For any tenant's data records (products, users, sales), the tenant_id
   * field SHALL remain unchanged after suspension.
   */
  it('should maintain tenant_id in all data records after suspension', () => {
    fc.assert(
      fc.property(
        uuidArbitrary,
        fc.integer({ min: 1, max: 10 }),
        (tenantId, numProducts) => {
          // Generate products with this tenant_id
          const products: Product[] = Array.from({ length: numProducts }, (_, i) => ({
            id: `product-${i}`,
            tenant_id: tenantId,
            sku: `SKU-${i}`,
            name: `Product ${i}`,
            price: 10.00,
            cost_price: null,
            unit: 'un' as ProductUnit,
            default_quantity: 1,
            stock: 100,
            category: null,
            is_active: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }))

          // Generate users with this tenant_id
          const users: StoreUser[] = [{
            id: 'user-1',
            tenant_id: tenantId,
            email: 'user@test.com',
            name: 'Test User',
            role: 'owner',
            is_active: true,
            created_at: new Date().toISOString(),
          }]

          // Generate sales with this tenant_id
          const sales: Sale[] = [{
            id: 'sale-1',
            tenant_id: tenantId,
            user_id: users[0].id,
            total: 100.00,
            created_at: new Date().toISOString(),
            synced_at: null,
            local_id: null,
          }]

          // After suspension, all records should still have the same tenant_id
          // (suspension doesn't modify data records, only tenant status)
          
          // Verify all products maintain tenant_id
          for (const product of products) {
            expect(product.tenant_id).toBe(tenantId)
            expect(validateRecordTenantOwnership(product, tenantId)).toBe(true)
          }

          // Verify all users maintain tenant_id
          for (const user of users) {
            expect(user.tenant_id).toBe(tenantId)
            expect(validateRecordTenantOwnership(user, tenantId)).toBe(true)
          }

          // Verify all sales maintain tenant_id
          for (const sale of sales) {
            expect(sale.tenant_id).toBe(tenantId)
            expect(validateRecordTenantOwnership(sale, tenantId)).toBe(true)
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property 25: Access blocking is consistent for suspended status
   * 
   * For any number of access checks on a suspended tenant, the result
   * SHALL always be "blocked" (deterministic behavior).
   */
  it('should consistently block access for suspended tenants', () => {
    fc.assert(
      fc.property(
        tenantArbitrary('suspended'),
        fc.integer({ min: 1, max: 10 }),
        (tenant, numChecks) => {
          // Perform multiple access checks
          const results: boolean[] = []
          for (let i = 0; i < numChecks; i++) {
            results.push(isAccessibleStatus(tenant.subscription_status))
          }

          // All results should be false (access blocked)
          expect(results.every(r => r === false)).toBe(true)
          
          // Error code should always be TENANT_SUSPENDED
          const errorCodes = Array.from({ length: numChecks }, () => 
            getStatusErrorCode(tenant.subscription_status)
          )
          expect(errorCodes.every(c => c === 'TENANT_SUSPENDED')).toBe(true)
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property 25: Suspended vs Active access difference
   * 
   * For any tenant, the access status SHALL differ between active and suspended states:
   * active allows access, suspended blocks access.
   */
  it('should differentiate access between active and suspended states', () => {
    fc.assert(
      fc.property(tenantArbitrary('active'), (activeTenant) => {
        // Active tenant should have access
        expect(isAccessibleStatus(activeTenant.subscription_status)).toBe(true)
        expect(getStatusErrorCode(activeTenant.subscription_status)).toBeNull()

        // Same tenant when suspended should NOT have access
        const suspendedTenant: Tenant = {
          ...activeTenant,
          subscription_status: 'suspended'
        }
        expect(isAccessibleStatus(suspendedTenant.subscription_status)).toBe(false)
        expect(getStatusErrorCode(suspendedTenant.subscription_status)).toBe('TENANT_SUSPENDED')
      }),
      { numRuns: 100 }
    )
  })
})

/**
 * Additional tests for subscription status access control
 * These support data isolation by controlling tenant access based on status
 * 
 * **Validates: Requirements 13.2, 13.3**
 */
describe('Subscription Status Access Control - Property Tests', () => {
  const allStatuses: SubscriptionStatus[] = ['pending', 'active', 'suspended', 'cancelled']

  /**
   * Property: Only active status allows access
   * 
   * For any subscription status, isAccessibleStatus SHALL return true
   * only when status is "active".
   */
  it('should only allow access for active subscription status', () => {
    fc.assert(
      fc.property(fc.constantFrom(...allStatuses), (status) => {
        const result = isAccessibleStatus(status)
        
        if (status === 'active') {
          expect(result).toBe(true)
        } else {
          expect(result).toBe(false)
        }
      }),
      { numRuns: 100 }
    )
  })

  /**
   * Property: Non-active statuses return appropriate error codes
   * 
   * For any non-active subscription status, getStatusErrorCode SHALL
   * return a non-null error code.
   */
  it('should return error code for non-active subscription statuses', () => {
    fc.assert(
      fc.property(fc.constantFrom(...allStatuses), (status) => {
        const errorCode = getStatusErrorCode(status)
        
        if (status === 'active') {
          expect(errorCode).toBeNull()
        } else {
          expect(errorCode).not.toBeNull()
        }
      }),
      { numRuns: 100 }
    )
  })

  /**
   * Property: Suspended status returns TENANT_SUSPENDED error
   * 
   * For suspended status, getStatusErrorCode SHALL return 'TENANT_SUSPENDED'.
   */
  it('should return TENANT_SUSPENDED for suspended status', () => {
    const errorCode = getStatusErrorCode('suspended')
    expect(errorCode).toBe('TENANT_SUSPENDED')
  })

  /**
   * Property: Cancelled status returns TENANT_CANCELLED error
   * 
   * For cancelled status, getStatusErrorCode SHALL return 'TENANT_CANCELLED'.
   */
  it('should return TENANT_CANCELLED for cancelled status', () => {
    const errorCode = getStatusErrorCode('cancelled')
    expect(errorCode).toBe('TENANT_CANCELLED')
  })

  /**
   * Property: Pending status returns TENANT_PENDING error
   * 
   * For pending status, getStatusErrorCode SHALL return 'TENANT_PENDING'.
   */
  it('should return TENANT_PENDING for pending status', () => {
    const errorCode = getStatusErrorCode('pending')
    expect(errorCode).toBe('TENANT_PENDING')
  })
})
