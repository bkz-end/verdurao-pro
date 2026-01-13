import { SupabaseClient } from '@supabase/supabase-js'
import { Product, ProductUnit } from '@/types'

/**
 * Input data for product creation
 * Requirements: 6.1
 */
export interface ProductInput {
  sku: string
  name: string
  price: number
  cost_price?: number | null
  unit: ProductUnit
  default_quantity?: number
  stock?: number
  category?: string | null
}

/**
 * Input data for product update
 * Requirements: 6.2
 */
export interface ProductUpdateInput {
  sku?: string
  name?: string
  price?: number
  cost_price?: number | null
  unit?: ProductUnit
  default_quantity?: number
  stock?: number
  category?: string | null
  is_active?: boolean
}

/**
 * Filters for product queries
 * Requirements: 4.2, 6.3, 6.5
 */
export interface ProductFilters {
  query?: string
  category?: string
  outOfStock?: boolean
  isActive?: boolean
}

/**
 * Validation error for product operations
 */
export interface ProductValidationError {
  field: string
  message: string
}


/**
 * Result of product operations
 */
export type ProductResult =
  | { success: true; product: Product }
  | { success: false; errors: ProductValidationError[] }

/**
 * Result of CSV import
 * Requirements: 6.4
 */
export interface ImportResult {
  success: boolean
  imported: number
  failed: number
  errors: { row: number; message: string }[]
}

/**
 * Required fields for product creation
 * Requirements: 6.1
 */
const REQUIRED_PRODUCT_FIELDS: (keyof ProductInput)[] = ['sku', 'name', 'price', 'unit']

/**
 * Valid product units
 */
const VALID_UNITS: ProductUnit[] = ['un', 'kg', 'g', 'l', 'ml']

/**
 * Validates product input
 * Requirements: 6.1
 */
export function validateProductInput(input: Partial<ProductInput>): ProductValidationError[] {
  const errors: ProductValidationError[] = []

  for (const field of REQUIRED_PRODUCT_FIELDS) {
    const value = input[field]
    if (value === undefined || value === null || (typeof value === 'string' && value.trim() === '')) {
      errors.push({
        field,
        message: `Campo obrigatório: ${field}`
      })
    }
  }

  // Validate SKU format (non-empty string)
  if (input.sku && typeof input.sku === 'string' && input.sku.trim() === '') {
    errors.push({
      field: 'sku',
      message: 'SKU não pode ser vazio'
    })
  }

  // Validate price is positive
  if (input.price !== undefined && input.price <= 0) {
    errors.push({
      field: 'price',
      message: 'Preço deve ser maior que zero'
    })
  }

  // Validate cost_price if provided
  if (input.cost_price !== undefined && input.cost_price !== null && input.cost_price < 0) {
    errors.push({
      field: 'cost_price',
      message: 'Preço de custo não pode ser negativo'
    })
  }

  // Validate unit
  if (input.unit && !VALID_UNITS.includes(input.unit)) {
    errors.push({
      field: 'unit',
      message: `Unidade inválida. Use: ${VALID_UNITS.join(', ')}`
    })
  }

  // Validate stock is non-negative
  if (input.stock !== undefined && input.stock < 0) {
    errors.push({
      field: 'stock',
      message: 'Estoque não pode ser negativo'
    })
  }

  // Validate default_quantity is positive
  if (input.default_quantity !== undefined && input.default_quantity <= 0) {
    errors.push({
      field: 'default_quantity',
      message: 'Quantidade padrão deve ser maior que zero'
    })
  }

  return errors
}

/**
 * Computes default quantity based on unit type
 * Requirements: 4.3
 * 
 * - Returns 1 for 'un' (units)
 * - Returns 0.5 for weight/volume units (kg, g, l, ml)
 */
export function computeDefaultQuantity(unit: ProductUnit): number {
  return unit === 'un' ? 1 : 0.5
}

/**
 * Data structure for product insert operation
 * Requirements: 6.1
 */
