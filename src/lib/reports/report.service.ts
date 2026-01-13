import { SupabaseClient } from '@supabase/supabase-js'
import { Product, Sale, SaleItem } from '@/types'

/**
 * Period type for report filtering
 * Requirements: 11.1, 11.3
 */
export type ReportPeriod = 'day' | 'week' | 'month' | 'custom'

/**
 * Date range for custom period filtering
 */
export interface DateRange {
  startDate: Date
  endDate: Date
}

/**
 * Sales report data
 * Requirements: 11.1, 11.3
 */
export interface SalesReport {
  period: ReportPeriod
  startDate: Date
  endDate: Date
  totalSales: number
  totalRevenue: number
  averageTicket: number
}

/**
 * Product sales data for most sold calculation
 * Requirements: 11.2
 */
export interface ProductSalesData {
  productId: string
  productName: string
  totalQuantity: number
  totalRevenue: number
}

/**
 * Most sold product result
 * Requirements: 11.2
 */
export interface MostSoldProduct {
  product: Product
  totalQuantity: number
  totalRevenue: number
}

/**
 * Profit margin data per product
 * Requirements: 11.4
 */
export interface ProductProfitMargin {
  productId: string
  productName: string
  price: number
  costPrice: number
  profitMargin: number // percentage
  absoluteProfit: number
}


/**
 * Calculates the date range for a given period
 * Requirements: 11.1, 11.3
 * 
 * Property 21: Sales Report Aggregation
 * The date range calculation ensures correct period boundaries
 */
export function calculateDateRange(period: ReportPeriod, referenceDate: Date = new Date()): DateRange {
  const endDate = new Date(referenceDate)
  endDate.setHours(23, 59, 59, 999)

  const startDate = new Date(referenceDate)
  startDate.setHours(0, 0, 0, 0)

  switch (period) {
    case 'day':
      // Same day
      break
    case 'week':
      // Start of week (Sunday)
      const dayOfWeek = startDate.getDay()
      startDate.setDate(startDate.getDate() - dayOfWeek)
      break
    case 'month':
      // Start of month
      startDate.setDate(1)
      break
    case 'custom':
      // For custom, caller should provide their own range
      break
  }

  return { startDate, endDate }
}

/**
 * Aggregates sales totals from a list of sales
 * Requirements: 11.1, 11.3
 * 
 * Property 21: Sales Report Aggregation
 * For any tenant and date range, the sales report totals SHALL equal
 * the sum of all sale totals within that date range.
 */
export function aggregateSalesTotals(sales: Sale[]): { totalSales: number; totalRevenue: number; averageTicket: number } {
  const totalSales = sales.length
  const totalRevenue = sales.reduce((sum, sale) => sum + sale.total, 0)
  const averageTicket = totalSales > 0 ? totalRevenue / totalSales : 0

  return {
    totalSales,
    totalRevenue: Math.round(totalRevenue * 100) / 100,
    averageTicket: Math.round(averageTicket * 100) / 100
  }
}

/**
 * Calculates profit margin percentage
 * Requirements: 11.4
 * 
 * Property 23: Profit Margin Calculation
 * For any product with both price and cost_price defined,
 * the profit margin SHALL equal (price - cost_price) / price * 100
 */
export function calculateProfitMargin(price: number, costPrice: number): number {
  if (price <= 0) return 0
  const margin = ((price - costPrice) / price) * 100
  return Math.round(margin * 100) / 100
}

/**
 * Calculates absolute profit
 * Requirements: 11.4
 */
export function calculateAbsoluteProfit(price: number, costPrice: number): number {
  return Math.round((price - costPrice) * 100) / 100
}


/**
 * Aggregates product sales data from sale items
 * Requirements: 11.2
 * 
 * Property 22: Most Sold Product Calculation
 * Groups sale items by product and calculates total quantities
 */
