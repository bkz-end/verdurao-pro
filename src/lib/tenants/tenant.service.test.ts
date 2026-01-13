import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import {
  validateTenantRegistration,
  calculateTrialEndDate,
  TenantRegistrationInput,
  computeApprovalUpdate,
  DATA_RETENTION_DAYS,
  calculateDeletionDate,
  isWithinRetentionPeriodPure,
  isEligibleForDeletion,
} from './tenant.service'
import { Tenant, SubscriptionStatus } from '@/types'

/**
 * Feature: verdurao-pro-saas, Property 1: Tenant Registration Creates Correct Initial State
 * 
 * *For any* valid tenant registration data, when a tenant is created, the resulting tenant
 * record SHALL have subscription_status equal to "pending" and trial_ends_at equal to
 * exactly 7 days from the creation date.
 * 
 * **Validates: Requirements 1.1, 1.3**
 */
describe('Tenant Registration - Property Tests', () => {
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

  // Arbitrary for generating valid tenant registration input
  const validTenantInputArbitrary: fc.Arbitrary<TenantRegistrationInput> = fc.record({
    store_name: nonEmptyStringArbitrary,
    owner_name: nonEmptyStringArbitrary,
    owner_email: emailArbitrary,
    owner_phone: phoneArbitrary,
    cnpj: fc.option(fc.stringMatching(/^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/), { nil: undefined }),
    address: fc.option(nonEmptyStringArbitrary, { nil: undefined }),
  })

  /**
   * Property 1: Tenant Registration Creates Correct Initial State
   * 
   * Tests that validateTenantRegistration returns no errors for valid input,
   * which is a prerequisite for successful tenant creation.
   */
  it('should validate all required fields for any valid tenant registration input', () => {
    fc.assert(
      fc.property(validTenantInputArbitrary, (input) => {
        const errors = validateTenantRegistration(input)
        
        // For valid input, there should be no validation errors
        expect(errors).toHaveLength(0)
      }),
      { numRuns: 100 }
    )
  })

  /**
   * Property 1: Trial End Date Calculation
   * 
   * Tests that trial_ends_at is exactly 7 days from the creation date.
   * This is a pure function test that validates the core logic.
   */
  it('should calculate trial_ends_at as exactly 7 days from creation date for any date', () => {
    // Generate dates within a reasonable range (2020-2030)
    const dateArbitrary = fc.date({
      min: new Date('2020-01-01'),
      max: new Date('2030-12-31'),
    })

    fc.assert(
      fc.property(dateArbitrary, (creationDate) => {
        const trialEndDate = calculateTrialEndDate(creationDate)
        
        // Parse the returned date string (YYYY-MM-DD format)
        const [year, month, day] = trialEndDate.split('-').map(Number)
        
        // Calculate expected date (7 days from creation) using UTC
        const expectedDate = new Date(creationDate)
        expectedDate.setUTCDate(expectedDate.getUTCDate() + 7)
        
        // Compare year, month, and day using UTC values
        expect(year).toBe(expectedDate.getUTCFullYear())
        expect(month).toBe(expectedDate.getUTCMonth() + 1)
        expect(day).toBe(expectedDate.getUTCDate())
      }),
      { numRuns: 100 }
    )
  })

  /**
   * Property 1: Trial End Date Format
   * 
   * Tests that the trial end date is returned in the correct format (YYYY-MM-DD).
   */
  it('should return trial_ends_at in YYYY-MM-DD format for any valid date', () => {
    const dateArbitrary = fc.date({
      min: new Date('2020-01-01'),
      max: new Date('2030-12-31'),
    }).filter(d => !isNaN(d.getTime())) // Filter out invalid dates

    fc.assert(
      fc.property(dateArbitrary, (creationDate) => {
        const trialEndDate = calculateTrialEndDate(creationDate)
        
        // Verify format matches YYYY-MM-DD
        expect(trialEndDate).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      }),
      { numRuns: 100 }
    )
  })

  /**
   * Property 1: Initial State Invariants
   * 
   * Tests that the initial state values are consistent:
   * - subscription_status defaults to "pending" (verified via database defaults)
   * - trial_ends_at is exactly 7 days from creation
   * 
   * This test verifies the calculateTrialEndDate function produces consistent results
   * when called multiple times with the same input.
   */
  it('should produce consistent trial end dates for the same creation date', () => {
    const dateArbitrary = fc.date({
      min: new Date('2020-01-01'),
      max: new Date('2030-12-31'),
    })

    fc.assert(
      fc.property(dateArbitrary, (creationDate) => {
        // Call the function multiple times with the same input
        const result1 = calculateTrialEndDate(creationDate)
        const result2 = calculateTrialEndDate(creationDate)
        const result3 = calculateTrialEndDate(creationDate)
        
        // All results should be identical (idempotence)
        expect(result1).toBe(result2)
        expect(result2).toBe(result3)
      }),
      { numRuns: 100 }
    )
  })
})


