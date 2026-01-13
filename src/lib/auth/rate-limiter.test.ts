import { describe, it, expect, beforeEach } from 'vitest'
import * as fc from 'fast-check'
import {
  checkRateLimit,
  recordFailedAttempt,
  recordSuccessfulLogin,
  clearAllAttempts,
  clearAttempts,
  getLoginAttempt,
  getRateLimitConfig,
} from './rate-limiter'

/**
 * Feature: verdurao-pro-saas, Property 4: Rate Limiting After Failed Logins
 * 
 * *For any* user account, after 5 consecutive failed login attempts,
 * subsequent login attempts SHALL be blocked for 15 minutes regardless of credential validity.
 * 
 * **Validates: Requirements 2.4**
 */
describe('Rate Limiting After Failed Logins - Property Tests', () => {
  // Clear all attempts before each test
  beforeEach(() => {
    clearAllAttempts()
  })

  // Arbitrary for generating valid email addresses
  const emailArbitrary = fc.tuple(
    fc.stringMatching(/^[a-z][a-z0-9]{2,10}$/),
    fc.stringMatching(/^[a-z]{2,6}$/),
    fc.constantFrom('com', 'org', 'net', 'br', 'io')
  ).map(([user, domain, tld]) => `${user}@${domain}.${tld}`)

  // Get configuration for tests
  const config = getRateLimitConfig()
  const MAX_ATTEMPTS = config.maxFailedAttempts // 5
  const LOCKOUT_MS = config.lockoutDurationMs // 15 minutes

  /**
   * Property 4: First login attempt is always allowed
   * 
   * For any email address with no previous attempts,
   * checkRateLimit SHALL return allowed: true.
   */
  it('should allow first login attempt for any email', () => {
    fc.assert(
      fc.property(emailArbitrary, (email) => {
        clearAttempts(email)
        const result = checkRateLimit(email)
        expect(result.allowed).toBe(true)
        expect(result.remainingAttempts).toBe(MAX_ATTEMPTS)
        expect(result.lockedUntil).toBeNull()
      }),
      { numRuns: 100 }
    )
  })

  /**
   * Property 4: Failed attempts decrement remaining attempts
   * 
   * For any email and number of failed attempts less than MAX_ATTEMPTS,
   * remainingAttempts SHALL equal MAX_ATTEMPTS minus the number of failed attempts.
   */
  it('should decrement remaining attempts for each failed login', () => {
    fc.assert(
      fc.property(
        emailArbitrary,
        fc.integer({ min: 1, max: MAX_ATTEMPTS - 1 }),
        (email, numFailures) => {
          clearAttempts(email)
          
          // Record the specified number of failed attempts
          let lastResult
          for (let i = 0; i < numFailures; i++) {
            lastResult = recordFailedAttempt(email)
          }

          // Verify remaining attempts
          expect(lastResult!.remainingAttempts).toBe(MAX_ATTEMPTS - numFailures)
          expect(lastResult!.allowed).toBe(true)
          expect(lastResult!.lockedUntil).toBeNull()
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property 4: Account is locked after exactly MAX_ATTEMPTS failed attempts
   * 
   * For any email, after exactly 5 consecutive failed login attempts,
   * the account SHALL be locked.
   */
  it('should lock account after exactly 5 failed attempts', () => {
    fc.assert(
      fc.property(emailArbitrary, (email) => {
        clearAttempts(email)
        
        // Record MAX_ATTEMPTS - 1 failed attempts (should still be allowed)
        for (let i = 0; i < MAX_ATTEMPTS - 1; i++) {
          const result = recordFailedAttempt(email)
          expect(result.allowed).toBe(true)
        }

        // The 5th failed attempt should lock the account
        const lockResult = recordFailedAttempt(email)
        expect(lockResult.allowed).toBe(false)
        expect(lockResult.remainingAttempts).toBe(0)
        expect(lockResult.lockedUntil).not.toBeNull()
        expect(lockResult.error).toContain('bloqueada')
      }),
      { numRuns: 100 }
    )
  })

  /**
   * Property 4: Locked account blocks subsequent attempts
   * 
   * For any email that is locked, subsequent checkRateLimit calls
   * SHALL return allowed: false until the lockout expires.
   */
  it('should block all attempts while account is locked', () => {
    fc.assert(
      fc.property(
        emailArbitrary,
        fc.integer({ min: 1, max: 10 }),
        (email, additionalAttempts) => {
          clearAttempts(email)
          
          // Lock the account
          for (let i = 0; i < MAX_ATTEMPTS; i++) {
            recordFailedAttempt(email)
          }

          // Verify account is locked
          const lockedCheck = checkRateLimit(email)
          expect(lockedCheck.allowed).toBe(false)

          // Additional attempts should also be blocked
          for (let i = 0; i < additionalAttempts; i++) {
            const result = checkRateLimit(email)
            expect(result.allowed).toBe(false)
            expect(result.lockedUntil).not.toBeNull()
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property 4: Successful login clears failed attempts
   * 
   * For any email with failed attempts (but not locked),
   * a successful login SHALL clear all failed attempts.
   */
  it('should clear failed attempts on successful login', () => {
    fc.assert(
      fc.property(
        emailArbitrary,
        fc.integer({ min: 1, max: MAX_ATTEMPTS - 1 }),
        (email, numFailures) => {
          clearAttempts(email)
          
          // Record some failed attempts
          for (let i = 0; i < numFailures; i++) {
            recordFailedAttempt(email)
          }

          // Verify there are failed attempts
          const beforeSuccess = getLoginAttempt(email)
          expect(beforeSuccess).not.toBeNull()
          expect(beforeSuccess!.failedAttempts).toBe(numFailures)

          // Record successful login
          recordSuccessfulLogin(email)

          // Verify attempts are cleared
          const afterSuccess = getLoginAttempt(email)
          expect(afterSuccess).toBeNull()

          // Next check should show full attempts available
          const nextCheck = checkRateLimit(email)
          expect(nextCheck.allowed).toBe(true)
          expect(nextCheck.remainingAttempts).toBe(MAX_ATTEMPTS)
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property 4: Email normalization is case-insensitive
   * 
   * For any email, rate limiting SHALL treat different cases as the same email.
   */
  it('should treat email addresses case-insensitively', () => {
    fc.assert(
      fc.property(emailArbitrary, (email) => {
        clearAttempts(email)
        
        const upperEmail = email.toUpperCase()
        const lowerEmail = email.toLowerCase()
        const mixedEmail = email.split('').map((c, i) => 
          i % 2 === 0 ? c.toUpperCase() : c.toLowerCase()
        ).join('')

        // Record failed attempt with lowercase
        recordFailedAttempt(lowerEmail)

        // Check with uppercase - should see the same attempt
        const upperCheck = checkRateLimit(upperEmail)
        expect(upperCheck.remainingAttempts).toBe(MAX_ATTEMPTS - 1)

        // Record another failed attempt with mixed case
        recordFailedAttempt(mixedEmail)

        // Check with original - should see both attempts
        const originalCheck = checkRateLimit(email)
        expect(originalCheck.remainingAttempts).toBe(MAX_ATTEMPTS - 2)
      }),
      { numRuns: 100 }
    )
  })

  /**
   * Property 4: Different emails have independent rate limits
   * 
   * For any two different emails, rate limiting for one
   * SHALL NOT affect the other.
   */
  it('should maintain independent rate limits for different emails', () => {
    fc.assert(
      fc.property(
        emailArbitrary,
        emailArbitrary,
        fc.integer({ min: 1, max: MAX_ATTEMPTS - 1 }),
        (email1, email2, numFailures) => {
          // Skip if emails are the same
          fc.pre(email1.toLowerCase() !== email2.toLowerCase())
          
          clearAttempts(email1)
          clearAttempts(email2)

          // Record failed attempts for email1
          for (let i = 0; i < numFailures; i++) {
            recordFailedAttempt(email1)
          }

          // email2 should still have full attempts
          const email2Check = checkRateLimit(email2)
          expect(email2Check.allowed).toBe(true)
          expect(email2Check.remainingAttempts).toBe(MAX_ATTEMPTS)

          // email1 should have reduced attempts
          const email1Check = checkRateLimit(email1)
          expect(email1Check.remainingAttempts).toBe(MAX_ATTEMPTS - numFailures)
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property 4: Lockout duration is exactly 15 minutes
   * 
   * For any locked account, the lockedUntil timestamp SHALL be
   * approximately 15 minutes from the time of the 5th failed attempt.
   */
  it('should set lockout duration to 15 minutes', () => {
    fc.assert(
      fc.property(emailArbitrary, (email) => {
        clearAttempts(email)
        
        const beforeLock = Date.now()
        
        // Lock the account
        for (let i = 0; i < MAX_ATTEMPTS; i++) {
          recordFailedAttempt(email)
        }

        const afterLock = Date.now()

        // Get the lockout time
        const attempt = getLoginAttempt(email)
        expect(attempt).not.toBeNull()
        expect(attempt!.lockedUntil).not.toBeNull()

        const lockedUntilMs = attempt!.lockedUntil!.getTime()
        
        // Lockout should be approximately 15 minutes from now
        // Allow 1 second tolerance for test execution time
        const expectedMin = beforeLock + LOCKOUT_MS - 1000
        const expectedMax = afterLock + LOCKOUT_MS + 1000

        expect(lockedUntilMs).toBeGreaterThanOrEqual(expectedMin)
        expect(lockedUntilMs).toBeLessThanOrEqual(expectedMax)
      }),
      { numRuns: 100 }
    )
  })

  /**
   * Property 4: Rate limit check is idempotent
   * 
   * For any email, calling checkRateLimit multiple times without
   * recording attempts SHALL return the same result.
   */
  it('should return consistent results for repeated rate limit checks', () => {
    fc.assert(
      fc.property(
        emailArbitrary,
        fc.integer({ min: 0, max: MAX_ATTEMPTS }),
        fc.integer({ min: 2, max: 5 }),
        (email, numFailures, numChecks) => {
          clearAttempts(email)
          
          // Record some failed attempts
          for (let i = 0; i < numFailures; i++) {
            recordFailedAttempt(email)
          }

          // Multiple checks should return the same result
          const results = []
          for (let i = 0; i < numChecks; i++) {
            results.push(checkRateLimit(email))
          }

          // All results should be identical
          const firstResult = results[0]
          for (const result of results) {
            expect(result.allowed).toBe(firstResult.allowed)
            expect(result.remainingAttempts).toBe(firstResult.remainingAttempts)
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property 4: Clearing attempts resets rate limit
   * 
   * For any email with failed attempts or lockout,
   * clearAttempts SHALL reset the rate limit to initial state.
   */
  it('should reset rate limit when attempts are cleared', () => {
    fc.assert(
      fc.property(
        emailArbitrary,
        fc.integer({ min: 1, max: MAX_ATTEMPTS + 2 }),
        (email, numFailures) => {
          clearAttempts(email)
          
          // Record failed attempts (possibly locking the account)
          for (let i = 0; i < numFailures; i++) {
            recordFailedAttempt(email)
          }

          // Clear attempts
          clearAttempts(email)

          // Should be back to initial state
          const result = checkRateLimit(email)
          expect(result.allowed).toBe(true)
          expect(result.remainingAttempts).toBe(MAX_ATTEMPTS)
          expect(result.lockedUntil).toBeNull()
        }
      ),
      { numRuns: 100 }
    )
  })
})