export function aggregateProductSales(
  saleItems: (SaleItem & { product_name?: string })[],
  productMap: Map<string, Product>
): ProductSalesData[] {
  const productSalesMap = new Map<string, ProductSalesData>()

  for (const item of saleItems) {
    const existing = productSalesMap.get(item.product_id)
    const product = productMap.get(item.product_id)
    const productName = product?.name || item.product_name || 'Unknown'

    if (existing) {
      existing.totalQuantity += item.quantity
      existing.totalRevenue += item.subtotal
    } else {
      productSalesMap.set(item.product_id, {
        productId: item.product_id,
        productName,
        totalQuantity: item.quantity,
        totalRevenue: item.subtotal
      })
    }
  }

  return Array.from(productSalesMap.values())
}

/**
 * Finds the most sold product from aggregated sales data
 * Requirements: 11.2
 * 
 * Property 22: Most Sold Product Calculation
 * For any tenant and date range, the most sold product SHALL be
 * the product with the highest total quantity sold across all sales in that period.
 */
export function findMostSoldProduct(productSalesData: ProductSalesData[]): ProductSalesData | null {
  if (productSalesData.length === 0) return null

  return productSalesData.reduce((max, current) => 
    current.totalQuantity > max.totalQuantity ? current : max
  )
}

/**
 * Calculates profit margins for products with cost price
 * Requirements: 11.4
 * 
 * Property 23: Profit Margin Calculation
 */
export function calculateProductProfitMargins(products: Product[]): ProductProfitMargin[] {
  return products
    .filter(p => p.cost_price !== null && p.cost_price !== undefined)
    .map(product => ({
      productId: product.id,
      productName: product.name,
      price: product.price,
      costPrice: product.cost_price!,
      profitMargin: calculateProfitMargin(product.price, product.cost_price!),
      absoluteProfit: calculateAbsoluteProfit(product.price, product.cost_price!)
    }))
}


/**
 * ReportService - Manages store reports and analytics
 * Requirements: 11.1, 11.2, 11.3, 11.4
 */
export class ReportService {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Gets sales report for a given period
   * Requirements: 11.1, 11.3
   * 
   * Property 21: Sales Report Aggregation
   */
  async getSalesReport(
    tenantId: string,
    period: ReportPeriod,
    customRange?: DateRange
  ): Promise<SalesReport> {
    const dateRange = period === 'custom' && customRange
      ? customRange
      : calculateDateRange(period)

    const { data: sales, error } = await this.supabase
      .from('sales')
      .select('*')
      .eq('tenant_id', tenantId)
      .gte('created_at', dateRange.startDate.toISOString())
      .lte('created_at', dateRange.endDate.toISOString())

    if (error) {
      throw new Error(`Failed to fetch sales: ${error.message}`)
    }

    const aggregated = aggregateSalesTotals((sales || []) as Sale[])

    return {
      period,
      startDate: dateRange.startDate,
      endDate: dateRange.endDate,
      ...aggregated
    }
  }

  /**
   * Gets the most sold product for a given period
   * Requirements: 11.2
   * 
   * Property 22: Most Sold Product Calculation
   */
  async getMostSoldProduct(
    tenantId: string,
    period: ReportPeriod,
    customRange?: DateRange
  ): Promise<MostSoldProduct | null> {
    const dateRange = period === 'custom' && customRange
      ? customRange
      : calculateDateRange(period)

    // Get sales in the period
    const { data: sales, error: salesError } = await this.supabase
      .from('sales')
      .select('id')
      .eq('tenant_id', tenantId)
      .gte('created_at', dateRange.startDate.toISOString())
      .lte('created_at', dateRange.endDate.toISOString())

    if (salesError) {
      throw new Error(`Failed to fetch sales: ${salesError.message}`)
    }

    if (!sales || sales.length === 0) {
      return null
    }

    const saleIds = sales.map(s => s.id)

    // Get sale items for these sales
    const { data: saleItems, error: itemsError } = await this.supabase
      .from('sale_items')
      .select('*')
      .in('sale_id', saleIds)

    if (itemsError) {
      throw new Error(`Failed to fetch sale items: ${itemsError.message}`)
    }

    if (!saleItems || saleItems.length === 0) {
      return null
    }

    // Get products for mapping
    const productIds = [...new Set(saleItems.map(item => item.product_id))]
    const { data: products, error: productsError } = await this.supabase
      .from('products')
      .select('*')
      .in('id', productIds)

    if (productsError) {
      throw new Error(`Failed to fetch products: ${productsError.message}`)
    }

    const productMap = new Map<string, Product>()
    for (const product of (products || [])) {
      productMap.set(product.id, product as Product)
    }

    const aggregatedSales = aggregateProductSales(saleItems as SaleItem[], productMap)
    const mostSold = findMostSoldProduct(aggregatedSales)

    if (!mostSold) {
      return null
    }

    const product = productMap.get(mostSold.productId)
    if (!product) {
      return null
    }

    return {
      product,
      totalQuantity: mostSold.totalQuantity,
      totalRevenue: mostSold.totalRevenue
    }
  }


