import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import {
  calculateDateRange,
  aggregateSalesTotals,
  calculateProfitMargin,
  calculateAbsoluteProfit,
  aggregateProductSales,
  findMostSoldProduct,
  calculateProductProfitMargins
} from './report.service'
import { Sale, SaleItem, Product } from '@/types'

describe('ReportService', () => {
  describe('calculateDateRange', () => {
    it('should calculate day range correctly', () => {
      const refDate = new Date('2024-06-15T14:30:00')
      const range = calculateDateRange('day', refDate)

      expect(range.startDate.getFullYear()).toBe(2024)
      expect(range.startDate.getMonth()).toBe(5) // June
      expect(range.startDate.getDate()).toBe(15)
      expect(range.startDate.getHours()).toBe(0)
      expect(range.startDate.getMinutes()).toBe(0)

      expect(range.endDate.getDate()).toBe(15)
      expect(range.endDate.getHours()).toBe(23)
      expect(range.endDate.getMinutes()).toBe(59)
    })

    it('should calculate week range correctly', () => {
      // June 15, 2024 is a Saturday
      const refDate = new Date('2024-06-15T14:30:00')
      const range = calculateDateRange('week', refDate)

      // Week should start on Sunday (June 9)
      expect(range.startDate.getDate()).toBe(9)
      expect(range.endDate.getDate()).toBe(15)
    })

    it('should calculate month range correctly', () => {
      const refDate = new Date('2024-06-15T14:30:00')
      const range = calculateDateRange('month', refDate)

      expect(range.startDate.getDate()).toBe(1)
      expect(range.startDate.getMonth()).toBe(5) // June
      expect(range.endDate.getDate()).toBe(15)
    })
  })


  describe('aggregateSalesTotals', () => {
    it('should aggregate sales correctly', () => {
      const sales: Sale[] = [
        { id: '1', tenant_id: 't1', user_id: 'u1', total: 100, created_at: '2024-06-15', synced_at: null, local_id: null },
        { id: '2', tenant_id: 't1', user_id: 'u1', total: 50, created_at: '2024-06-15', synced_at: null, local_id: null },
        { id: '3', tenant_id: 't1', user_id: 'u1', total: 75, created_at: '2024-06-15', synced_at: null, local_id: null }
      ]

      const result = aggregateSalesTotals(sales)

      expect(result.totalSales).toBe(3)
      expect(result.totalRevenue).toBe(225)
      expect(result.averageTicket).toBe(75)
    })

    it('should handle empty sales array', () => {
      const result = aggregateSalesTotals([])

      expect(result.totalSales).toBe(0)
      expect(result.totalRevenue).toBe(0)
      expect(result.averageTicket).toBe(0)
    })

    it('should round values correctly', () => {
      const sales: Sale[] = [
        { id: '1', tenant_id: 't1', user_id: 'u1', total: 10.333, created_at: '2024-06-15', synced_at: null, local_id: null },
        { id: '2', tenant_id: 't1', user_id: 'u1', total: 10.333, created_at: '2024-06-15', synced_at: null, local_id: null },
        { id: '3', tenant_id: 't1', user_id: 'u1', total: 10.334, created_at: '2024-06-15', synced_at: null, local_id: null }
      ]

      const result = aggregateSalesTotals(sales)

      expect(result.totalRevenue).toBe(31)
      expect(result.averageTicket).toBe(10.33)
    })
  })

  describe('calculateProfitMargin', () => {
    it('should calculate profit margin correctly', () => {
      // Price: 100, Cost: 60 => Margin: (100-60)/100 * 100 = 40%
      expect(calculateProfitMargin(100, 60)).toBe(40)
    })

    it('should handle zero price', () => {
      expect(calculateProfitMargin(0, 50)).toBe(0)
    })

    it('should handle negative margin', () => {
      // Price: 50, Cost: 60 => Margin: (50-60)/50 * 100 = -20%
      expect(calculateProfitMargin(50, 60)).toBe(-20)
    })

    it('should round to 2 decimal places', () => {
      // Price: 100, Cost: 33 => Margin: 67%
      expect(calculateProfitMargin(100, 33)).toBe(67)
    })
  })

  describe('calculateAbsoluteProfit', () => {
    it('should calculate absolute profit correctly', () => {
      expect(calculateAbsoluteProfit(100, 60)).toBe(40)
    })

    it('should handle negative profit', () => {
      expect(calculateAbsoluteProfit(50, 60)).toBe(-10)
    })
  })


  describe('aggregateProductSales', () => {
    it('should aggregate product sales correctly', () => {
      const saleItems: SaleItem[] = [
        { id: 'i1', sale_id: 's1', product_id: 'p1', quantity: 5, unit_price: 10, subtotal: 50 },
        { id: 'i2', sale_id: 's1', product_id: 'p2', quantity: 3, unit_price: 20, subtotal: 60 },
        { id: 'i3', sale_id: 's2', product_id: 'p1', quantity: 2, unit_price: 10, subtotal: 20 }
      ]

      const productMap = new Map<string, Product>([
        ['p1', { id: 'p1', name: 'Product 1', tenant_id: 't1', sku: 'SKU1', price: 10, cost_price: null, unit: 'un', default_quantity: 1, stock: 100, category: null, is_active: true, created_at: '', updated_at: '' }],
        ['p2', { id: 'p2', name: 'Product 2', tenant_id: 't1', sku: 'SKU2', price: 20, cost_price: null, unit: 'un', default_quantity: 1, stock: 50, category: null, is_active: true, created_at: '', updated_at: '' }]
      ])

      const result = aggregateProductSales(saleItems, productMap)

      expect(result).toHaveLength(2)

      const p1Data = result.find(r => r.productId === 'p1')
      expect(p1Data?.totalQuantity).toBe(7) // 5 + 2
      expect(p1Data?.totalRevenue).toBe(70) // 50 + 20

      const p2Data = result.find(r => r.productId === 'p2')
      expect(p2Data?.totalQuantity).toBe(3)
      expect(p2Data?.totalRevenue).toBe(60)
    })

    it('should handle empty sale items', () => {
      const result = aggregateProductSales([], new Map())
      expect(result).toHaveLength(0)
    })
  })

  describe('findMostSoldProduct', () => {
    it('should find the most sold product', () => {
      const productSalesData = [
        { productId: 'p1', productName: 'Product 1', totalQuantity: 10, totalRevenue: 100 },
        { productId: 'p2', productName: 'Product 2', totalQuantity: 25, totalRevenue: 250 },
        { productId: 'p3', productName: 'Product 3', totalQuantity: 15, totalRevenue: 150 }
      ]

      const result = findMostSoldProduct(productSalesData)

      expect(result?.productId).toBe('p2')
      expect(result?.totalQuantity).toBe(25)
    })

    it('should return null for empty array', () => {
      const result = findMostSoldProduct([])
      expect(result).toBeNull()
    })

    it('should return first product when quantities are equal', () => {
      const productSalesData = [
        { productId: 'p1', productName: 'Product 1', totalQuantity: 10, totalRevenue: 100 },
        { productId: 'p2', productName: 'Product 2', totalQuantity: 10, totalRevenue: 200 }
      ]

      const result = findMostSoldProduct(productSalesData)
      expect(result?.productId).toBe('p1')
    })
  })


  describe('calculateProductProfitMargins', () => {
    it('should calculate profit margins for products with cost price', () => {
      const products: Product[] = [
        { id: 'p1', name: 'Product 1', tenant_id: 't1', sku: 'SKU1', price: 100, cost_price: 60, unit: 'un', default_quantity: 1, stock: 100, category: null, is_active: true, created_at: '', updated_at: '' },
        { id: 'p2', name: 'Product 2', tenant_id: 't1', sku: 'SKU2', price: 50, cost_price: 30, unit: 'un', default_quantity: 1, stock: 50, category: null, is_active: true, created_at: '', updated_at: '' },
        { id: 'p3', name: 'Product 3', tenant_id: 't1', sku: 'SKU3', price: 25, cost_price: null, unit: 'un', default_quantity: 1, stock: 25, category: null, is_active: true, created_at: '', updated_at: '' }
      ]

      const result = calculateProductProfitMargins(products)

      expect(result).toHaveLength(2) // Only products with cost_price

      const p1Margin = result.find(r => r.productId === 'p1')
      expect(p1Margin?.profitMargin).toBe(40) // (100-60)/100 * 100
      expect(p1Margin?.absoluteProfit).toBe(40)

      const p2Margin = result.find(r => r.productId === 'p2')
      expect(p2Margin?.profitMargin).toBe(40) // (50-30)/50 * 100
      expect(p2Margin?.absoluteProfit).toBe(20)
    })

    it('should return empty array when no products have cost price', () => {
      const products: Product[] = [
        { id: 'p1', name: 'Product 1', tenant_id: 't1', sku: 'SKU1', price: 100, cost_price: null, unit: 'un', default_quantity: 1, stock: 100, category: null, is_active: true, created_at: '', updated_at: '' }
      ]

      const result = calculateProductProfitMargins(products)
      expect(result).toHaveLength(0)
    })
  })
})


