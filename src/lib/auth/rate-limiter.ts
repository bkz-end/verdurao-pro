/**
 * Rate Limiter for Login Attempts
 * Requirements: 2.4 - Block after 5 consecutive failed login attempts for 15 minutes
 * 
 * Property 4: Rate Limiting After Failed Logins
 * For any user account, after 5 consecutive failed login attempts,
 * subsequent login attempts SHALL be blocked for 15 minutes regardless of credential validity.
 */

export interface LoginAttempt {
  email: string
  failedAttempts: number
  lastAttemptAt: Date
  lockedUntil: Date | null
}

export interface RateLimitResult {
  allowed: boolean
  remainingAttempts: number
  lockedUntil: Date | null
  error?: string
}

// Configuration constants
const MAX_FAILED_ATTEMPTS = 5
const LOCKOUT_DURATION_MS = 15 * 60 * 1000 // 15 minutes in milliseconds

// In-memory store for login attempts
// In production, this should be replaced with Redis or a database table
const loginAttempts = new Map<string, LoginAttempt>()

/**
 * Normalizes email for consistent key lookup
 */
function normalizeEmail(email: string): string {
  return email.toLowerCase().trim()
}

/**
 * Gets the current login attempt record for an email
 */
export function getLoginAttempt(email: string): LoginAttempt | null {
  const normalizedEmail = normalizeEmail(email)
  return loginAttempts.get(normalizedEmail) || null
}

/**
 * Checks if a login attempt is allowed for the given email
 * Returns rate limit status including whether the attempt is allowed
 */
export function checkRateLimit(email: string): RateLimitResult {
  const normalizedEmail = normalizeEmail(email)
  const attempt = loginAttempts.get(normalizedEmail)
  const now = new Date()

  // No previous attempts - allow
  if (!attempt) {
    return {
      allowed: true,
      remainingAttempts: MAX_FAILED_ATTEMPTS,
      lockedUntil: null
    }
  }

  // Check if currently locked
  if (attempt.lockedUntil && attempt.lockedUntil > now) {
    const remainingMs = attempt.lockedUntil.getTime() - now.getTime()
    const remainingMinutes = Math.ceil(remainingMs / 60000)
    return {
      allowed: false,
      remainingAttempts: 0,
      lockedUntil: attempt.lockedUntil,
      error: `Conta bloqueada. Tente novamente em ${remainingMinutes} minuto${remainingMinutes > 1 ? 's' : ''}`
    }
  }

  // Lock has expired - reset the attempt record
  if (attempt.lockedUntil && attempt.lockedUntil <= now) {
    loginAttempts.delete(normalizedEmail)
    return {
      allowed: true,
      remainingAttempts: MAX_FAILED_ATTEMPTS,
      lockedUntil: null
    }
  }

  // Not locked - calculate remaining attempts
  const remainingAttempts = MAX_FAILED_ATTEMPTS - attempt.failedAttempts
  return {
    allowed: true,
    remainingAttempts,
    lockedUntil: null
  }
}

/**
 * Records a failed login attempt for the given email
 * Returns the updated rate limit status
 */
export function recordFailedAttempt(email: string): RateLimitResult {
  const normalizedEmail = normalizeEmail(email)
  const now = new Date()
  let attempt = loginAttempts.get(normalizedEmail)

  // Initialize or update attempt record
  if (!attempt) {
    attempt = {
      email: normalizedEmail,
      failedAttempts: 1,
      lastAttemptAt: now,
      lockedUntil: null
    }
  } else {
    // If lock has expired, reset
    if (attempt.lockedUntil && attempt.lockedUntil <= now) {
      attempt = {
        email: normalizedEmail,
        failedAttempts: 1,
        lastAttemptAt: now,
        lockedUntil: null
      }
    } else {
      attempt.failedAttempts += 1
      attempt.lastAttemptAt = now
    }
  }

  // Check if we should lock the account
  if (attempt.failedAttempts >= MAX_FAILED_ATTEMPTS) {
    attempt.lockedUntil = new Date(now.getTime() + LOCKOUT_DURATION_MS)
    loginAttempts.set(normalizedEmail, attempt)
    return {
      allowed: false,
      remainingAttempts: 0,
      lockedUntil: attempt.lockedUntil,
      error: 'Conta bloqueada. Tente novamente em 15 minutos'
    }
  }

  loginAttempts.set(normalizedEmail, attempt)
  const remainingAttempts = MAX_FAILED_ATTEMPTS - attempt.failedAttempts
  return {
    allowed: true,
    remainingAttempts,
    lockedUntil: null
  }
}

/**
 * Records a successful login, clearing any failed attempts
 */
export function recordSuccessfulLogin(email: string): void {
  const normalizedEmail = normalizeEmail(email)
  loginAttempts.delete(normalizedEmail)
}

/**
 * Clears all login attempts (useful for testing)
 */
export function clearAllAttempts(): void {
  loginAttempts.clear()
}

/**
 * Clears login attempts for a specific email (useful for admin reset)
 */
export function clearAttempts(email: string): void {
  const normalizedEmail = normalizeEmail(email)
  loginAttempts.delete(normalizedEmail)
}

/**
 * Gets the configuration constants (useful for testing)
 */
export function getRateLimitConfig() {
  return {
    maxFailedAttempts: MAX_FAILED_ATTEMPTS,
    lockoutDurationMs: LOCKOUT_DURATION_MS
  }
}