  /**
   * Gets profit margins for all products with cost price
   * Requirements: 11.4
   * 
   * Property 23: Profit Margin Calculation
   */
  async getProductProfitMargins(tenantId: string): Promise<ProductProfitMargin[]> {
    const { data: products, error } = await this.supabase
      .from('products')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .not('cost_price', 'is', null)

    if (error) {
      throw new Error(`Failed to fetch products: ${error.message}`)
    }

    return calculateProductProfitMargins((products || []) as Product[])
  }

  /**
   * Gets products that are out of stock
   * Requirements: 11.2 (produtos em falta)
   */
  async getOutOfStockProducts(tenantId: string): Promise<Product[]> {
    const { data: products, error } = await this.supabase
      .from('products')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .eq('stock', 0)

    if (error) {
      throw new Error(`Failed to fetch out of stock products: ${error.message}`)
    }

    return (products || []) as Product[]
  }

  /**
   * Gets top selling products for a period
   * Requirements: 11.2
   */
  async getTopSellingProducts(
    tenantId: string,
    period: ReportPeriod,
    limit: number = 10,
    customRange?: DateRange
  ): Promise<ProductSalesData[]> {
    const dateRange = period === 'custom' && customRange
      ? customRange
      : calculateDateRange(period)

    // Get sales in the period
    const { data: sales, error: salesError } = await this.supabase
      .from('sales')
      .select('id')
      .eq('tenant_id', tenantId)
      .gte('created_at', dateRange.startDate.toISOString())
      .lte('created_at', dateRange.endDate.toISOString())

    if (salesError) {
      throw new Error(`Failed to fetch sales: ${salesError.message}`)
    }

    if (!sales || sales.length === 0) {
      return []
    }

    const saleIds = sales.map(s => s.id)

    // Get sale items for these sales
    const { data: saleItems, error: itemsError } = await this.supabase
      .from('sale_items')
      .select('*')
      .in('sale_id', saleIds)

    if (itemsError) {
      throw new Error(`Failed to fetch sale items: ${itemsError.message}`)
    }

    if (!saleItems || saleItems.length === 0) {
      return []
    }

    // Get products for mapping
    const productIds = [...new Set(saleItems.map(item => item.product_id))]
    const { data: products, error: productsError } = await this.supabase
      .from('products')
      .select('*')
      .in('id', productIds)

    if (productsError) {
      throw new Error(`Failed to fetch products: ${productsError.message}`)
    }

    const productMap = new Map<string, Product>()
    for (const product of (products || [])) {
      productMap.set(product.id, product as Product)
    }

    const aggregatedSales = aggregateProductSales(saleItems as SaleItem[], productMap)

    // Sort by quantity and limit
    return aggregatedSales
      .sort((a, b) => b.totalQuantity - a.totalQuantity)
      .slice(0, limit)
  }

  /**
   * Gets a comprehensive dashboard report
   * Requirements: 11.1, 11.2, 11.3
   */
  async getDashboardReport(tenantId: string): Promise<{
    today: SalesReport
    week: SalesReport
    month: SalesReport
    mostSoldToday: MostSoldProduct | null
    outOfStock: Product[]
  }> {
    const [today, week, month, mostSoldToday, outOfStock] = await Promise.all([
      this.getSalesReport(tenantId, 'day'),
      this.getSalesReport(tenantId, 'week'),
      this.getSalesReport(tenantId, 'month'),
      this.getMostSoldProduct(tenantId, 'day'),
      this.getOutOfStockProducts(tenantId)
    ])

    return {
      today,
      week,
      month,
      mostSoldToday,
      outOfStock
    }
  }
}