export interface ProductInsertData {
  tenant_id: string
  sku: string
  name: string
  price: number
  cost_price: number | null
  unit: ProductUnit
  default_quantity: number
  stock: number
  category: string | null
}

/**
 * Prepares product data for database insert
 * Requirements: 6.1
 * 
 * This pure function extracts the logic of mapping ProductInput to database insert data,
 * making it testable without database dependencies.
 */
export function prepareProductInsertData(input: ProductInput, tenantId: string): ProductInsertData {
  const defaultQuantity = input.default_quantity ?? computeDefaultQuantity(input.unit)
  const initialStock = input.stock ?? 0

  return {
    tenant_id: tenantId,
    sku: input.sku.trim(),
    name: input.name.trim(),
    price: input.price,
    cost_price: input.cost_price ?? null,
    unit: input.unit,
    default_quantity: defaultQuantity,
    stock: initialStock,
    category: input.category?.trim() ?? null
  }
}

/**
 * Filters products by search query (case-insensitive)
 * Requirements: 4.2, 6.5
 * 
 * Matches against name, SKU, or category
 */
export function filterProductsByQuery(products: Product[], query: string): Product[] {
  if (!query || query.trim() === '') {
    return products
  }

  const normalizedQuery = query.toLowerCase().trim()

  return products.filter(product => {
    const nameMatch = product.name.toLowerCase().includes(normalizedQuery)
    const skuMatch = product.sku.toLowerCase().includes(normalizedQuery)
    const categoryMatch = product.category?.toLowerCase().includes(normalizedQuery) ?? false

    return nameMatch || skuMatch || categoryMatch
  })
}

/**
 * Filters products that are out of stock
 * Requirements: 6.3
 */
export function filterOutOfStock(products: Product[]): Product[] {
  return products.filter(product => product.stock === 0)
}

/**
 * Data structure for stock history entry
 * Requirements: 6.2
 */
export interface StockHistoryEntry {
  product_id: string
  quantity_change: number
  reason: string
  reference_id: string | null
}

/**
 * Determines if a stock history entry should be created for a product update
 * Requirements: 6.2
 * 
 * Returns the stock history entry data if stock changed, null otherwise.
 * This pure function extracts the logic for determining when history should be recorded.
 */
export function prepareStockHistoryForUpdate(
  productId: string,
  currentStock: number,
  newStock: number | undefined,
  referenceId: string | null = null
): StockHistoryEntry | null {
  // Only create history if stock is being changed
  if (newStock === undefined || newStock === currentStock) {
    return null
  }

  const quantityChange = newStock - currentStock

  return {
    product_id: productId,
    quantity_change: quantityChange,
    reason: 'adjustment',
    reference_id: referenceId
  }
}

/**
 * Parses a CSV line handling quoted values
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]

    if (char === '"') {
      inQuotes = !inQuotes
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }

  result.push(current.trim())
  return result
}


/**
 * ProductService - Manages product CRUD and queries
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 4.2, 9.2
 * 
 * Note: This service enforces NO artificial limits on the number of products.
 * Per Requirement 9.2, tenants can create unlimited products.
 */
export class ProductService {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Creates a new product
   * Requirements: 6.1
   */
  async createProduct(input: ProductInput, tenantId: string): Promise<ProductResult> {
    const validationErrors = validateProductInput(input)
    if (validationErrors.length > 0) {
      return { success: false, errors: validationErrors }
    }

    const { data: existingProduct } = await this.supabase
      .from('products')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('sku', input.sku.trim())
      .single()

    if (existingProduct) {
      return {
        success: false,
        errors: [{ field: 'sku', message: `SKU já existe: ${input.sku}` }]
      }
    }

    // Use the pure function to prepare insert data
    const insertData = prepareProductInsertData(input, tenantId)

    const { data: product, error } = await this.supabase
      .from('products')
      .insert(insertData)
      .select()
      .single()

    if (error) {
      return {
        success: false,
        errors: [{ field: 'general', message: error.message }]
      }
    }

    if (insertData.stock > 0) {
      await this.recordStockHistory(product.id, insertData.stock, 'entry', null)
    }

    return { success: true, product: product as Product }
  }

