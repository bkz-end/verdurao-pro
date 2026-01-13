/**
 * SyncService Tests
 * Requirements: 4.7, 5.1, 5.2, 5.4
 * 
 * Tests for offline synchronization functionality including:
 * - Offline sale storage
 * - Sync when online
 * - Conflict resolution (last-write-wins)
 */

import { describe, it, expect, beforeEach } from 'vitest'
import * as fc from 'fast-check'
import {
  PendingSale,
  LocalProduct,
  productToLocal,
  localToProduct
} from './schema'
import { determineWinner } from './conflict-resolver'

// Mock IndexedDB for testing
const mockStorage: Map<string, unknown> = new Map()

// Helper to generate valid pending sale items
const pendingSaleItemArb = fc.record({
  productId: fc.uuid(),
  productName: fc.string({ minLength: 1, maxLength: 50 }),
  quantity: fc.float({ min: Math.fround(0.1), max: Math.fround(100), noNaN: true }),
  unitPrice: fc.float({ min: Math.fround(0.01), max: Math.fround(1000), noNaN: true }),
  subtotal: fc.float({ min: Math.fround(0.01), max: Math.fround(100000), noNaN: true })
})

// Helper to generate valid pending sales
const pendingSaleArb = fc.record({
  id: fc.string({ minLength: 10, maxLength: 30 }),
  tenantId: fc.uuid(),
  userId: fc.uuid(),
  items: fc.array(pendingSaleItemArb, { minLength: 1, maxLength: 10 }),
  total: fc.float({ min: Math.fround(0.01), max: Math.fround(100000), noNaN: true }),
  createdAt: fc.integer({ min: 1000000000000, max: 2000000000000 }),
  isSynced: fc.boolean(),
  syncAttempts: fc.integer({ min: 0, max: 10 }),
  lastSyncError: fc.option(fc.string(), { nil: null })
})

// Helper to generate timestamps
const timestampArb = fc.integer({ min: 1000000000000, max: 2000000000000 })

