/**
 * No Artificial Limits Service
 * Requirements: 9.2, 10.4
 * 
 * This module provides pure functions to verify that the system
 * enforces NO artificial limits on products or users.
 * 
 * Per Requirements:
 * - 9.2: THE Sistema SHALL permitir produtos ilimitados, usuários ilimitados e relatórios completos
 * - 10.4: THE Sistema SHALL permitir usuários ilimitados por loja
 */

import { ProductInput, validateProductInput } from '../products/product.service'
import { AddEmployeeInput, validateAddEmployeeInput } from '../store-users/store-user.service'

/**
 * Maximum product count limit - NONE
 * 
 * This constant explicitly documents that there is no limit.
 * Any code checking for product limits should use this value.
 */
export const MAX_PRODUCTS_PER_TENANT = Infinity

/**
 * Maximum user count limit - NONE
 * 
 * This constant explicitly documents that there is no limit.
 * Any code checking for user limits should use this value.
 */
export const MAX_USERS_PER_TENANT = Infinity

/**
 * Checks if a product can be created based on current product count.
 * Requirements: 9.2
 * 
 * This function ALWAYS returns true because there are no artificial limits.
 * It exists to make the "no limits" policy explicit and testable.
 * 
 * @param currentProductCount - The current number of products for the tenant
 * @returns true - Always allows product creation (no limits)
 */
export function canCreateProduct(currentProductCount: number): boolean {
  // No artificial limit on products - always allow
  return currentProductCount < MAX_PRODUCTS_PER_TENANT
}

/**
 * Checks if a user can be created based on current user count.
 * Requirements: 10.4
 * 
 * This function ALWAYS returns true because there are no artificial limits.
 * It exists to make the "no limits" policy explicit and testable.
 * 
 * @param currentUserCount - The current number of users for the tenant
 * @returns true - Always allows user creation (no limits)
 */
export function canCreateUser(currentUserCount: number): boolean {
  // No artificial limit on users - always allow
  return currentUserCount < MAX_USERS_PER_TENANT
}

/**
 * Validates that product creation is not blocked by count limits.
 * Requirements: 9.2
 * 
 * This function validates that:
 * 1. The product input is valid (standard validation)
 * 2. There is no count-based limit blocking creation
 * 
 * @param input - The product input to validate
 * @param currentProductCount - The current number of products
 * @returns Validation result with any errors
 */
export function validateProductCreationWithoutLimits(
  input: ProductInput,
  currentProductCount: number
): { canCreate: boolean; limitBlocked: boolean; validationErrors: { field: string; message: string }[] } {
  const validationErrors = validateProductInput(input)
  const limitBlocked = !canCreateProduct(currentProductCount)
  
  return {
    canCreate: validationErrors.length === 0 && !limitBlocked,
    limitBlocked,
    validationErrors
  }
}

/**
 * Validates that user creation is not blocked by count limits.
 * Requirements: 10.4
 * 
 * This function validates that:
 * 1. The employee input is valid (standard validation)
 * 2. There is no count-based limit blocking creation
 * 
 * @param input - The employee input to validate
 * @param currentUserCount - The current number of users
 * @returns Validation result with any errors
 */
export function validateUserCreationWithoutLimits(
  input: AddEmployeeInput,
  currentUserCount: number
): { canCreate: boolean; limitBlocked: boolean; validationErrors: { field: string; message: string }[] } {
  const validationErrors = validateAddEmployeeInput(input)
  const limitBlocked = !canCreateUser(currentUserCount)
  
  return {
    canCreate: validationErrors.length === 0 && !limitBlocked,
    limitBlocked,
    validationErrors
  }
}