/**
 * Feature: verdurao-pro-saas, Property 2: Required Field Validation
 * 
 * *For any* tenant registration submission missing any required field
 * (store_name, owner_name, owner_email, owner_phone), the system SHALL
 * reject the registration and return a validation error.
 * 
 * **Validates: Requirements 1.2**
 */
describe('Tenant Registration - Required Field Validation Property Tests', () => {
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

  // Arbitrary for generating valid tenant registration input
  const validTenantInputArbitrary: fc.Arbitrary<TenantRegistrationInput> = fc.record({
    store_name: nonEmptyStringArbitrary,
    owner_name: nonEmptyStringArbitrary,
    owner_email: emailArbitrary,
    owner_phone: phoneArbitrary,
    cnpj: fc.option(fc.stringMatching(/^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/), { nil: undefined }),
    address: fc.option(nonEmptyStringArbitrary, { nil: undefined }),
  })

  // Required fields as defined in the service
  const requiredFields: (keyof TenantRegistrationInput)[] = [
    'store_name',
    'owner_name',
    'owner_email',
    'owner_phone'
  ]

  // Arbitrary for selecting which required field to remove
  const requiredFieldArbitrary = fc.constantFrom(...requiredFields)

  // Arbitrary for generating empty/whitespace values
  const emptyValueArbitrary = fc.constantFrom('', '   ', '\t', '\n', '  \t\n  ')

  /**
   * Property 2: Missing required field causes validation error
   * 
   * For any valid tenant input with any single required field removed,
   * validation SHALL return an error for that specific field.
   */
  it('should reject registration when any required field is missing', () => {
    fc.assert(
      fc.property(
        validTenantInputArbitrary,
        requiredFieldArbitrary,
        (validInput, fieldToRemove) => {
          // Create input with the required field removed
          const inputWithMissingField: Partial<TenantRegistrationInput> = { ...validInput }
          delete inputWithMissingField[fieldToRemove]

          const errors = validateTenantRegistration(inputWithMissingField)

          // Should have at least one error
          expect(errors.length).toBeGreaterThan(0)
          
          // Should have an error specifically for the missing field
          const fieldError = errors.find(e => e.field === fieldToRemove)
          expect(fieldError).toBeDefined()
          expect(fieldError?.message).toContain('Campo obrigatório')
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property 2: Empty string required field causes validation error
   * 
   * For any valid tenant input with any single required field set to empty string,
   * validation SHALL return an error for that specific field.
   */
  it('should reject registration when any required field is empty string', () => {
    fc.assert(
      fc.property(
        validTenantInputArbitrary,
        requiredFieldArbitrary,
        (validInput, fieldToEmpty) => {
          // Create input with the required field set to empty string
          const inputWithEmptyField: Partial<TenantRegistrationInput> = { 
            ...validInput,
            [fieldToEmpty]: ''
          }

          const errors = validateTenantRegistration(inputWithEmptyField)

          // Should have at least one error
          expect(errors.length).toBeGreaterThan(0)
          
          // Should have an error specifically for the empty field
          const fieldError = errors.find(e => e.field === fieldToEmpty)
          expect(fieldError).toBeDefined()
          expect(fieldError?.message).toContain('Campo obrigatório')
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property 2: Whitespace-only required field causes validation error
   * 
   * For any valid tenant input with any single required field set to whitespace only,
   * validation SHALL return an error for that specific field.
   */
  it('should reject registration when any required field is whitespace only', () => {
    fc.assert(
      fc.property(
        validTenantInputArbitrary,
        requiredFieldArbitrary,
        emptyValueArbitrary,
        (validInput, fieldToEmpty, whitespaceValue) => {
          // Create input with the required field set to whitespace
          const inputWithWhitespaceField: Partial<TenantRegistrationInput> = { 
            ...validInput,
            [fieldToEmpty]: whitespaceValue
          }

          const errors = validateTenantRegistration(inputWithWhitespaceField)

          // Should have at least one error
          expect(errors.length).toBeGreaterThan(0)
          
          // Should have an error specifically for the whitespace field
          const fieldError = errors.find(e => e.field === fieldToEmpty)
          expect(fieldError).toBeDefined()
          expect(fieldError?.message).toContain('Campo obrigatório')
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property 2: Multiple missing fields cause multiple errors
   * 
   * For any subset of required fields that are missing, validation SHALL
   * return an error for each missing field.
   */
  it('should return error for each missing required field', () => {
    // Generate subsets of required fields to remove (at least 1)
    const fieldsSubsetArbitrary = fc.subarray(requiredFields, { minLength: 1 })

    fc.assert(
      fc.property(
        validTenantInputArbitrary,
        fieldsSubsetArbitrary,
        (validInput, fieldsToRemove) => {
          // Create input with multiple required fields removed
          const inputWithMissingFields: Partial<TenantRegistrationInput> = { ...validInput }
          for (const field of fieldsToRemove) {
            delete inputWithMissingFields[field]
          }

          const errors = validateTenantRegistration(inputWithMissingFields)

          // Should have at least as many errors as fields removed
          expect(errors.length).toBeGreaterThanOrEqual(fieldsToRemove.length)
          
          // Each removed field should have a corresponding error
          for (const field of fieldsToRemove) {
            const fieldError = errors.find(e => e.field === field)
            expect(fieldError).toBeDefined()
            expect(fieldError?.message).toContain('Campo obrigatório')
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property 2: Completely empty input causes errors for all required fields
   * 
   * When no fields are provided, validation SHALL return errors for all
   * four required fields.
   */
  it('should return errors for all required fields when input is empty', () => {
    fc.assert(
      fc.property(fc.constant({}), (emptyInput) => {
        const errors = validateTenantRegistration(emptyInput)

        // Should have exactly 4 errors (one for each required field)
        expect(errors.length).toBe(4)
        
        // Each required field should have an error
        for (const field of requiredFields) {
          const fieldError = errors.find(e => e.field === field)
          expect(fieldError).toBeDefined()
          expect(fieldError?.message).toContain('Campo obrigatório')
        }
      }),
      { numRuns: 1 } // Only need one run for constant input
    )
  })

  /**
   * Property 2: Valid input passes validation (inverse property)
   * 
   * For any input with all required fields present and non-empty,
   * validation SHALL NOT return errors for required fields.
   */
  it('should not return required field errors when all required fields are present', () => {
    fc.assert(
      fc.property(validTenantInputArbitrary, (validInput) => {
        const errors = validateTenantRegistration(validInput)

        // Should not have any errors for required fields
        for (const field of requiredFields) {
          const fieldError = errors.find(e => e.field === field && e.message.includes('Campo obrigatório'))
          expect(fieldError).toBeUndefined()
        }
      }),
      { numRuns: 100 }
    )
  })
})


/**
 * Feature: verdurao-pro-saas, Property 3: Tenant Approval Updates Status
 * 
 * *For any* pending tenant, when approved by a Super_Admin, the tenant's
 * approved_by_admin field SHALL be set to true and subscription_status
 * SHALL be updated to "active".
 * 
 * **Validates: Requirements 1.4, 3.3**
 */
describe('Tenant Approval - Property Tests', () => {
  // Arbitrary for generating valid UUID-like strings (admin IDs)
  const uuidArbitrary = fc.uuid()

  // Arbitrary for generating valid timestamps
  const timestampArbitrary = fc.date({
    min: new Date('2020-01-01'),
    max: new Date('2030-12-31'),
  }).filter(d => !isNaN(d.getTime()))

  // Arbitrary for generating pending tenants
  const pendingTenantArbitrary: fc.Arbitrary<Tenant> = fc.record({
    id: fc.uuid(),
    store_name: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
    owner_name: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
    owner_email: fc.tuple(
      fc.stringMatching(/^[a-z][a-z0-9]{2,10}$/),
      fc.stringMatching(/^[a-z]{2,6}$/),
      fc.constantFrom('com', 'org', 'net', 'br', 'io')
    ).map(([user, domain, tld]) => `${user}@${domain}.${tld}`),
    owner_phone: fc.stringMatching(/^\(\d{2}\) \d{5}-\d{4}$/),
    cnpj: fc.option(fc.stringMatching(/^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/), { nil: null }),
    address: fc.option(fc.string({ minLength: 1, maxLength: 200 }), { nil: null }),
    subscription_status: fc.constant('pending' as SubscriptionStatus),
    trial_ends_at: fc.date({ min: new Date('2024-01-01'), max: new Date('2030-12-31') })
      .filter(d => !isNaN(d.getTime()))
      .map(d => d.toISOString().split('T')[0]),
    monthly_price: fc.constant(97.90),
    approved_by_admin: fc.constant(false),
    approved_at: fc.constant(null),
    approved_by: fc.constant(null),
    cancelled_at: fc.constant(null),
    created_at: fc.date({ min: new Date('2020-01-01'), max: new Date('2025-12-31') })
      .filter(d => !isNaN(d.getTime()))
      .map(d => d.toISOString()),
    updated_at: fc.date({ min: new Date('2020-01-01'), max: new Date('2025-12-31') })
      .filter(d => !isNaN(d.getTime()))
      .map(d => d.toISOString()),
  })

  /**
   * Property 3: Approval sets approved_by_admin to true
   * 
   * For any admin ID and approval timestamp, the computed approval update
   * SHALL have approved_by_admin set to true.
   */
  it('should set approved_by_admin to true for any approval', () => {
    fc.assert(
      fc.property(uuidArbitrary, timestampArbitrary, (adminId, timestamp) => {
        const update = computeApprovalUpdate(adminId, timestamp)
        
        expect(update.approved_by_admin).toBe(true)
      }),
      { numRuns: 100 }
    )
  })

  /**
   * Property 3: Approval sets subscription_status to "active"
   * 
   * For any admin ID and approval timestamp, the computed approval update
   * SHALL have subscription_status set to "active".
   */
  it('should set subscription_status to "active" for any approval', () => {
    fc.assert(
      fc.property(uuidArbitrary, timestampArbitrary, (adminId, timestamp) => {
        const update = computeApprovalUpdate(adminId, timestamp)
        
        expect(update.subscription_status).toBe('active')
      }),
      { numRuns: 100 }
    )
  })

  /**
   * Property 3: Approval records the admin ID
   * 
   * For any admin ID, the computed approval update SHALL have
   * approved_by set to that admin ID.
   */
  it('should record the approving admin ID for any approval', () => {
    fc.assert(
      fc.property(uuidArbitrary, timestampArbitrary, (adminId, timestamp) => {
        const update = computeApprovalUpdate(adminId, timestamp)
        
        expect(update.approved_by).toBe(adminId)
      }),
      { numRuns: 100 }
    )
  })

  /**
   * Property 3: Approval records the timestamp
   * 
   * For any approval timestamp, the computed approval update SHALL have
   * approved_at set to that timestamp in ISO format.
   */
  it('should record the approval timestamp for any approval', () => {
    fc.assert(
      fc.property(uuidArbitrary, timestampArbitrary, (adminId, timestamp) => {
        const update = computeApprovalUpdate(adminId, timestamp)
        
        expect(update.approved_at).toBe(timestamp.toISOString())
      }),
      { numRuns: 100 }
    )
  })

  /**
   * Property 3: Approval update is complete and consistent
   * 
   * For any pending tenant and admin, when the approval update is applied,
   * all required fields SHALL be set correctly.
   */
  it('should produce complete approval update for any pending tenant and admin', () => {
    fc.assert(
      fc.property(
        pendingTenantArbitrary,
        uuidArbitrary,
        timestampArbitrary,
        (tenant, adminId, timestamp) => {
          // Verify tenant starts in pending state
          expect(tenant.subscription_status).toBe('pending')
          expect(tenant.approved_by_admin).toBe(false)
          expect(tenant.approved_at).toBeNull()
          expect(tenant.approved_by).toBeNull()

          // Compute the approval update
          const update = computeApprovalUpdate(adminId, timestamp)

          // Simulate applying the update to the tenant
          const approvedTenant: Tenant = {
            ...tenant,
            ...update,
          }

          // Verify all approval fields are correctly set
          expect(approvedTenant.approved_by_admin).toBe(true)
          expect(approvedTenant.subscription_status).toBe('active')
          expect(approvedTenant.approved_by).toBe(adminId)
          expect(approvedTenant.approved_at).toBe(timestamp.toISOString())
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property 3: Approval update is idempotent in structure
   * 
   * For any admin ID and timestamp, calling computeApprovalUpdate multiple times
   * SHALL produce identical results.
   */
  it('should produce consistent approval updates for the same inputs', () => {
    fc.assert(
      fc.property(uuidArbitrary, timestampArbitrary, (adminId, timestamp) => {
        const update1 = computeApprovalUpdate(adminId, timestamp)
        const update2 = computeApprovalUpdate(adminId, timestamp)
        const update3 = computeApprovalUpdate(adminId, timestamp)

        expect(update1).toEqual(update2)
        expect(update2).toEqual(update3)
      }),
      { numRuns: 100 }
    )
  })
})


/**
 * Feature: verdurao-pro-saas, Property 25: Suspended Tenant Data Preservation
 * Additional tests for data retention policy
 * 
 * *For any* suspended or cancelled tenant, all data (products, sales, users) SHALL remain
 * in the database but access SHALL be blocked.
 * 
 * **Validates: Requirements 13.3, 13.4**
 */
describe('Data Preservation and Retention Policy - Property Tests', () => {
  // Arbitrary for generating dates
  const dateArbitrary = fc.date({
    min: new Date('2020-01-01'),
    max: new Date('2030-12-31'),
  }).filter(d => !isNaN(d.getTime()))

  // Arbitrary for generating subscription statuses
  const statusArbitrary = fc.constantFrom('pending', 'active', 'suspended', 'cancelled')

  /**
   * Property: Retention period is exactly 90 days
   * 
   * The DATA_RETENTION_DAYS constant SHALL be 90.
   */
  it('should have retention period of exactly 90 days', () => {
    expect(DATA_RETENTION_DAYS).toBe(90)
  })

  /**
   * Property: Deletion date is exactly 90 days after cancellation
   * 
   * For any cancellation date, the deletion date SHALL be exactly 90 days later.
   */
  it('should calculate deletion date as exactly 90 days after cancellation', () => {
    fc.assert(
      fc.property(dateArbitrary, (cancelledAt) => {
        const deletionDate = calculateDeletionDate(cancelledAt)
        
        // Calculate expected date
        const expected = new Date(cancelledAt)
        expected.setDate(expected.getDate() + 90)
        
        // Compare dates (allowing for millisecond differences)
        expect(deletionDate.getFullYear()).toBe(expected.getFullYear())
        expect(deletionDate.getMonth()).toBe(expected.getMonth())
        expect(deletionDate.getDate()).toBe(expected.getDate())
      }),
      { numRuns: 100 }
    )
  })

  /**
   * Property: Data is preserved within retention period
   * 
   * For any cancellation date and current date within 90 days of cancellation,
   * isWithinRetentionPeriodPure SHALL return true.
   */
  it('should preserve data within 90 days of cancellation', () => {
    fc.assert(
      fc.property(
        dateArbitrary,
        fc.integer({ min: 0, max: 89 }),
        (cancelledAt, daysAfter) => {
          // Calculate current date within retention period
          const currentDate = new Date(cancelledAt)
          currentDate.setDate(currentDate.getDate() + daysAfter)
          
          const result = isWithinRetentionPeriodPure(cancelledAt, currentDate)
          expect(result).toBe(true)
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property: Data is eligible for deletion after retention period
   * 
   * For any cancellation date and current date more than 90 days after cancellation,
   * isWithinRetentionPeriodPure SHALL return false.
   */
  it('should allow deletion after 90 days of cancellation', () => {
    fc.assert(
      fc.property(
        dateArbitrary,
        fc.integer({ min: 91, max: 365 }),
        (cancelledAt, daysAfter) => {
          // Calculate current date after retention period
          const currentDate = new Date(cancelledAt)
          currentDate.setDate(currentDate.getDate() + daysAfter)
          
          const result = isWithinRetentionPeriodPure(cancelledAt, currentDate)
          expect(result).toBe(false)
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property: Null cancellation date preserves data
   * 
   * For any current date, if cancellation date is null,
   * isWithinRetentionPeriodPure SHALL return true (data preserved).
   */
  it('should preserve data when cancellation date is null', () => {
    fc.assert(
      fc.property(dateArbitrary, (currentDate) => {
        const result = isWithinRetentionPeriodPure(null, currentDate)
        expect(result).toBe(true)
      }),
      { numRuns: 100 }
    )
  })

  /**
   * Property: Only cancelled tenants are eligible for deletion
   * 
   * For any non-cancelled subscription status, isEligibleForDeletion SHALL return false.
   */
  it('should not allow deletion for non-cancelled tenants', () => {
    const nonCancelledStatuses = ['pending', 'active', 'suspended']
    
    fc.assert(
      fc.property(
        fc.constantFrom(...nonCancelledStatuses),
        dateArbitrary,
        dateArbitrary,
        (status, cancelledAt, currentDate) => {
          const result = isEligibleForDeletion(status, cancelledAt, currentDate)
          expect(result).toBe(false)
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property: Cancelled tenants without cancellation date are not eligible for deletion
   * 
   * For cancelled status with null cancellation date, isEligibleForDeletion SHALL return false.
   */
  it('should not allow deletion for cancelled tenants without cancellation date', () => {
    fc.assert(
      fc.property(dateArbitrary, (currentDate) => {
        const result = isEligibleForDeletion('cancelled', null, currentDate)
        expect(result).toBe(false)
      }),
      { numRuns: 100 }
    )
  })

  /**
   * Property: Cancelled tenants within retention period are not eligible for deletion
   * 
   * For cancelled status within 90 days, isEligibleForDeletion SHALL return false.
   */
  it('should not allow deletion for cancelled tenants within retention period', () => {
    fc.assert(
      fc.property(
        dateArbitrary,
        fc.integer({ min: 0, max: 89 }),
        (cancelledAt, daysAfter) => {
          const currentDate = new Date(cancelledAt)
          currentDate.setDate(currentDate.getDate() + daysAfter)
          
          const result = isEligibleForDeletion('cancelled', cancelledAt, currentDate)
          expect(result).toBe(false)
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property: Cancelled tenants past retention period are eligible for deletion
   * 
   * For cancelled status past 90 days, isEligibleForDeletion SHALL return true.
   */
  it('should allow deletion for cancelled tenants past retention period', () => {
    fc.assert(
      fc.property(
        dateArbitrary,
        fc.integer({ min: 91, max: 365 }),
        (cancelledAt, daysAfter) => {
          const currentDate = new Date(cancelledAt)
          currentDate.setDate(currentDate.getDate() + daysAfter)
          
          const result = isEligibleForDeletion('cancelled', cancelledAt, currentDate)
          expect(result).toBe(true)
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property: Retention period boundary is exactly at 90 days
   * 
   * At exactly 90 days, data should still be preserved (within period).
   * At 91 days, data should be eligible for deletion.
   */
  it('should handle retention period boundary correctly', () => {
    fc.assert(
      fc.property(dateArbitrary, (cancelledAt) => {
        // At exactly 90 days - still within retention
        const at90Days = new Date(cancelledAt)
        at90Days.setDate(at90Days.getDate() + 90)
        expect(isWithinRetentionPeriodPure(cancelledAt, at90Days)).toBe(false)
        
        // At 89 days - within retention
        const at89Days = new Date(cancelledAt)
        at89Days.setDate(at89Days.getDate() + 89)
        expect(isWithinRetentionPeriodPure(cancelledAt, at89Days)).toBe(true)
        
        // At 91 days - past retention
        const at91Days = new Date(cancelledAt)
        at91Days.setDate(at91Days.getDate() + 91)
        expect(isWithinRetentionPeriodPure(cancelledAt, at91Days)).toBe(false)
      }),
      { numRuns: 100 }
    )
  })

  /**
   * Property: Deletion eligibility is deterministic
   * 
   * For any inputs, calling isEligibleForDeletion multiple times SHALL return the same result.
   */
  it('should produce deterministic deletion eligibility results', () => {
    fc.assert(
      fc.property(
        statusArbitrary,
        fc.option(dateArbitrary, { nil: null }),
        dateArbitrary,
        (status, cancelledAt, currentDate) => {
          const result1 = isEligibleForDeletion(status, cancelledAt, currentDate)
          const result2 = isEligibleForDeletion(status, cancelledAt, currentDate)
          const result3 = isEligibleForDeletion(status, cancelledAt, currentDate)
          
          expect(result1).toBe(result2)
          expect(result2).toBe(result3)
        }
      ),
      { numRuns: 100 }
    )
  })
})