  /**
   * Updates an existing product
   * Requirements: 6.2
   */
  async updateProduct(productId: string, input: ProductUpdateInput, tenantId: string): Promise<ProductResult> {
    const currentProduct = await this.getProductById(productId, tenantId)
    if (!currentProduct) {
      return {
        success: false,
        errors: [{ field: 'id', message: 'Produto não encontrado' }]
      }
    }

    if (input.sku && input.sku.trim() !== currentProduct.sku) {
      const { data: existingProduct } = await this.supabase
        .from('products')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('sku', input.sku.trim())
        .neq('id', productId)
        .single()

      if (existingProduct) {
        return {
          success: false,
          errors: [{ field: 'sku', message: `SKU já existe: ${input.sku}` }]
        }
      }
    }

    if (input.price !== undefined && input.price <= 0) {
      return {
        success: false,
        errors: [{ field: 'price', message: 'Preço deve ser maior que zero' }]
      }
    }

    if (input.stock !== undefined && input.stock < 0) {
      return {
        success: false,
        errors: [{ field: 'stock', message: 'Estoque não pode ser negativo' }]
      }
    }

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString()
    }

    if (input.sku !== undefined) updateData.sku = input.sku.trim()
    if (input.name !== undefined) updateData.name = input.name.trim()
    if (input.price !== undefined) updateData.price = input.price
    if (input.cost_price !== undefined) updateData.cost_price = input.cost_price
    if (input.unit !== undefined) updateData.unit = input.unit
    if (input.default_quantity !== undefined) updateData.default_quantity = input.default_quantity
    if (input.stock !== undefined) updateData.stock = input.stock
    if (input.category !== undefined) updateData.category = input.category?.trim() ?? null
    if (input.is_active !== undefined) updateData.is_active = input.is_active

    const { data: product, error } = await this.supabase
      .from('products')
      .update(updateData)
      .eq('id', productId)
      .eq('tenant_id', tenantId)
      .select()
      .single()

    if (error) {
      return {
        success: false,
        errors: [{ field: 'general', message: error.message }]
      }
    }

    if (input.stock !== undefined && input.stock !== currentProduct.stock) {
      const stockChange = input.stock - currentProduct.stock
      await this.recordStockHistory(productId, stockChange, 'adjustment', null)
    }

