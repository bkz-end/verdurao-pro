/**
 * Offline Storage Schema
 * Requirements: 5.1
 * 
 * Defines the local schema for offline support using IndexedDB.
 * This mirrors the WatermelonDB schema pattern from the design document
 * but uses IndexedDB for browser compatibility with Next.js.
 */

import { Product, ProductUnit } from '@/types'

/**
 * Local product record for offline storage
 * Mirrors the server product but includes sync metadata
 */
export interface LocalProduct {
  id: string
  serverId: string | null
  tenantId: string
  sku: string
  name: string
  price: number
  unit: ProductUnit
  defaultQuantity: number
  stock: number
  isSynced: boolean
  updatedAt: number // timestamp
}

/**
 * Pending sale item for offline storage
 */
export interface PendingSaleItem {
  productId: string
  productName: string
  quantity: number
  unitPrice: number
  subtotal: number
}

/**
 * Pending sale record for offline storage
 * Requirements: 4.7, 5.1
 */
export interface PendingSale {
  id: string
  tenantId: string
  userId: string
  items: PendingSaleItem[]
  total: number
  createdAt: number // timestamp
  isSynced: boolean
  syncAttempts: number
  lastSyncError: string | null
}

/**
 * Conflict log record
 * Requirements: 5.4
 */
export interface ConflictLog {
  id: string
  entityType: 'product' | 'sale'
  entityId: string
  localData: string // JSON stringified
  remoteData: string // JSON stringified
  resolution: 'local' | 'remote'
  resolvedAt: number
}

/**
 * Sync result interface
 * Requirements: 5.2
 */
export interface SyncResult {
  success: boolean
  syncedCount: number
  failedCount: number
  conflicts: ConflictLog[]
}

/**
 * Database store names
 */
export const STORE_NAMES = {
  PRODUCTS: 'products',
  PENDING_SALES: 'pending_sales',
  CONFLICT_LOGS: 'conflict_logs'
} as const

/**
 * Database version - increment when schema changes
 */
export const DB_VERSION = 1

/**
 * Database name
 */
export const DB_NAME = 'verdurao_pro_offline'

/**
 * Converts a server Product to LocalProduct format
 */
export function productToLocal(product: Product, tenantId: string): LocalProduct {
  return {
    id: product.id,
    serverId: product.id,
    tenantId,
    sku: product.sku,
    name: product.name,
    price: product.price,
    unit: product.unit,
    defaultQuantity: product.default_quantity,
    stock: product.stock,
    isSynced: true,
    updatedAt: new Date(product.updated_at).getTime()
  }
}

/**
 * Converts a LocalProduct to server Product format
 */
export function localToProduct(local: LocalProduct): Partial<Product> {
  return {
    id: local.serverId || local.id,
    tenant_id: local.tenantId,
    sku: local.sku,
    name: local.name,
    price: local.price,
    unit: local.unit,
    default_quantity: local.defaultQuantity,
    stock: local.stock,
    updated_at: new Date(local.updatedAt).toISOString()
  }
}