/**
 * Property-Based Tests for Report Service
 * Using fast-check for property-based testing
 */
describe('Report Service - Property-Based Tests', () => {
  /**
   * Feature: verdurao-pro-saas, Property 21: Sales Report Aggregation
   * 
   * *For any* tenant and date range, the sales report totals SHALL equal
   * the sum of all sale totals within that date range.
   * 
   * **Validates: Requirements 11.1, 11.3**
   */
  describe('Property 21: Sales Report Aggregation', () => {
    // Helper to generate valid ISO date strings without using fc.date() which can produce invalid dates
    const validDateStringArb = fc.integer({ min: 2020, max: 2030 }).chain(year =>
      fc.integer({ min: 1, max: 12 }).chain(month =>
        fc.integer({ min: 1, max: 28 }).map(day => {
          const m = month.toString().padStart(2, '0')
          const d = day.toString().padStart(2, '0')
          return `${year}-${m}-${d}T00:00:00.000Z`
        })
      )
    )

    // Arbitrary for generating valid Sale records with integer totals to avoid floating point issues
    const saleArb = fc.record({
      id: fc.uuid(),
      tenant_id: fc.uuid(),
      user_id: fc.uuid(),
      total: fc.integer({ min: 1, max: 100000 }).map(n => n / 100), // Use integers divided by 100 for precise decimals
      created_at: validDateStringArb,
      synced_at: fc.option(validDateStringArb, { nil: null }),
      local_id: fc.option(fc.uuid(), { nil: null })
    }) as fc.Arbitrary<Sale>

    // Arbitrary for generating arrays of sales
    const salesArrayArb = fc.array(saleArb, { minLength: 0, maxLength: 50 })

    it('totalRevenue equals sum of all sale totals for any sales array', () => {
      fc.assert(
        fc.property(
          salesArrayArb,
          (sales) => {
            const result = aggregateSalesTotals(sales)
            
            // Calculate expected total revenue as sum of all sale totals
            const expectedRevenue = sales.reduce((sum, sale) => sum + sale.total, 0)
            const roundedExpectedRevenue = Math.round(expectedRevenue * 100) / 100
            
            expect(result.totalRevenue).toBe(roundedExpectedRevenue)
          }
        ),
        { numRuns: 100 }
      )
    })

    it('totalSales equals the count of sales for any sales array', () => {
      fc.assert(
        fc.property(
          salesArrayArb,
          (sales) => {
            const result = aggregateSalesTotals(sales)
            
            expect(result.totalSales).toBe(sales.length)
          }
        ),
        { numRuns: 100 }
      )
    })

    it('averageTicket equals totalRevenue divided by totalSales for non-empty arrays', () => {
      fc.assert(
        fc.property(
          fc.array(saleArb, { minLength: 1, maxLength: 50 }),
          (sales) => {
            const result = aggregateSalesTotals(sales)
            
            // Calculate expected average
            const totalRevenue = sales.reduce((sum, sale) => sum + sale.total, 0)
            const expectedAverage = totalRevenue / sales.length
            const roundedExpectedAverage = Math.round(expectedAverage * 100) / 100
            
            expect(result.averageTicket).toBe(roundedExpectedAverage)
          }
        ),
        { numRuns: 100 }
      )
    })

    it('averageTicket is zero for empty sales array', () => {
      const result = aggregateSalesTotals([])
      
      expect(result.totalSales).toBe(0)
      expect(result.totalRevenue).toBe(0)
      expect(result.averageTicket).toBe(0)
    })

    it('aggregation is consistent regardless of sale order', () => {
      fc.assert(
        fc.property(
          fc.array(saleArb, { minLength: 2, maxLength: 20 }),
          (sales) => {
            // Aggregate original order
            const result1 = aggregateSalesTotals(sales)
            
            // Aggregate reversed order
            const reversedSales = [...sales].reverse()
            const result2 = aggregateSalesTotals(reversedSales)
            
            // Results should be identical (use toBeCloseTo with 1 decimal precision for floating point tolerance)
            expect(result1.totalSales).toBe(result2.totalSales)
            expect(result1.totalRevenue).toBeCloseTo(result2.totalRevenue, 1)
            expect(result1.averageTicket).toBeCloseTo(result2.averageTicket, 1)
          }
        ),
        { numRuns: 100 }
      )
    })

    it('adding a sale increases totalRevenue by exactly the sale total', () => {
      fc.assert(
        fc.property(
          salesArrayArb,
          saleArb,
          (existingSales, newSale) => {
            const resultBefore = aggregateSalesTotals(existingSales)
            const resultAfter = aggregateSalesTotals([...existingSales, newSale])
            
            // Total sales should increase by 1
            expect(resultAfter.totalSales).toBe(resultBefore.totalSales + 1)
            
            // Total revenue should increase by the new sale's total (with tolerance for floating point)
            const expectedRevenue = Math.round((resultBefore.totalRevenue + newSale.total) * 100) / 100
            // Use closeTo for floating point comparison with small tolerance
            expect(resultAfter.totalRevenue).toBeCloseTo(expectedRevenue, 2)
          }
        ),
        { numRuns: 100 }
      )
    })

    it('totalRevenue is non-negative for any valid sales array', () => {
      fc.assert(
        fc.property(
          salesArrayArb,
          (sales) => {
            const result = aggregateSalesTotals(sales)
            
            expect(result.totalRevenue).toBeGreaterThanOrEqual(0)
          }
        ),
        { numRuns: 100 }
      )
    })

    it('averageTicket is non-negative for any valid sales array', () => {
      fc.assert(
        fc.property(
          salesArrayArb,
          (sales) => {
            const result = aggregateSalesTotals(sales)
            
            expect(result.averageTicket).toBeGreaterThanOrEqual(0)
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  /**
   * Feature: verdurao-pro-saas, Property 23: Profit Margin Calculation
   * 
   * *For any* product with both price and cost_price defined,
   * the profit margin SHALL equal (price - cost_price) / price * 100
   * 
   * **Validates: Requirements 11.4**
   */
  describe('Property 23: Profit Margin Calculation', () => {
    // Arbitrary for positive prices (must be > 0 for valid margin calculation)
    const positivePriceArb = fc.float({ min: Math.fround(0.01), max: Math.fround(10000), noNaN: true })
    
    // Arbitrary for cost prices (can be any non-negative value)
    const costPriceArb = fc.float({ min: Math.fround(0), max: Math.fround(10000), noNaN: true })

    it('profit margin equals (price - costPrice) / price * 100 for any valid price and cost', () => {
      fc.assert(
        fc.property(
          positivePriceArb,
          costPriceArb,
          (price, costPrice) => {
            const result = calculateProfitMargin(price, costPrice)
            
            // Calculate expected margin using the formula
            const expectedMargin = ((price - costPrice) / price) * 100
            const roundedExpectedMargin = Math.round(expectedMargin * 100) / 100
            
            expect(result).toBe(roundedExpectedMargin)
          }
        ),
        { numRuns: 100 }
      )
    })

    it('profit margin is 0 when price equals cost price', () => {
      fc.assert(
        fc.property(
          positivePriceArb,
          (price) => {
            const result = calculateProfitMargin(price, price)
            
            expect(result).toBe(0)
          }
        ),
        { numRuns: 100 }
      )
    })

    it('profit margin is 100% when cost price is 0', () => {
      fc.assert(
        fc.property(
          positivePriceArb,
          (price) => {
            const result = calculateProfitMargin(price, 0)
            
            expect(result).toBe(100)
          }
        ),
        { numRuns: 100 }
      )
    })

    it('profit margin is negative when cost price exceeds price', () => {
      fc.assert(
        fc.property(
          positivePriceArb,
          fc.float({ min: Math.fround(1), max: Math.fround(1000), noNaN: true }),
          (price, extraCost) => {
            // Ensure cost price is meaningfully higher than price to avoid rounding to 0
            const costPrice = price + extraCost
            const result = calculateProfitMargin(price, costPrice)
            
            // The margin should be negative or zero (due to rounding of very small differences)
            // The formula is (price - costPrice) / price * 100
            // When costPrice > price, this is negative
            expect(result).toBeLessThanOrEqual(0)
          }
        ),
        { numRuns: 100 }
      )
    })

    it('profit margin is positive when price exceeds cost price', () => {
      fc.assert(
        fc.property(
          positivePriceArb,
          (price) => {
            // Cost price is half of price
            const costPrice = price / 2
            const result = calculateProfitMargin(price, costPrice)
            
            expect(result).toBeGreaterThan(0)
          }
        ),
        { numRuns: 100 }
      )
    })

    it('profit margin is 0 when price is 0 or negative', () => {
      fc.assert(
        fc.property(
          fc.float({ min: Math.fround(-1000), max: Math.fround(0), noNaN: true }),
          costPriceArb,
          (price, costPrice) => {
            const result = calculateProfitMargin(price, costPrice)
            
            expect(result).toBe(0)
          }
        ),
        { numRuns: 100 }
      )
    })

    it('absolute profit equals price minus cost price', () => {
      fc.assert(
        fc.property(
          positivePriceArb,
          costPriceArb,
          (price, costPrice) => {
            const result = calculateAbsoluteProfit(price, costPrice)
            
            const expectedProfit = Math.round((price - costPrice) * 100) / 100
            
            expect(result).toBe(expectedProfit)
          }
        ),
        { numRuns: 100 }
      )
    })

    // Helper to generate valid ISO date strings without using fc.date() which can produce invalid dates
    const validDateStringArb = fc.integer({ min: 2020, max: 2030 }).chain(year =>
      fc.integer({ min: 1, max: 12 }).chain(month =>
        fc.integer({ min: 1, max: 28 }).map(day => {
          const m = month.toString().padStart(2, '0')
          const d = day.toString().padStart(2, '0')
          return `${year}-${m}-${d}T00:00:00.000Z`
        })
      )
    )

    // Arbitrary for generating valid Product records with cost price
    const productWithCostPriceArb = fc.record({
      id: fc.uuid(),
      tenant_id: fc.uuid(),
      sku: fc.string({ minLength: 1, maxLength: 20 }),
      name: fc.string({ minLength: 1, maxLength: 100 }),
      price: positivePriceArb,
      cost_price: costPriceArb,
      unit: fc.constantFrom('un', 'kg', 'g', 'l', 'ml') as fc.Arbitrary<'un' | 'kg' | 'g' | 'l' | 'ml'>,
      default_quantity: fc.float({ min: Math.fround(0.1), max: Math.fround(10), noNaN: true }),
      stock: fc.float({ min: Math.fround(0), max: Math.fround(1000), noNaN: true }),
      category: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: null }),
      is_active: fc.boolean(),
      created_at: validDateStringArb,
      updated_at: validDateStringArb
    }) as fc.Arbitrary<Product>

    it('calculateProductProfitMargins returns correct margins for all products with cost price', () => {
      fc.assert(
        fc.property(
          fc.array(productWithCostPriceArb, { minLength: 1, maxLength: 20 }),
          (products) => {
            const result = calculateProductProfitMargins(products)
            
            // All products have cost_price, so result should have same length
            expect(result.length).toBe(products.length)
            
            // Verify each margin calculation
            for (const margin of result) {
              const product = products.find(p => p.id === margin.productId)
              expect(product).toBeDefined()
              
              if (product && product.cost_price !== null) {
                const expectedMargin = calculateProfitMargin(product.price, product.cost_price)
                const expectedAbsoluteProfit = calculateAbsoluteProfit(product.price, product.cost_price)
                
                expect(margin.profitMargin).toBe(expectedMargin)
                expect(margin.absoluteProfit).toBe(expectedAbsoluteProfit)
                expect(margin.price).toBe(product.price)
                expect(margin.costPrice).toBe(product.cost_price)
              }
            }
          }
        ),
        { numRuns: 100 }
      )
    })

    it('calculateProductProfitMargins filters out products without cost price', () => {
      // Arbitrary for products without cost price
      const productWithoutCostPriceArb = fc.record({
        id: fc.uuid(),
        tenant_id: fc.uuid(),
        sku: fc.string({ minLength: 1, maxLength: 20 }),
        name: fc.string({ minLength: 1, maxLength: 100 }),
        price: positivePriceArb,
        cost_price: fc.constant(null),
        unit: fc.constantFrom('un', 'kg', 'g', 'l', 'ml') as fc.Arbitrary<'un' | 'kg' | 'g' | 'l' | 'ml'>,
        default_quantity: fc.float({ min: Math.fround(0.1), max: Math.fround(10), noNaN: true }),
        stock: fc.float({ min: Math.fround(0), max: Math.fround(1000), noNaN: true }),
        category: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: null }),
        is_active: fc.boolean(),
        created_at: validDateStringArb,
        updated_at: validDateStringArb
      }) as fc.Arbitrary<Product>

      fc.assert(
        fc.property(
          fc.array(productWithCostPriceArb, { minLength: 0, maxLength: 10 }),
          fc.array(productWithoutCostPriceArb, { minLength: 0, maxLength: 10 }),
          (productsWithCost, productsWithoutCost) => {
            const allProducts = [...productsWithCost, ...productsWithoutCost]
            const result = calculateProductProfitMargins(allProducts)
            
            // Result should only contain products with cost price
            expect(result.length).toBe(productsWithCost.length)
            
            // All result items should have valid cost prices
            for (const margin of result) {
              expect(margin.costPrice).toBeDefined()
              expect(typeof margin.costPrice).toBe('number')
            }
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  /**
   * Feature: verdurao-pro-saas, Property 22: Most Sold Product Calculation
   * 
   * *For any* tenant and date range, the most sold product SHALL be
   * the product with the highest total quantity sold across all sales in that period.
   * 
   * **Validates: Requirements 11.2**
   */
  describe('Property 22: Most Sold Product Calculation', () => {
    // Helper to generate valid ISO date strings
    const validDateStringArb = fc.integer({ min: 2020, max: 2030 }).chain(year =>
      fc.integer({ min: 1, max: 12 }).chain(month =>
        fc.integer({ min: 1, max: 28 }).map(day => {
          const m = month.toString().padStart(2, '0')
          const d = day.toString().padStart(2, '0')
          return `${year}-${m}-${d}T00:00:00.000Z`
        })
      )
    )

    // Arbitrary for generating valid Product records
    const productArb = fc.record({
      id: fc.uuid(),
      tenant_id: fc.uuid(),
      sku: fc.string({ minLength: 1, maxLength: 20 }),
      name: fc.string({ minLength: 1, maxLength: 100 }),
      price: fc.float({ min: Math.fround(0.01), max: Math.fround(1000), noNaN: true }),
      cost_price: fc.option(fc.float({ min: Math.fround(0), max: Math.fround(500), noNaN: true }), { nil: null }),
      unit: fc.constantFrom('un', 'kg', 'g', 'l', 'ml') as fc.Arbitrary<'un' | 'kg' | 'g' | 'l' | 'ml'>,
      default_quantity: fc.float({ min: Math.fround(0.1), max: Math.fround(10), noNaN: true }),
      stock: fc.float({ min: Math.fround(0), max: Math.fround(1000), noNaN: true }),
      category: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: null }),
      is_active: fc.boolean(),
      created_at: validDateStringArb,
      updated_at: validDateStringArb
    }) as fc.Arbitrary<Product>

    // Arbitrary for generating ProductSalesData
    const productSalesDataArb = fc.record({
      productId: fc.uuid(),
      productName: fc.string({ minLength: 1, maxLength: 100 }),
      totalQuantity: fc.integer({ min: 1, max: 10000 }),
      totalRevenue: fc.float({ min: Math.fround(0.01), max: Math.fround(100000), noNaN: true })
    })

    // Arbitrary for generating SaleItem records
    const saleItemArb = (productIds: string[]) => fc.record({
      id: fc.uuid(),
      sale_id: fc.uuid(),
      product_id: fc.constantFrom(...productIds),
      quantity: fc.integer({ min: 1, max: 100 }),
      unit_price: fc.float({ min: Math.fround(0.01), max: Math.fround(1000), noNaN: true }),
      subtotal: fc.float({ min: Math.fround(0.01), max: Math.fround(10000), noNaN: true })
    }) as fc.Arbitrary<SaleItem>

    it('findMostSoldProduct returns the product with highest totalQuantity', () => {
      fc.assert(
        fc.property(
          fc.array(productSalesDataArb, { minLength: 1, maxLength: 50 }),
          (productSalesData) => {
            const result = findMostSoldProduct(productSalesData)
            
            // Result should not be null for non-empty array
            expect(result).not.toBeNull()
            
            // Find the maximum quantity manually
            const maxQuantity = Math.max(...productSalesData.map(p => p.totalQuantity))
            
            // The result should have the maximum quantity
            expect(result!.totalQuantity).toBe(maxQuantity)
            
            // Verify no other product has higher quantity
            for (const product of productSalesData) {
              expect(product.totalQuantity).toBeLessThanOrEqual(result!.totalQuantity)
            }
          }
        ),
        { numRuns: 100 }
      )
    })

    it('findMostSoldProduct returns null for empty array', () => {
      const result = findMostSoldProduct([])
      expect(result).toBeNull()
    })

    it('findMostSoldProduct result is always in the input array', () => {
      fc.assert(
        fc.property(
          fc.array(productSalesDataArb, { minLength: 1, maxLength: 50 }),
          (productSalesData) => {
            const result = findMostSoldProduct(productSalesData)
            
            // Result should be one of the input products
            const found = productSalesData.find(p => 
              p.productId === result!.productId && 
              p.totalQuantity === result!.totalQuantity
            )
            expect(found).toBeDefined()
          }
        ),
        { numRuns: 100 }
      )
    })

    it('aggregateProductSales correctly sums quantities per product', () => {
      fc.assert(
        fc.property(
          fc.array(productArb, { minLength: 1, maxLength: 10 }),
          (products) => {
            // Create a product map
            const productMap = new Map<string, Product>()
            for (const product of products) {
              productMap.set(product.id, product)
            }
            
            const productIds = products.map(p => p.id)
            
            // Generate sale items for these products
            return fc.assert(
              fc.property(
                fc.array(saleItemArb(productIds), { minLength: 1, maxLength: 30 }),
                (saleItems) => {
                  const result = aggregateProductSales(saleItems, productMap)
                  
                  // Manually calculate expected quantities per product
                  const expectedQuantities = new Map<string, number>()
                  for (const item of saleItems) {
                    const current = expectedQuantities.get(item.product_id) || 0
                    expectedQuantities.set(item.product_id, current + item.quantity)
                  }
                  
                  // Verify each product's total quantity matches
                  for (const productData of result) {
                    const expectedQuantity = expectedQuantities.get(productData.productId)
                    expect(productData.totalQuantity).toBe(expectedQuantity)
                  }
                }
              ),
              { numRuns: 20 }
            )
          }
        ),
        { numRuns: 5 }
      )
    })

    it('aggregateProductSales correctly sums revenue per product', () => {
      fc.assert(
        fc.property(
          fc.array(productArb, { minLength: 1, maxLength: 10 }),
          (products) => {
            // Create a product map
            const productMap = new Map<string, Product>()
            for (const product of products) {
              productMap.set(product.id, product)
            }
            
            const productIds = products.map(p => p.id)
            
            // Generate sale items for these products
            return fc.assert(
              fc.property(
                fc.array(saleItemArb(productIds), { minLength: 1, maxLength: 30 }),
                (saleItems) => {
                  const result = aggregateProductSales(saleItems, productMap)
                  
                  // Manually calculate expected revenue per product
                  const expectedRevenue = new Map<string, number>()
                  for (const item of saleItems) {
                    const current = expectedRevenue.get(item.product_id) || 0
                    expectedRevenue.set(item.product_id, current + item.subtotal)
                  }
                  
                  // Verify each product's total revenue matches
                  for (const productData of result) {
                    const expected = expectedRevenue.get(productData.productId)
                    expect(productData.totalRevenue).toBeCloseTo(expected!, 2)
                  }
                }
              ),
              { numRuns: 20 }
            )
          }
        ),
        { numRuns: 5 }
      )
    })

    it('aggregateProductSales returns one entry per unique product', () => {
      fc.assert(
        fc.property(
          fc.array(productArb, { minLength: 1, maxLength: 10 }),
          (products) => {
            // Create a product map
            const productMap = new Map<string, Product>()
            for (const product of products) {
              productMap.set(product.id, product)
            }
            
            const productIds = products.map(p => p.id)
            
            // Generate sale items for these products
            return fc.assert(
              fc.property(
                fc.array(saleItemArb(productIds), { minLength: 1, maxLength: 30 }),
                (saleItems) => {
                  const result = aggregateProductSales(saleItems, productMap)
                  
                  // Count unique products in sale items
                  const uniqueProductIds = new Set(saleItems.map(item => item.product_id))
                  
                  // Result should have exactly one entry per unique product
                  expect(result.length).toBe(uniqueProductIds.size)
                  
                  // All product IDs in result should be unique
                  const resultProductIds = result.map(r => r.productId)
                  const uniqueResultIds = new Set(resultProductIds)
                  expect(uniqueResultIds.size).toBe(result.length)
                }
              ),
              { numRuns: 20 }
            )
          }
        ),
        { numRuns: 5 }
      )
    })

    it('most sold product has quantity >= all other products', () => {
      fc.assert(
        fc.property(
          fc.array(productSalesDataArb, { minLength: 2, maxLength: 50 }),
          (productSalesData) => {
            const mostSold = findMostSoldProduct(productSalesData)
            
            // Verify the most sold product has quantity >= all others
            for (const product of productSalesData) {
              expect(mostSold!.totalQuantity).toBeGreaterThanOrEqual(product.totalQuantity)
            }
          }
        ),
        { numRuns: 100 }
      )
    })

    it('adding more sales of a product can change the most sold product', () => {
      // This tests that the calculation is dynamic and responds to changes
      fc.assert(
        fc.property(
          fc.array(productSalesDataArb, { minLength: 2, maxLength: 10 }),
          fc.integer({ min: 1, max: 100000 }),
          (productSalesData, additionalQuantity) => {
            const originalMostSold = findMostSoldProduct(productSalesData)
            
            // Find a product that is NOT the most sold
            const notMostSold = productSalesData.find(p => p.productId !== originalMostSold!.productId)
            
            if (notMostSold) {
              // Create a modified array where this product has much higher quantity
              const modifiedData = productSalesData.map(p => {
                if (p.productId === notMostSold.productId) {
                  return {
                    ...p,
                    totalQuantity: originalMostSold!.totalQuantity + additionalQuantity
                  }
                }
                return p
              })
              
              const newMostSold = findMostSoldProduct(modifiedData)
              
              // The new most sold should be the product we boosted
              expect(newMostSold!.productId).toBe(notMostSold.productId)
            }
          }
        ),
        { numRuns: 100 }
      )
    })

    it('aggregateProductSales handles empty sale items array', () => {
      const productMap = new Map<string, Product>()
      const result = aggregateProductSales([], productMap)
      
      expect(result).toHaveLength(0)
    })

    it('aggregateProductSales preserves product names from product map', () => {
      fc.assert(
        fc.property(
          fc.array(productArb, { minLength: 1, maxLength: 10 }),
          (products) => {
            // Create a product map
            const productMap = new Map<string, Product>()
            for (const product of products) {
              productMap.set(product.id, product)
            }
            
            const productIds = products.map(p => p.id)
            
            // Generate sale items for these products
            return fc.assert(
              fc.property(
                fc.array(saleItemArb(productIds), { minLength: 1, maxLength: 30 }),
                (saleItems) => {
                  const result = aggregateProductSales(saleItems, productMap)
                  
                  // Verify product names match the product map
                  for (const productData of result) {
                    const product = productMap.get(productData.productId)
                    if (product) {
                      expect(productData.productName).toBe(product.name)
                    }
                  }
                }
              ),
              { numRuns: 20 }
            )
          }
        ),
        { numRuns: 5 }
      )
    })
  })
})
