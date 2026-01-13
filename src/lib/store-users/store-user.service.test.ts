import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import {
  validateAddEmployeeInput,
  isUserActive,
  AddEmployeeInput,
} from './store-user.service'
import { StoreUser, UserRole } from '@/types'

/**
 * Feature: verdurao-pro-saas, Property 20: Employee Deactivation Blocks Access
 * 
 * *For any* store user that is deactivated (is_active = false),
 * authentication attempts SHALL fail immediately.
 * 
 * **Validates: Requirements 10.2**
 */
describe('Store User Service - Employee Access Control Property Tests', () => {
  // Valid roles for store users
  const validRoles: UserRole[] = ['owner', 'manager', 'cashier']

  // Arbitrary for generating valid email addresses
  const emailArbitrary = fc.tuple(
    fc.stringMatching(/^[a-z][a-z0-9]{2,10}$/),
    fc.stringMatching(/^[a-z]{2,6}$/),
    fc.constantFrom('com', 'org', 'net', 'br', 'io')
  ).map(([user, domain, tld]) => `${user}@${domain}.${tld}`)

  // Arbitrary for generating non-empty trimmed strings
  const nonEmptyStringArbitrary = fc.string({ minLength: 1, maxLength: 100 })
    .filter(s => s.trim().length > 0)

  // Arbitrary for generating valid user roles
  const roleArbitrary = fc.constantFrom<UserRole>(...validRoles)

  // Arbitrary for generating store users
  const storeUserArbitrary = (isActive: boolean): fc.Arbitrary<StoreUser> => fc.record({
    id: fc.uuid(),
    tenant_id: fc.uuid(),
    email: emailArbitrary,
    name: nonEmptyStringArbitrary,
    role: roleArbitrary,
    is_active: fc.constant(isActive),
    created_at: fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') })
      .filter(d => !isNaN(d.getTime()))
      .map(d => d.toISOString()),
  })

  /**
   * Property 20: Deactivated users cannot access the system
   * 
   * For any store user with is_active = false, the isUserActive function
   * SHALL return false, blocking access.
   */
  it('should block access for any deactivated user', () => {
    fc.assert(
      fc.property(storeUserArbitrary(false), (user) => {
        const canAccess = isUserActive(user)
        expect(canAccess).toBe(false)
      }),
      { numRuns: 100 }
    )
  })

  /**
   * Property 20: Active users can access the system
   * 
   * For any store user with is_active = true, the isUserActive function
   * SHALL return true, allowing access.
   */
  it('should allow access for any active user', () => {
    fc.assert(
      fc.property(storeUserArbitrary(true), (user) => {
        const canAccess = isUserActive(user)
        expect(canAccess).toBe(true)
      }),
      { numRuns: 100 }
    )
  })

  /**
   * Property 20: Access control is determined solely by is_active flag
   * 
   * For any two users with the same is_active value but different other fields,
   * the access control decision SHALL be the same.
   */
  it('should determine access solely by is_active flag regardless of other fields', () => {
    fc.assert(
      fc.property(
        storeUserArbitrary(true),
        storeUserArbitrary(true),
        (user1, user2) => {
          // Both active users should have access
          expect(isUserActive(user1)).toBe(isUserActive(user2))
          expect(isUserActive(user1)).toBe(true)
        }
      ),
      { numRuns: 100 }
    )

    fc.assert(
      fc.property(
        storeUserArbitrary(false),
        storeUserArbitrary(false),
        (user1, user2) => {
          // Both inactive users should be blocked
          expect(isUserActive(user1)).toBe(isUserActive(user2))
          expect(isUserActive(user1)).toBe(false)
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property 20: Role does not affect access control for deactivated users
   * 
   * For any deactivated user, regardless of their role (owner, manager, cashier),
   * access SHALL be blocked.
   */
  it('should block access for deactivated users regardless of role', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.uuid(),
        emailArbitrary,
        nonEmptyStringArbitrary,
        roleArbitrary,
        (id, tenantId, email, name, role) => {
          const deactivatedUser: StoreUser = {
            id,
            tenant_id: tenantId,
            email,
            name,
            role,
            is_active: false,
            created_at: new Date().toISOString(),
          }

          expect(isUserActive(deactivatedUser)).toBe(false)
        }
      ),
      { numRuns: 100 }
    )
  })
})


/**
 * Feature: verdurao-pro-saas, Add Employee Validation Tests
 * 
 * Tests for validating employee input data.
 * 
 * **Validates: Requirements 10.1**
 */
describe('Store User Service - Add Employee Validation Tests', () => {
  // Valid roles for store users
  const validRoles: UserRole[] = ['owner', 'manager', 'cashier']

  // Arbitrary for generating valid email addresses
  const emailArbitrary = fc.tuple(
    fc.stringMatching(/^[a-z][a-z0-9]{2,10}$/),
    fc.stringMatching(/^[a-z]{2,6}$/),
    fc.constantFrom('com', 'org', 'net', 'br', 'io')
  ).map(([user, domain, tld]) => `${user}@${domain}.${tld}`)

  // Arbitrary for generating non-empty trimmed strings
  const nonEmptyStringArbitrary = fc.string({ minLength: 1, maxLength: 100 })
    .filter(s => s.trim().length > 0)

  // Arbitrary for generating valid user roles
  const roleArbitrary = fc.constantFrom<UserRole>(...validRoles)

  // Arbitrary for generating valid add employee input
  const validAddEmployeeInputArbitrary: fc.Arbitrary<AddEmployeeInput> = fc.record({
    tenant_id: fc.uuid(),
    email: emailArbitrary,
    name: nonEmptyStringArbitrary,
    role: roleArbitrary,
  })

  // Required fields for adding an employee
  const requiredFields: (keyof AddEmployeeInput)[] = [
    'tenant_id',
    'email',
    'name',
    'role'
  ]

  // Arbitrary for selecting which required field to remove
  const requiredFieldArbitrary = fc.constantFrom(...requiredFields)

  /**
   * Valid input should pass validation
   */
  it('should validate all required fields for any valid add employee input', () => {
    fc.assert(
      fc.property(validAddEmployeeInputArbitrary, (input) => {
        const errors = validateAddEmployeeInput(input)
        expect(errors).toHaveLength(0)
      }),
      { numRuns: 100 }
    )
  })

  /**
   * Missing required field should cause validation error
   */
  it('should reject when any required field is missing', () => {
    fc.assert(
      fc.property(
        validAddEmployeeInputArbitrary,
        requiredFieldArbitrary,
        (validInput, fieldToRemove) => {
          const inputWithMissingField: Partial<AddEmployeeInput> = { ...validInput }
          delete inputWithMissingField[fieldToRemove]

          const errors = validateAddEmployeeInput(inputWithMissingField)

          expect(errors.length).toBeGreaterThan(0)
          const fieldError = errors.find(e => e.field === fieldToRemove)
          expect(fieldError).toBeDefined()
          expect(fieldError?.message).toContain('Campo obrigatório')
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Invalid email format should cause validation error
   */
  it('should reject invalid email formats', () => {
    const invalidEmailArbitrary = fc.constantFrom(
      'invalid',
      'no-at-sign',
      '@nodomain',
      'spaces in@email.com',
      'double@@at.com'
    )

    fc.assert(
      fc.property(
        validAddEmployeeInputArbitrary,
        invalidEmailArbitrary,
        (validInput, invalidEmail) => {
          const inputWithInvalidEmail: AddEmployeeInput = {
            ...validInput,
            email: invalidEmail,
          }

          const errors = validateAddEmployeeInput(inputWithInvalidEmail)

          const emailError = errors.find(e => e.field === 'email' && e.message.includes('Email inválido'))
          expect(emailError).toBeDefined()
        }
      ),
      { numRuns: 20 }
    )
  })

  /**
   * Invalid role should cause validation error
   */
  it('should reject invalid roles', () => {
    // Non-empty invalid roles (empty string is caught by required field validation)
    const invalidRoleArbitrary = fc.constantFrom(
      'admin',
      'superuser',
      'employee',
      'staff'
    ) as unknown as fc.Arbitrary<UserRole>

    fc.assert(
      fc.property(
        validAddEmployeeInputArbitrary,
        invalidRoleArbitrary,
        (validInput, invalidRole) => {
          const inputWithInvalidRole: AddEmployeeInput = {
            ...validInput,
            role: invalidRole,
          }

          const errors = validateAddEmployeeInput(inputWithInvalidRole)

          const roleError = errors.find(e => e.field === 'role' && e.message.includes('Papel inválido'))
          expect(roleError).toBeDefined()
        }
      ),
      { numRuns: 20 }
    )
  })

  /**
   * All valid roles should be accepted
   */
  it('should accept all valid roles', () => {
    fc.assert(
      fc.property(
        validAddEmployeeInputArbitrary,
        roleArbitrary,
        (validInput, role) => {
          const inputWithRole: AddEmployeeInput = {
            ...validInput,
            role,
          }

          const errors = validateAddEmployeeInput(inputWithRole)

          const roleError = errors.find(e => e.field === 'role')
          expect(roleError).toBeUndefined()
        }
      ),
      { numRuns: 100 }
    )
  })
})
