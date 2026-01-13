import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import {
  validateProductInput,
  computeDefaultQuantity,
  filterProductsByQuery,
  filterOutOfStock,
  ProductInput,
  prepareProductInsertData,
  prepareStockHistoryForUpdate,
} from './product.service'
import { Product, ProductUnit } from '@/types'

/**
 * Feature: verdurao-pro-saas, Property 12: Product Creation Stores All Fields
 * 
 * *For any* valid product input, the created product record SHALL contain
 * all provided fields (sku, name, price, unit, stock) with matching values.
 * 
 * **Validates: Requirements 6.1**
 */
describe('Product Creation - Property Tests', () => {
  // Arbitrary for generating valid SKUs
  const skuArbitrary = fc.stringMatching(/^[A-Z0-9]{3,10}$/)

  // Arbitrary for generating valid product names
  const productNameArbitrary = fc.string({ minLength: 1, maxLength: 100 })
    .filter(s => s.trim().length > 0)

  // Arbitrary for generating valid prices (positive numbers)
  const priceArbitrary = fc.float({ min: Math.fround(0.01), max: Math.fround(10000), noNaN: true })
    .filter(p => p > 0)

  // Arbitrary for generating valid units
  const unitArbitrary: fc.Arbitrary<ProductUnit> = fc.constantFrom('un', 'kg', 'g', 'l', 'ml')

  // Arbitrary for generating valid stock (non-negative)
  const stockArbitrary = fc.float({ min: Math.fround(0), max: Math.fround(10000), noNaN: true })
    .filter(s => s >= 0)

  // Arbitrary for generating valid product input
  const validProductInputArbitrary: fc.Arbitrary<ProductInput> = fc.record({
    sku: skuArbitrary,
    name: productNameArbitrary,
    price: priceArbitrary,
    unit: unitArbitrary,
    cost_price: fc.option(priceArbitrary, { nil: null }),
    stock: fc.option(stockArbitrary, { nil: undefined }),
    category: fc.option(fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0), { nil: null }),
  })

  /**
   * Property 12: Product Creation Stores All Fields
   * 
   * Tests that for any valid product input, the prepared insert data
   * contains all provided fields with matching values (trimmed where applicable).
   * 
   * **Validates: Requirements 6.1**
   */
  it('should store all provided fields with matching values for any valid product input', () => {
    fc.assert(
      fc.property(
        validProductInputArbitrary,
        fc.uuid(),
        (input, tenantId) => {
          // First verify input is valid
          const errors = validateProductInput(input)
          expect(errors).toHaveLength(0)

          // Prepare the insert data (simulates what createProduct does)
          const insertData = prepareProductInsertData(input, tenantId)

          // Verify all required fields are stored with matching values
          expect(insertData.tenant_id).toBe(tenantId)
          expect(insertData.sku).toBe(input.sku.trim())
          expect(insertData.name).toBe(input.name.trim())
          expect(insertData.price).toBe(input.price)
          expect(insertData.unit).toBe(input.unit)

          // Verify stock is stored (defaults to 0 if not provided)
          const expectedStock = input.stock ?? 0
          expect(insertData.stock).toBe(expectedStock)

          // Verify optional fields
          expect(insertData.cost_price).toBe(input.cost_price ?? null)
          expect(insertData.category).toBe(input.category?.trim() ?? null)

          // Verify default_quantity is computed correctly
          const expectedDefaultQty = input.default_quantity ?? computeDefaultQuantity(input.unit)
          expect(insertData.default_quantity).toBe(expectedDefaultQty)
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property 12: Product Creation Stores All Fields
   * 
   * Tests that validateProductInput returns no errors for valid input,
   * which is a prerequisite for successful product creation.
   */
  it('should validate all required fields for any valid product input', () => {
    fc.assert(
      fc.property(validProductInputArbitrary, (input) => {
        const errors = validateProductInput(input)
        
        // For valid input, there should be no validation errors
        expect(errors).toHaveLength(0)
      }),
      { numRuns: 100 }
    )
  })

  /**
   * Property 12: Required fields validation
   * 
   * Tests that missing required fields are properly detected.
   */
  it('should detect missing required fields for any incomplete input', () => {
    // Generate inputs with at least one required field missing
    const incompleteInputArbitrary = fc.record({
      sku: fc.option(skuArbitrary, { nil: undefined }),
      name: fc.option(productNameArbitrary, { nil: undefined }),
      price: fc.option(priceArbitrary, { nil: undefined }),
      unit: fc.option(unitArbitrary, { nil: undefined }),
    }).filter(input => {
      // At least one required field must be missing
      return input.sku === undefined || 
             input.name === undefined || 
             input.price === undefined || 
             input.unit === undefined
    })

    fc.assert(
      fc.property(incompleteInputArbitrary, (input) => {
        const errors = validateProductInput(input as Partial<ProductInput>)
        
        // Should have at least one validation error
        expect(errors.length).toBeGreaterThan(0)
      }),
      { numRuns: 100 }
    )
  })

  /**
   * Property 12: Price validation
   * 
   * Tests that invalid prices (zero or negative) are rejected.
   */
  it('should reject invalid prices for any input with non-positive price', () => {
    const invalidPriceArbitrary = fc.float({ min: Math.fround(-1000), max: Math.fround(0), noNaN: true })

    fc.assert(
      fc.property(
        skuArbitrary,
        productNameArbitrary,
        invalidPriceArbitrary,
        unitArbitrary,
        (sku, name, price, unit) => {
          const input: ProductInput = { sku, name, price, unit }
          const errors = validateProductInput(input)
          
          // Should have a price validation error
          const priceError = errors.find(e => e.field === 'price')
          expect(priceError).toBeDefined()
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property 12: Stock validation
   * 
   * Tests that negative stock values are rejected.
   */
  it('should reject negative stock for any input with negative stock', () => {
    const negativeStockArbitrary = fc.float({ min: Math.fround(-1000), max: Math.fround(-0.01), noNaN: true })

    fc.assert(
      fc.property(
        skuArbitrary,
        productNameArbitrary,
        priceArbitrary,
        unitArbitrary,
        negativeStockArbitrary,
        (sku, name, price, unit, stock) => {
          const input: ProductInput = { sku, name, price, unit, stock }
          const errors = validateProductInput(input)
          
          // Should have a stock validation error
          const stockError = errors.find(e => e.field === 'stock')
          expect(stockError).toBeDefined()
        }
      ),
      { numRuns: 100 }
    )
  })
})


/**
 * Feature: verdurao-pro-saas, Property 7: Default Quantity Based on Unit Type
 * 
 * *For any* product added to cart, the default quantity SHALL be 1 when unit
 * is "un" and 0.5 when unit is "kg", "g", "l", or "ml".
 * 
 * **Validates: Requirements 4.3**
 */
describe('Default Quantity - Property Tests', () => {
  const unitArbitrary: fc.Arbitrary<ProductUnit> = fc.constantFrom('un', 'kg', 'g', 'l', 'ml')

  /**
   * Property 7: Default quantity for unit type
   * 
   * Tests that computeDefaultQuantity returns correct values based on unit.
   */
  it('should return 1 for "un" and 0.5 for weight/volume units', () => {
    fc.assert(
      fc.property(unitArbitrary, (unit) => {
        const defaultQty = computeDefaultQuantity(unit)
        
        if (unit === 'un') {
          expect(defaultQty).toBe(1)
        } else {
          expect(defaultQty).toBe(0.5)
        }
      }),
      { numRuns: 100 }
    )
  })

  /**
   * Property 7: Idempotence
   * 
   * Tests that computeDefaultQuantity produces consistent results.
   */
  it('should produce consistent default quantities for the same unit', () => {
    fc.assert(
      fc.property(unitArbitrary, (unit) => {
        const result1 = computeDefaultQuantity(unit)
        const result2 = computeDefaultQuantity(unit)
        const result3 = computeDefaultQuantity(unit)
        
        expect(result1).toBe(result2)
        expect(result2).toBe(result3)
      }),
      { numRuns: 100 }
    )
  })
})

/**
 * Feature: verdurao-pro-saas, Property 6: Product Search Returns Correct Matches
 * 
 * *For any* search query string and product catalog, the search results SHALL
 * contain only products where the query matches the product name, SKU, or
 * category (case-insensitive partial match).
 * 
 * **Validates: Requirements 4.2, 6.5**
 */
describe('Product Search - Property Tests', () => {
  // Arbitrary for generating products
  const productArbitrary: fc.Arbitrary<Product> = fc.record({
    id: fc.uuid(),
    tenant_id: fc.uuid(),
    sku: fc.stringMatching(/^[A-Z0-9]{3,10}$/),
    name: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
    price: fc.float({ min: Math.fround(0.01), max: Math.fround(1000), noNaN: true }),
    cost_price: fc.option(fc.float({ min: Math.fround(0.01), max: Math.fround(1000), noNaN: true }), { nil: null }),
    unit: fc.constantFrom('un', 'kg', 'g', 'l', 'ml') as fc.Arbitrary<ProductUnit>,
    default_quantity: fc.float({ min: Math.fround(0.1), max: Math.fround(10), noNaN: true }),
    stock: fc.float({ min: Math.fround(0), max: Math.fround(1000), noNaN: true }),
    category: fc.option(fc.string({ minLength: 1, maxLength: 30 }).filter(s => s.trim().length > 0), { nil: null }),
    is_active: fc.constant(true),
    created_at: fc.date({ min: new Date('2020-01-01'), max: new Date('2025-12-31') })
      .filter(d => !isNaN(d.getTime()))
      .map(d => d.toISOString()),
    updated_at: fc.date({ min: new Date('2020-01-01'), max: new Date('2025-12-31') })
      .filter(d => !isNaN(d.getTime()))
      .map(d => d.toISOString()),
  })

  /**
   * Property 6: Search results contain only matching products
   * 
   * For any search query, all returned products must match the query
   * in name, SKU, or category.
   */
  it('should return only products matching the query in name, SKU, or category', () => {
    fc.assert(
      fc.property(
        fc.array(productArbitrary, { minLength: 0, maxLength: 20 }),
        fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0),
        (products, query) => {
          const results = filterProductsByQuery(products, query)
          const normalizedQuery = query.toLowerCase().trim()
          
          // All results must match the query
          for (const product of results) {
            const nameMatch = product.name.toLowerCase().includes(normalizedQuery)
            const skuMatch = product.sku.toLowerCase().includes(normalizedQuery)
            const categoryMatch = product.category?.toLowerCase().includes(normalizedQuery) ?? false
            
            expect(nameMatch || skuMatch || categoryMatch).toBe(true)
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property 6: Empty query returns all products
   * 
   * An empty or whitespace-only query should return all products.
   */
  it('should return all products for empty query', () => {
    const emptyQueryArbitrary = fc.constantFrom('', '   ', '\t', '\n')

    fc.assert(
      fc.property(
        fc.array(productArbitrary, { minLength: 0, maxLength: 20 }),
        emptyQueryArbitrary,
        (products, query) => {
          const results = filterProductsByQuery(products, query)
          
          expect(results).toHaveLength(products.length)
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property 6: Search is case-insensitive
   * 
   * The same query in different cases should return the same results.
   */
  it('should return same results regardless of query case', () => {
    fc.assert(
      fc.property(
        fc.array(productArbitrary, { minLength: 0, maxLength: 20 }),
        fc.string({ minLength: 1, maxLength: 10 }).filter(s => /^[a-zA-Z]+$/.test(s)),
        (products, query) => {
          const lowerResults = filterProductsByQuery(products, query.toLowerCase())
          const upperResults = filterProductsByQuery(products, query.toUpperCase())
          const mixedResults = filterProductsByQuery(products, query)
          
          expect(lowerResults).toHaveLength(upperResults.length)
          expect(lowerResults).toHaveLength(mixedResults.length)
        }
      ),
      { numRuns: 100 }
    )
  })
})

/**
 * Feature: verdurao-pro-saas, Property 14: Out-of-Stock Products Query
 * 
 * *For any* tenant's product catalog, the out-of-stock query SHALL return
 * exactly the products where stock equals zero.
 * 
 * **Validates: Requirements 6.3**
 */
describe('Out-of-Stock Products - Property Tests', () => {
  const productArbitrary: fc.Arbitrary<Product> = fc.record({
    id: fc.uuid(),
    tenant_id: fc.uuid(),
    sku: fc.stringMatching(/^[A-Z0-9]{3,10}$/),
    name: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
    price: fc.float({ min: Math.fround(0.01), max: Math.fround(1000), noNaN: true }),
    cost_price: fc.option(fc.float({ min: Math.fround(0.01), max: Math.fround(1000), noNaN: true }), { nil: null }),
    unit: fc.constantFrom('un', 'kg', 'g', 'l', 'ml') as fc.Arbitrary<ProductUnit>,
    default_quantity: fc.float({ min: Math.fround(0.1), max: Math.fround(10), noNaN: true }),
    stock: fc.oneof(fc.constant(0), fc.float({ min: Math.fround(0.01), max: Math.fround(1000), noNaN: true })),
    category: fc.option(fc.string({ minLength: 1, maxLength: 30 }), { nil: null }),
    is_active: fc.constant(true),
    created_at: fc.date({ min: new Date('2020-01-01'), max: new Date('2025-12-31') })
      .filter(d => !isNaN(d.getTime()))
      .map(d => d.toISOString()),
    updated_at: fc.date({ min: new Date('2020-01-01'), max: new Date('2025-12-31') })
      .filter(d => !isNaN(d.getTime()))
      .map(d => d.toISOString()),
  })

  /**
   * Property 14: Out-of-stock filter returns only zero-stock products
   * 
   * All returned products must have stock === 0.
   */
  it('should return only products with stock equal to zero', () => {
    fc.assert(
      fc.property(
        fc.array(productArbitrary, { minLength: 0, maxLength: 20 }),
        (products) => {
          const outOfStock = filterOutOfStock(products)
          
          // All results must have zero stock
          for (const product of outOfStock) {
            expect(product.stock).toBe(0)
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property 14: Out-of-stock filter returns all zero-stock products
   * 
   * No zero-stock product should be missing from results.
   */
  it('should return all products with zero stock', () => {
    fc.assert(
      fc.property(
        fc.array(productArbitrary, { minLength: 0, maxLength: 20 }),
        (products) => {
          const outOfStock = filterOutOfStock(products)
          const expectedCount = products.filter(p => p.stock === 0).length
          
          expect(outOfStock).toHaveLength(expectedCount)
        }
      ),
      { numRuns: 100 }
    )
  })
})


/**
 * Feature: verdurao-pro-saas, Property 13: Product Edit Creates History
 * 
 * *For any* product update operation, a stock_history record SHALL be created
 * with the change details and reference to the product.
 * 
 * **Validates: Requirements 6.2**
 */
describe('Product Edit History - Property Tests', () => {
  // Arbitrary for generating realistic stock values (non-negative, up to 3 decimal places)
  // Using integer-based generation to avoid floating-point precision issues
  const stockArbitrary = fc.integer({ min: 0, max: 10000000 })
    .map(n => n / 1000) // Convert to decimal with max 3 decimal places

  /**
   * Property 13: Stock change creates history entry
   * 
   * For any product with current stock and a different new stock value,
   * a stock history entry SHALL be created with the correct quantity change.
   */
  it('should create history entry when stock changes', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        stockArbitrary,
        stockArbitrary,
        fc.option(fc.uuid(), { nil: null }),
        (productId, currentStock, newStock, referenceId) => {
          // Skip when stocks are equal (no change)
          fc.pre(currentStock !== newStock)

          const historyEntry = prepareStockHistoryForUpdate(
            productId,
            currentStock,
            newStock,
            referenceId
          )

          // History entry should be created
          expect(historyEntry).not.toBeNull()
          expect(historyEntry!.product_id).toBe(productId)
          expect(historyEntry!.quantity_change).toBe(newStock - currentStock)
          expect(historyEntry!.reason).toBe('adjustment')
          expect(historyEntry!.reference_id).toBe(referenceId)
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property 13: No history entry when stock unchanged
   * 
   * For any product where the new stock equals the current stock,
   * no history entry should be created.
   */
  it('should not create history entry when stock is unchanged', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        stockArbitrary,
        fc.option(fc.uuid(), { nil: null }),
        (productId, stock, referenceId) => {
          const historyEntry = prepareStockHistoryForUpdate(
            productId,
            stock,
            stock, // Same stock value
            referenceId
          )

          // No history entry should be created
          expect(historyEntry).toBeNull()
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property 13: No history entry when stock not provided
   * 
   * For any product update where stock is undefined (not being updated),
   * no history entry should be created.
   */
  it('should not create history entry when stock is not provided in update', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        stockArbitrary,
        fc.option(fc.uuid(), { nil: null }),
        (productId, currentStock, referenceId) => {
          const historyEntry = prepareStockHistoryForUpdate(
            productId,
            currentStock,
            undefined, // Stock not provided
            referenceId
          )

          // No history entry should be created
          expect(historyEntry).toBeNull()
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property 13: Quantity change calculation is correct
   * 
   * For any stock change, the quantity_change should equal newStock - currentStock.
   * This tests both positive (stock increase) and negative (stock decrease) changes.
   */
  it('should calculate correct quantity change for any stock modification', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        stockArbitrary,
        stockArbitrary,
        (productId, currentStock, newStock) => {
          fc.pre(currentStock !== newStock)

          const historyEntry = prepareStockHistoryForUpdate(
            productId,
            currentStock,
            newStock,
            null
          )

          expect(historyEntry).not.toBeNull()
          
          // Verify the mathematical relationship
          const expectedChange = newStock - currentStock
          expect(historyEntry!.quantity_change).toBe(expectedChange)
          
          // Verify that applying the change to current stock gives new stock
          // Using toBeCloseTo for floating-point comparison with 3 decimal precision
          expect(currentStock + historyEntry!.quantity_change).toBeCloseTo(newStock, 3)
        }
      ),
      { numRuns: 100 }
    )
  })
})