    return { success: true, product: product as Product }
  }

  /**
   * Deletes a product (soft delete)
   * Requirements: 6.2
   */
  async deleteProduct(productId: string, tenantId: string): Promise<{ success: boolean; error?: string }> {
    const product = await this.getProductById(productId, tenantId)
    if (!product) {
      return { success: false, error: 'Produto não encontrado' }
    }

    const { error } = await this.supabase
      .from('products')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', productId)
      .eq('tenant_id', tenantId)

    if (error) {
      return { success: false, error: error.message }
    }

    return { success: true }
  }

  /**
   * Gets a product by ID
   */
  async getProductById(productId: string, tenantId: string): Promise<Product | null> {
    const { data, error } = await this.supabase
      .from('products')
      .select('*')
      .eq('id', productId)
      .eq('tenant_id', tenantId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return null
      }
      throw new Error(`Failed to fetch product: ${error.message}`)
    }

    return data as Product
  }

  /**
   * Records a stock history entry
   * Requirements: 6.2
   */
  private async recordStockHistory(
    productId: string,
    quantityChange: number,
    reason: string,
    referenceId: string | null
  ): Promise<void> {
    await this.supabase
      .from('stock_history')
      .insert({
        product_id: productId,
        quantity_change: quantityChange,
        reason,
        reference_id: referenceId
      })
  }


  /**
   * Gets products with optional filters
   * Requirements: 4.2, 6.5
   */
  async getProducts(tenantId: string, filters?: ProductFilters): Promise<Product[]> {
    let query = this.supabase
      .from('products')
      .select('*')
      .eq('tenant_id', tenantId)

    if (filters?.isActive !== undefined) {
      query = query.eq('is_active', filters.isActive)
    } else {
      query = query.eq('is_active', true)
    }

    if (filters?.category) {
      query = query.eq('category', filters.category)
    }

    if (filters?.outOfStock) {
      query = query.eq('stock', 0)
    }

    const { data, error } = await query.order('name', { ascending: true })

    if (error) {
      throw new Error(`Failed to fetch products: ${error.message}`)
    }

    let products = (data || []) as Product[]

    if (filters?.query) {
      products = filterProductsByQuery(products, filters.query)
    }

    return products
  }

  /**
   * Searches products by query string
   * Requirements: 4.2, 6.5
   */
  async searchProducts(query: string, tenantId: string): Promise<Product[]> {
    return this.getProducts(tenantId, { query, isActive: true })
  }

  /**
   * Gets products that are out of stock
   * Requirements: 6.3
   */
  async getOutOfStockProducts(tenantId: string): Promise<Product[]> {
    return this.getProducts(tenantId, { outOfStock: true, isActive: true })
  }

  /**
   * Imports products from CSV data
   * Requirements: 6.4
   */
  async importFromCSV(csvData: string, tenantId: string): Promise<ImportResult> {
    const lines = csvData.trim().split('\n')
    if (lines.length < 2) {
      return {
        success: false,
        imported: 0,
        failed: 0,
        errors: [{ row: 0, message: 'CSV deve ter cabeçalho e pelo menos uma linha de dados' }]
      }
    }

    const header = lines[0].split(',').map(h => h.trim().toLowerCase())
    const requiredColumns = ['sku', 'name', 'price', 'unit']
    const missingColumns = requiredColumns.filter(col => !header.includes(col))

    if (missingColumns.length > 0) {
      return {
        success: false,
        imported: 0,
        failed: 0,
        errors: [{ row: 0, message: `Colunas obrigatórias faltando: ${missingColumns.join(', ')}` }]
      }
    }

    const results: ImportResult = {
      success: true,
      imported: 0,
      failed: 0,
      errors: []
    }

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim()
      if (!line) continue

      const values = parseCSVLine(line)
      const rowData: Record<string, string> = {}

      header.forEach((col, idx) => {
        rowData[col] = values[idx] || ''
      })

      try {
        const productInput: ProductInput = {
          sku: rowData.sku,
          name: rowData.name,
          price: parseFloat(rowData.price),
          unit: rowData.unit as ProductUnit,
          cost_price: rowData.cost_price ? parseFloat(rowData.cost_price) : null,
          stock: rowData.stock ? parseFloat(rowData.stock) : 0,
          category: rowData.category || null
        }

        const result = await this.createProduct(productInput, tenantId)

        if (result.success) {
          results.imported++
        } else {
          results.failed++
          results.errors.push({
            row: i + 1,
            message: result.errors.map(e => e.message).join('; ')
          })
        }
      } catch (err) {
        results.failed++
        results.errors.push({
          row: i + 1,
          message: err instanceof Error ? err.message : 'Erro desconhecido'
        })
      }
    }

    results.success = results.failed === 0

    return results
  }

  /**
   * Updates product stock
   * Requirements: 6.2
   */
  async updateStock(
    productId: string,
    tenantId: string,
    quantityChange: number,
    reason: string,
    referenceId?: string
  ): Promise<Product | null> {
    const product = await this.getProductById(productId, tenantId)
    if (!product) {
      return null
    }

    const newStock = product.stock + quantityChange
    if (newStock < 0) {
      throw new Error('Estoque insuficiente')
    }

    const { data, error } = await this.supabase
      .from('products')
      .update({
        stock: newStock,
        updated_at: new Date().toISOString()
      })
      .eq('id', productId)
      .eq('tenant_id', tenantId)
      .select()
      .single()

    if (error) {
      throw new Error(`Failed to update stock: ${error.message}`)
    }

    await this.recordStockHistory(productId, quantityChange, reason, referenceId ?? null)

    return data as Product
  }
}
