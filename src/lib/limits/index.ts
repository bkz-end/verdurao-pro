/**
 * Limits Module
 * Requirements: 9.2, 10.4
 * 
 * This module exports functions and constants that explicitly document
 * and enforce the "no artificial limits" policy.
 */

export {
  MAX_PRODUCTS_PER_TENANT,
  MAX_USERS_PER_TENANT,
  canCreateProduct,
  canCreateUser,
  validateProductCreationWithoutLimits,
  validateUserCreationWithoutLimits,
} from './no-limits.service'