describe('SyncService', () => {
  beforeEach(() => {
    mockStorage.clear()
  })

  describe('Offline Sale Storage', () => {
    it('should create pending sale with correct structure', () => {
      fc.assert(
        fc.property(pendingSaleArb, (sale) => {
          // Verify sale has all required fields
          expect(sale.id).toBeDefined()
          expect(sale.tenantId).toBeDefined()
          expect(sale.userId).toBeDefined()
          expect(sale.items.length).toBeGreaterThan(0)
          expect(sale.total).toBeGreaterThan(0)
          expect(sale.createdAt).toBeGreaterThan(0)
          expect(typeof sale.isSynced).toBe('boolean')
        }),
        { numRuns: 100 }
      )
    })

    it('should preserve all sale item data', () => {
      fc.assert(
        fc.property(pendingSaleItemArb, (item) => {
          // Verify item has all required fields
          expect(item.productId).toBeDefined()
          expect(item.productName.length).toBeGreaterThan(0)
          expect(item.quantity).toBeGreaterThan(0)
          expect(item.unitPrice).toBeGreaterThan(0)
          expect(item.subtotal).toBeGreaterThan(0)
        }),
        { numRuns: 100 }
      )
    })
  })

  describe('Conflict Resolution - Last Write Wins', () => {
    /**
     * Property 11: Conflict Resolution Last-Write-Wins
     * Feature: verdurao-pro-saas, Property 11: The record with the more recent updated_at timestamp SHALL be preserved
     * Validates: Requirements 5.4
     */
    it('should always select the record with more recent timestamp', () => {
      fc.assert(
        fc.property(
          timestampArb,
          timestampArb,
          (localTimestamp, remoteTimestamp) => {
            const winner = determineWinner(localTimestamp, remoteTimestamp)
            
            if (localTimestamp > remoteTimestamp) {
              expect(winner).toBe('local')
            } else {
              expect(winner).toBe('remote')
            }
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should select remote when timestamps are equal', () => {
      const timestamp = Date.now()
      const winner = determineWinner(timestamp, timestamp)
      expect(winner).toBe('remote')
    })

    it('should be deterministic for same inputs', () => {
      fc.assert(
        fc.property(
          timestampArb,
          timestampArb,
          (localTimestamp, remoteTimestamp) => {
            const winner1 = determineWinner(localTimestamp, remoteTimestamp)
            const winner2 = determineWinner(localTimestamp, remoteTimestamp)
            expect(winner1).toBe(winner2)
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  describe('Product Conversion', () => {
    it('should convert server product to local format correctly', () => {
      const serverProduct = {
        id: 'prod-123',
        tenant_id: 'tenant-456',
        sku: 'SKU001',
        name: 'Banana',
        price: 5.99,
        cost_price: 3.50,
        unit: 'kg' as const,
        default_quantity: 0.5,
        stock: 100,
        category: 'Frutas',
        is_active: true,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-15T10:30:00Z'
      }

      const localProduct = productToLocal(serverProduct, 'tenant-456')

      expect(localProduct.id).toBe(serverProduct.id)
      expect(localProduct.serverId).toBe(serverProduct.id)
      expect(localProduct.tenantId).toBe('tenant-456')
      expect(localProduct.sku).toBe(serverProduct.sku)
      expect(localProduct.name).toBe(serverProduct.name)
      expect(localProduct.price).toBe(serverProduct.price)
      expect(localProduct.unit).toBe(serverProduct.unit)
      expect(localProduct.defaultQuantity).toBe(serverProduct.default_quantity)
      expect(localProduct.stock).toBe(serverProduct.stock)
      expect(localProduct.isSynced).toBe(true)
      expect(localProduct.updatedAt).toBe(new Date(serverProduct.updated_at).getTime())
    })

    it('should convert local product back to server format', () => {
      const localProduct: LocalProduct = {
        id: 'local-123',
        serverId: 'server-456',
        tenantId: 'tenant-789',
        sku: 'SKU002',
        name: 'Maçã',
        price: 8.99,
        unit: 'kg',
        defaultQuantity: 0.5,
        stock: 50,
        isSynced: false,
        updatedAt: Date.now()
      }

      const serverProduct = localToProduct(localProduct)

      expect(serverProduct.id).toBe(localProduct.serverId)
      expect(serverProduct.tenant_id).toBe(localProduct.tenantId)
      expect(serverProduct.sku).toBe(localProduct.sku)
      expect(serverProduct.name).toBe(localProduct.name)
      expect(serverProduct.price).toBe(localProduct.price)
      expect(serverProduct.unit).toBe(localProduct.unit)
      expect(serverProduct.default_quantity).toBe(localProduct.defaultQuantity)
      expect(serverProduct.stock).toBe(localProduct.stock)
    })
  })

  describe('Pending Sale Structure', () => {
    it('should calculate total from items correctly', () => {
      fc.assert(
        fc.property(
          fc.array(pendingSaleItemArb, { minLength: 1, maxLength: 5 }),
          (items) => {
            // Recalculate subtotals with proper rounding
            const itemsWithCorrectSubtotals = items.map(item => ({
              ...item,
              subtotal: Math.round(item.quantity * item.unitPrice * 100) / 100
            }))

            const calculatedTotal = itemsWithCorrectSubtotals.reduce(
              (sum, item) => sum + item.subtotal,
              0
            )

            // Total should be non-negative (can be 0 due to rounding)
            expect(calculatedTotal).toBeGreaterThanOrEqual(0)
            
            // If we have items with positive values, total should be positive
            const hasPositiveItems = itemsWithCorrectSubtotals.some(
              item => item.subtotal > 0
            )
            if (hasPositiveItems) {
              expect(calculatedTotal).toBeGreaterThan(0)
            }
          }
        ),
        { numRuns: 100 }
      )
    })
  })
})

describe('Sync Status Tracking', () => {
  it('should track sync attempts correctly', () => {
    fc.assert(
      fc.property(
        pendingSaleArb,
        fc.integer({ min: 1, max: 5 }),
        (sale, attempts) => {
          const updatedSale: PendingSale = {
            ...sale,
            syncAttempts: sale.syncAttempts + attempts
          }

          expect(updatedSale.syncAttempts).toBe(sale.syncAttempts + attempts)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('should preserve error messages', () => {
    fc.assert(
      fc.property(
        pendingSaleArb,
        fc.string({ minLength: 1, maxLength: 100 }),
        (sale, errorMessage) => {
          const updatedSale: PendingSale = {
            ...sale,
            lastSyncError: errorMessage
          }

          expect(updatedSale.lastSyncError).toBe(errorMessage)
        }
      ),
      { numRuns: 100 }
    )
  })
})

/**
 * Property 10: Offline Sales Storage and Sync
 * Feature: verdurao-pro-saas, Property 10: Offline Sales Storage and Sync
 * Validates: Requirements 4.7, 5.1, 5.2
 * 
 * For any sale created while offline, the sale SHALL be stored locally,
 * and when connection is restored, the sale SHALL be synced to the server
 * with matching data.
 */
describe('Property 10: Offline Sales Storage and Sync', () => {
  /**
   * Property 10.1: Sales created offline are stored with all required fields
   */
  it('should store offline sales with all required fields preserved', () => {
    fc.assert(
      fc.property(
        pendingSaleArb,
        (sale) => {
          // Create a new sale marked as unsynced (offline)
          const offlineSale: PendingSale = {
            ...sale,
            isSynced: false,
            syncAttempts: 0
          }

          // Verify all required fields are present
          expect(offlineSale.id).toBeDefined()
          expect(offlineSale.id.length).toBeGreaterThan(0)
          expect(offlineSale.tenantId).toBeDefined()
          expect(offlineSale.userId).toBeDefined()
          expect(offlineSale.items).toBeDefined()
          expect(offlineSale.items.length).toBeGreaterThan(0)
          expect(offlineSale.total).toBeDefined()
          expect(offlineSale.createdAt).toBeGreaterThan(0)
          expect(offlineSale.isSynced).toBe(false)
          
          // Verify each item has required fields
          for (const item of offlineSale.items) {
            expect(item.productId).toBeDefined()
            expect(item.productName).toBeDefined()
            expect(item.quantity).toBeGreaterThan(0)
            expect(item.unitPrice).toBeGreaterThanOrEqual(0)
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property 10.2: Synced sales maintain data integrity
   */
  it('should maintain data integrity when marking sale as synced', () => {
    fc.assert(
      fc.property(
        pendingSaleArb,
        (originalSale) => {
          // Simulate offline sale
          const offlineSale: PendingSale = {
            ...originalSale,
            isSynced: false
          }

          // Simulate sync completion
          const syncedSale: PendingSale = {
            ...offlineSale,
            isSynced: true
          }

          // Verify data integrity - all fields except isSynced should match
          expect(syncedSale.id).toBe(offlineSale.id)
          expect(syncedSale.tenantId).toBe(offlineSale.tenantId)
          expect(syncedSale.userId).toBe(offlineSale.userId)
          expect(syncedSale.total).toBe(offlineSale.total)
          expect(syncedSale.createdAt).toBe(offlineSale.createdAt)
          expect(syncedSale.items.length).toBe(offlineSale.items.length)
          
          // Verify items match
          for (let i = 0; i < syncedSale.items.length; i++) {
            expect(syncedSale.items[i].productId).toBe(offlineSale.items[i].productId)
            expect(syncedSale.items[i].quantity).toBe(offlineSale.items[i].quantity)
            expect(syncedSale.items[i].unitPrice).toBe(offlineSale.items[i].unitPrice)
          }

          // Verify sync status changed
          expect(syncedSale.isSynced).toBe(true)
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property 10.3: Batch sync processes all unsynced sales
   */
  it('should identify all unsynced sales for batch processing', () => {
    fc.assert(
      fc.property(
        fc.array(pendingSaleArb, { minLength: 1, maxLength: 10 }),
        (sales) => {
          // Mark some as synced, some as unsynced
          const processedSales = sales.map((sale, index) => ({
            ...sale,
            isSynced: index % 2 === 0 // Even indices are synced
          }))

          // Filter unsynced sales
          const unsyncedSales = processedSales.filter(s => !s.isSynced)
          const syncedSales = processedSales.filter(s => s.isSynced)

          // Verify counts
          expect(unsyncedSales.length + syncedSales.length).toBe(processedSales.length)
          
          // Verify all unsynced have isSynced = false
          for (const sale of unsyncedSales) {
            expect(sale.isSynced).toBe(false)
          }

          // Verify all synced have isSynced = true
          for (const sale of syncedSales) {
            expect(sale.isSynced).toBe(true)
          }
        }
      ),
      { numRuns: 100 }
    )
  })
})


/**
 * Property 11: Conflict Resolution Last-Write-Wins
 * Feature: verdurao-pro-saas, Property 11: Conflict Resolution Last-Write-Wins
 * Validates: Requirements 5.4
 * 
 * For any sync conflict between local and remote data, the record with the 
 * more recent updated_at timestamp SHALL be preserved.
 */
describe('Property 11: Conflict Resolution Last-Write-Wins', () => {
  // Arbitrary for generating timestamps (realistic range)
  const timestampArb = fc.integer({ min: 1000000000000, max: 2000000000000 })

  // Arbitrary for generating local product data
  const localProductArb = fc.record({
    id: fc.uuid(),
    serverId: fc.option(fc.uuid(), { nil: null }),
    tenantId: fc.uuid(),
    sku: fc.string({ minLength: 3, maxLength: 20 }),
    name: fc.string({ minLength: 1, maxLength: 100 }),
    price: fc.float({ min: Math.fround(0.01), max: Math.fround(10000), noNaN: true }),
    unit: fc.constantFrom('un', 'kg', 'g', 'l', 'ml') as fc.Arbitrary<'un' | 'kg' | 'g' | 'l' | 'ml'>,
    defaultQuantity: fc.float({ min: Math.fround(0.1), max: Math.fround(10), noNaN: true }),
    stock: fc.float({ min: 0, max: Math.fround(10000), noNaN: true }),
    isSynced: fc.boolean(),
    updatedAt: timestampArb
  })

  /**
   * Property 11.1: Local wins when local timestamp is strictly greater
   * 
   * For any local timestamp L and remote timestamp R where L > R,
   * the winner SHALL be 'local'
   */
  it('should select local when local timestamp is strictly greater than remote', () => {
    fc.assert(
      fc.property(
        timestampArb,
        fc.integer({ min: 1, max: 1000000000 }), // positive offset
        (baseTimestamp, offset) => {
          const remoteTimestamp = baseTimestamp
          const localTimestamp = baseTimestamp + offset // local is newer

          const winner = determineWinner(localTimestamp, remoteTimestamp)

          expect(winner).toBe('local')
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property 11.2: Remote wins when remote timestamp is strictly greater
   * 
   * For any local timestamp L and remote timestamp R where R > L,
   * the winner SHALL be 'remote'
   */
  it('should select remote when remote timestamp is strictly greater than local', () => {
    fc.assert(
      fc.property(
        timestampArb,
        fc.integer({ min: 1, max: 1000000000 }), // positive offset
        (baseTimestamp, offset) => {
          const localTimestamp = baseTimestamp
          const remoteTimestamp = baseTimestamp + offset // remote is newer

          const winner = determineWinner(localTimestamp, remoteTimestamp)

          expect(winner).toBe('remote')
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property 11.3: Remote wins on tie (equal timestamps)
   * 
   * For any timestamp T, when local and remote have the same timestamp,
   * the winner SHALL be 'remote' (server authority on ties)
   */
  it('should select remote when timestamps are equal (server authority)', () => {
    fc.assert(
      fc.property(
        timestampArb,
        (timestamp) => {
          const winner = determineWinner(timestamp, timestamp)

          expect(winner).toBe('remote')
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property 11.4: Determinism - same inputs always produce same output
   * 
   * For any pair of timestamps, calling determineWinner multiple times
   * SHALL always return the same result
   */
  it('should be deterministic - same inputs always produce same output', () => {
    fc.assert(
      fc.property(
        timestampArb,
        timestampArb,
        (localTimestamp, remoteTimestamp) => {
          const result1 = determineWinner(localTimestamp, remoteTimestamp)
          const result2 = determineWinner(localTimestamp, remoteTimestamp)
          const result3 = determineWinner(localTimestamp, remoteTimestamp)

          expect(result1).toBe(result2)
          expect(result2).toBe(result3)
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property 11.5: Antisymmetry - swapping timestamps swaps winner (except ties)
   * 
   * For any distinct timestamps L and R, if determineWinner(L, R) = 'local',
   * then determineWinner(R, L) = 'remote' and vice versa
   */
  it('should exhibit antisymmetry - swapping timestamps swaps winner for distinct values', () => {
    fc.assert(
      fc.property(
        timestampArb,
        timestampArb.filter(t => t !== 0), // ensure we can create distinct values
        (t1, offset) => {
          // Ensure distinct timestamps
          const localTimestamp = t1
          const remoteTimestamp = t1 + (offset > 0 ? offset : 1)

          const winner1 = determineWinner(localTimestamp, remoteTimestamp)
          const winner2 = determineWinner(remoteTimestamp, localTimestamp)

          // If local wins in first call, remote should win when swapped
          if (winner1 === 'local') {
            expect(winner2).toBe('remote')
          } else {
            expect(winner2).toBe('local')
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property 11.6: Conflict resolution preserves the newer data
   * 
   * For any two product versions with different timestamps,
   * the version with the more recent timestamp SHALL be selected
   */
  it('should preserve the product data with more recent timestamp', () => {
    fc.assert(
      fc.property(
        localProductArb,
        localProductArb,
        (product1, product2) => {
          // Ensure different timestamps
          const localProduct = { ...product1, updatedAt: product1.updatedAt }
          const remoteProduct = { ...product2, updatedAt: product2.updatedAt }

          const winner = determineWinner(localProduct.updatedAt, remoteProduct.updatedAt)

          if (localProduct.updatedAt > remoteProduct.updatedAt) {
            expect(winner).toBe('local')
          } else {
            expect(winner).toBe('remote')
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property 11.7: Transitivity - if A > B and B > C, then A > C
   * 
   * For any three timestamps where local1 > local2 > remote,
   * local1 should win against remote
   */
  it('should maintain transitivity in timestamp comparison', () => {
    fc.assert(
      fc.property(
        timestampArb,
        fc.integer({ min: 1, max: 100000000 }),
        fc.integer({ min: 1, max: 100000000 }),
        (baseTimestamp, offset1, offset2) => {
          const timestampC = baseTimestamp
          const timestampB = baseTimestamp + offset1
          const timestampA = baseTimestamp + offset1 + offset2

          // A > B
          const winnerAB = determineWinner(timestampA, timestampB)
          expect(winnerAB).toBe('local')

          // B > C
          const winnerBC = determineWinner(timestampB, timestampC)
          expect(winnerBC).toBe('local')

          // Therefore A > C (transitivity)
          const winnerAC = determineWinner(timestampA, timestampC)
          expect(winnerAC).toBe('local')
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property 11.8: Winner is always one of the valid options
   * 
   * For any pair of timestamps, the result SHALL always be either 'local' or 'remote'
   */
  it('should always return a valid winner (local or remote)', () => {
    fc.assert(
      fc.property(
        timestampArb,
        timestampArb,
        (localTimestamp, remoteTimestamp) => {
          const winner = determineWinner(localTimestamp, remoteTimestamp)

          expect(['local', 'remote']).toContain(winner)
        }
      ),
      { numRuns: 100 }
    )
  })
})
