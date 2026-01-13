import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import {
  sortTenantsByCreatedAt,
  isOrderedByCreatedAtAscending,
  filterPendingTenants,
} from './admin.service'
import { Tenant, SubscriptionStatus } from '@/types'

/**
 * Feature: verdurao-pro-saas, Property 5: Pending Tenants Ordering
 * 
 * *For any* query of pending tenants, the results SHALL be ordered by
 * created_at in ascending order (oldest first).
 * 
 * **Validates: Requirements 3.2**
 */
describe('Pending Tenants Ordering - Property Tests', () => {
  // Arbitrary for generating valid email addresses
  const emailArbitrary = fc.tuple(
    fc.stringMatching(/^[a-z][a-z0-9]{2,10}$/),
    fc.stringMatching(/^[a-z]{2,6}$/),
    fc.constantFrom('com', 'org', 'net', 'br', 'io')
  ).map(([user, domain, tld]) => `${user}@${domain}.${tld}`)

  // Arbitrary for generating valid phone numbers (Brazilian format)
  const phoneArbitrary = fc.stringMatching(/^\(\d{2}\) \d{5}-\d{4}$/)

  // Arbitrary for generating non-empty trimmed strings
  const nonEmptyStringArbitrary = fc.string({ minLength: 1, maxLength: 100 })
    .filter(s => s.trim().length > 0)

  // Arbitrary for generating subscription status
  const subscriptionStatusArbitrary: fc.Arbitrary<SubscriptionStatus> = fc.constantFrom(
    'pending', 'active', 'suspended', 'cancelled'
  )

  // Arbitrary for generating valid ISO date strings
  const isoDateStringArbitrary = fc.date({
    min: new Date('2020-01-01'),
    max: new Date('2030-12-31'),
  }).filter(d => !isNaN(d.getTime()))
    .map(d => d.toISOString())

  // Arbitrary for generating a tenant with a specific subscription status
  const tenantWithStatusArbitrary = (status: SubscriptionStatus): fc.Arbitrary<Tenant> => fc.record({
    id: fc.uuid(),
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
    approved_by_admin: fc.constant(status === 'active'),
    approved_at: fc.constant(status === 'active' ? new Date().toISOString() : null),
    approved_by: fc.constant(status === 'active' ? 'admin-uuid' : null),
    created_at: isoDateStringArbitrary,
    updated_at: isoDateStringArbitrary,
  })

  // Arbitrary for generating a tenant with any status
  const tenantArbitrary: fc.Arbitrary<Tenant> = fc.record({
    id: fc.uuid(),
    store_name: nonEmptyStringArbitrary,
    owner_name: nonEmptyStringArbitrary,
    owner_email: emailArbitrary,
    owner_phone: phoneArbitrary,
    cnpj: fc.option(fc.stringMatching(/^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/), { nil: null }),
    address: fc.option(nonEmptyStringArbitrary, { nil: null }),
    subscription_status: subscriptionStatusArbitrary,
    trial_ends_at: fc.date({ min: new Date('2024-01-01'), max: new Date('2030-12-31') })
      .filter(d => !isNaN(d.getTime()))
      .map(d => d.toISOString().split('T')[0]),
    monthly_price: fc.constant(97.90),
    approved_by_admin: fc.boolean(),
    approved_at: fc.option(isoDateStringArbitrary, { nil: null }),
    approved_by: fc.option(fc.uuid(), { nil: null }),
    created_at: isoDateStringArbitrary,
    updated_at: isoDateStringArbitrary,
  })

  // Arbitrary for generating pending tenants
  const pendingTenantArbitrary = tenantWithStatusArbitrary('pending')

  /**
   * Property 5: Sorting produces ascending order by created_at
   * 
   * For any array of tenants, after sorting by created_at,
   * the result SHALL be in ascending order (oldest first).
   */
  it('should sort any array of tenants by created_at in ascending order', () => {
    fc.assert(
      fc.property(fc.array(pendingTenantArbitrary, { minLength: 0, maxLength: 50 }), (tenants) => {
        const sorted = sortTenantsByCreatedAt(tenants)
        
        // Verify the result is in ascending order
        expect(isOrderedByCreatedAtAscending(sorted)).toBe(true)
      }),
      { numRuns: 100 }
    )
  })

  /**
   * Property 5: Sorting preserves all elements
   * 
   * For any array of tenants, sorting SHALL preserve all elements
   * (same length and same elements, just reordered).
   */
  it('should preserve all tenants when sorting', () => {
    fc.assert(
      fc.property(fc.array(pendingTenantArbitrary, { minLength: 0, maxLength: 50 }), (tenants) => {
        const sorted = sortTenantsByCreatedAt(tenants)
        
        // Same length
        expect(sorted.length).toBe(tenants.length)
        
        // All original IDs are present in sorted result
        const originalIds = new Set(tenants.map(t => t.id))
        const sortedIds = new Set(sorted.map(t => t.id))
        expect(sortedIds).toEqual(originalIds)
      }),
      { numRuns: 100 }
    )
  })

  /**
   * Property 5: Sorting is idempotent
   * 
   * For any array of tenants, sorting twice SHALL produce the same result as sorting once.
   */
  it('should be idempotent - sorting twice equals sorting once', () => {
    fc.assert(
      fc.property(fc.array(pendingTenantArbitrary, { minLength: 0, maxLength: 50 }), (tenants) => {
        const sortedOnce = sortTenantsByCreatedAt(tenants)
        const sortedTwice = sortTenantsByCreatedAt(sortedOnce)
        
        // Results should be identical
        expect(sortedTwice.map(t => t.id)).toEqual(sortedOnce.map(t => t.id))
      }),
      { numRuns: 100 }
    )
  })

  /**
   * Property 5: Empty array handling
   * 
   * For an empty array, sorting SHALL return an empty array.
   */
  it('should handle empty arrays correctly', () => {
    const sorted = sortTenantsByCreatedAt([])
    expect(sorted).toEqual([])
    expect(isOrderedByCreatedAtAscending(sorted)).toBe(true)
  })

  /**
   * Property 5: Single element handling
   * 
   * For a single-element array, sorting SHALL return the same element.
   */
  it('should handle single-element arrays correctly', () => {
    fc.assert(
      fc.property(pendingTenantArbitrary, (tenant) => {
        const sorted = sortTenantsByCreatedAt([tenant])
        
        expect(sorted.length).toBe(1)
        expect(sorted[0].id).toBe(tenant.id)
        expect(isOrderedByCreatedAtAscending(sorted)).toBe(true)
      }),
      { numRuns: 100 }
    )
  })

  /**
   * Property 5: Filter then sort produces correctly ordered pending tenants
   * 
   * For any mixed array of tenants, filtering for pending status and then sorting
   * SHALL produce a correctly ordered array of only pending tenants.
   */
  it('should correctly filter and sort pending tenants from mixed array', () => {
    fc.assert(
      fc.property(fc.array(tenantArbitrary, { minLength: 0, maxLength: 50 }), (tenants) => {
        const pending = filterPendingTenants(tenants)
        const sorted = sortTenantsByCreatedAt(pending)
        
        // All results should be pending
        sorted.forEach(t => {
          expect(t.subscription_status).toBe('pending')
        })
        
        // Results should be in ascending order
        expect(isOrderedByCreatedAtAscending(sorted)).toBe(true)
        
        // Count should match original pending count
        const originalPendingCount = tenants.filter(t => t.subscription_status === 'pending').length
        expect(sorted.length).toBe(originalPendingCount)
      }),
      { numRuns: 100 }
    )
  })

  /**
   * Property 5: Ordering verification function is correct
   * 
   * For any sorted array, isOrderedByCreatedAtAscending SHALL return true.
   * For any unsorted array with at least 2 elements where order is reversed,
   * it SHALL return false.
   */
  it('should correctly verify ordering for any array', () => {
    fc.assert(
      fc.property(fc.array(pendingTenantArbitrary, { minLength: 2, maxLength: 50 }), (tenants) => {
        const sorted = sortTenantsByCreatedAt(tenants)
        
        // Sorted array should pass verification
        expect(isOrderedByCreatedAtAscending(sorted)).toBe(true)
        
        // Reversed array should fail verification (if dates are different)
        const reversed = [...sorted].reverse()
        const hasDistinctDates = sorted.some((t, i) => 
          i > 0 && new Date(sorted[i-1].created_at).getTime() !== new Date(t.created_at).getTime()
        )
        
        if (hasDistinctDates) {
          expect(isOrderedByCreatedAtAscending(reversed)).toBe(false)
        }
      }),
      { numRuns: 100 }
    )
  })
})
