import { SupabaseClient } from '@supabase/supabase-js'
import { Product, Sale, SaleItem, ProductUnit } from '@/types'

/**
 * Cart item representing a product in the shopping cart
 * Requirements: 4.3, 4.4
 */
export interface CartItem {
  id: string
  product: Product
  quantity: number
  unitPrice: number
  subtotal: number
}

/**
 * Shopping cart for PDV operations
 * Requirements: 4.3, 4.4
 */
export interface Cart {
  id: string
  items: CartItem[]
  total: number
  createdAt: Date
}

/**
 * Result of sale finalization
 * Requirements: 4.5
 */
export interface SaleResult {
  success: boolean
  sale?: Sale
  saleItems?: SaleItem[]
  error?: string
}

/**
 * Generates a unique ID for cart and cart items
 */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`
}

/**
 * Computes default quantity based on product unit type
 * Requirements: 4.3
 * 
 * Property 7: Default Quantity Based on Unit Type
 * - Returns 1 when unit is "un"
 * - Returns 0.5 when unit is "kg", "g", "l", or "ml"
 */
export function getDefaultQuantityForUnit(unit: ProductUnit): number {
  return unit === 'un' ? 1 : 0.5
}

/**
 * Calculates subtotal for a cart item
 * Requirements: 4.4
 */
export function calculateSubtotal(quantity: number, unitPrice: number): number {
  return Math.round(quantity * unitPrice * 100) / 100
}

/**
 * Calculates total for all cart items
 * Requirements: 4.4
 * 
 * Property 8: Cart Total Calculation
 * The cart total SHALL equal the sum of all item subtotals
 */
export function calculateCartTotal(items: CartItem[]): number {
  const total = items.reduce((sum, item) => sum + item.subtotal, 0)
  return Math.round(total * 100) / 100
}

/**
 * Creates a new empty cart
 * Requirements: 4.3
 */
export function createCart(): Cart {
  return {
    id: generateId(),
    items: [],
    total: 0,
    createdAt: new Date()
  }
}


/**
 * Adds a product to the cart with default or specified quantity
 * Requirements: 4.3, 4.4
 * 
 * If quantity is not provided, uses default based on unit type:
 * - 1 for 'un' (units)
 * - 0.5 for weight/volume units (kg, g, l, ml)
 */
export function addToCart(cart: Cart, product: Product, quantity?: number): Cart {
  const actualQuantity = quantity ?? getDefaultQuantityForUnit(product.unit)
  const unitPrice = product.price
  const subtotal = calculateSubtotal(actualQuantity, unitPrice)

  // Check if product already exists in cart
  const existingItemIndex = cart.items.findIndex(item => item.product.id === product.id)

  let newItems: CartItem[]

  if (existingItemIndex >= 0) {
    // Update existing item quantity
    newItems = cart.items.map((item, index) => {
      if (index === existingItemIndex) {
        const newQuantity = item.quantity + actualQuantity
        const newSubtotal = calculateSubtotal(newQuantity, item.unitPrice)
        return {
          ...item,
          quantity: newQuantity,
          subtotal: newSubtotal
        }
      }
      return item
    })
  } else {
    // Add new item
    const newItem: CartItem = {
      id: generateId(),
      product,
      quantity: actualQuantity,
      unitPrice,
      subtotal
    }
    newItems = [...cart.items, newItem]
  }

  return {
    ...cart,
    items: newItems,
    total: calculateCartTotal(newItems)
  }
}

/**
 * Updates the quantity of a cart item
 * Requirements: 4.4
 */
export function updateCartItem(cart: Cart, itemId: string, quantity: number): Cart {
  if (quantity <= 0) {
    return removeFromCart(cart, itemId)
  }

  const newItems = cart.items.map(item => {
    if (item.id === itemId) {
      const newSubtotal = calculateSubtotal(quantity, item.unitPrice)
      return {
        ...item,
        quantity,
        subtotal: newSubtotal
      }
    }
    return item
  })

  return {
    ...cart,
    items: newItems,
    total: calculateCartTotal(newItems)
  }
}

/**
 * Removes an item from the cart
 * Requirements: 4.4
 */
export function removeFromCart(cart: Cart, itemId: string): Cart {
  const newItems = cart.items.filter(item => item.id !== itemId)

  return {
    ...cart,
    items: newItems,
    total: calculateCartTotal(newItems)
  }
}

/**
 * Clears all items from the cart
 * Requirements: 4.5
 */
export function clearCart(cart: Cart): Cart {
  return {
    ...cart,
    items: [],
    total: 0
  }
}

/**
 * PDVService - Manages Point of Sale operations
 * Requirements: 4.3, 4.4, 4.5
 */
export class PDVService {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Creates a new cart
   * Requirements: 4.3
   */
  createCart(): Cart {
    return createCart()
  }

  /**
   * Adds a product to the cart
   * Requirements: 4.3, 4.4
   */
  addToCart(cart: Cart, product: Product, quantity?: number): Cart {
    return addToCart(cart, product, quantity)
  }

  /**
   * Updates a cart item quantity
   * Requirements: 4.4
   */
  updateCartItem(cart: Cart, itemId: string, quantity: number): Cart {
    return updateCartItem(cart, itemId, quantity)
  }

  /**
   * Removes an item from the cart
   * Requirements: 4.4
   */
  removeFromCart(cart: Cart, itemId: string): Cart {
    return removeFromCart(cart, itemId)
  }

  /**
   * Clears the cart
   * Requirements: 4.5
   */
  clearCart(cart: Cart): Cart {
    return clearCart(cart)
  }

  /**
   * Finalizes a sale from the cart
   * Requirements: 4.5
   * 
   * Property 9: Sale Finalization Round-Trip
   * - Creates sale record with all cart items
   * - Deducts stock from products
   * - Returns empty cart after finalization
   */
  async finalizeSale(cart: Cart, tenantId: string, userId: string): Promise<SaleResult> {
    if (cart.items.length === 0) {
      return {
        success: false,
        error: 'Carrinho vazio'
      }
    }

    // Start a transaction by inserting the sale first
    const { data: sale, error: saleError } = await this.supabase
      .from('sales')
      .insert({
        tenant_id: tenantId,
        user_id: userId,
        total: cart.total,
        local_id: cart.id
      })
      .select()
      .single()

    if (saleError) {
      return {
        success: false,
        error: `Erro ao criar venda: ${saleError.message}`
      }
    }

    // Insert sale items
    const saleItemsData = cart.items.map(item => ({
      sale_id: sale.id,
      product_id: item.product.id,
      quantity: item.quantity,
      unit_price: item.unitPrice,
      subtotal: item.subtotal
    }))

    const { data: saleItems, error: itemsError } = await this.supabase
      .from('sale_items')
      .insert(saleItemsData)
      .select()

    if (itemsError) {
      // Rollback: delete the sale if items insertion fails
      await this.supabase.from('sales').delete().eq('id', sale.id)
      return {
        success: false,
        error: `Erro ao criar itens da venda: ${itemsError.message}`
      }
    }

    // Deduct stock for each product
    for (const item of cart.items) {
      const { error: stockError } = await this.supabase.rpc('deduct_product_stock', {
        p_product_id: item.product.id,
        p_quantity: item.quantity,
        p_sale_id: sale.id
      })

      // If RPC doesn't exist, fall back to manual update
      if (stockError && stockError.code === '42883') {
        // Function doesn't exist, do manual update
        await this.deductStockManually(item.product.id, item.quantity, sale.id, tenantId)
      } else if (stockError) {
        console.error(`Failed to deduct stock for product ${item.product.id}:`, stockError)
      }
    }

    return {
      success: true,
      sale: sale as Sale,
      saleItems: saleItems as SaleItem[]
    }
  }

  /**
   * Manually deducts stock when RPC is not available
   * Requirements: 4.5
   */
  private async deductStockManually(
    productId: string,
    quantity: number,
    saleId: string,
    tenantId: string
  ): Promise<void> {
    // Get current stock
    const { data: product } = await this.supabase
      .from('products')
      .select('stock')
      .eq('id', productId)
      .eq('tenant_id', tenantId)
      .single()

    if (!product) return

    const newStock = Math.max(0, product.stock - quantity)

    // Update stock
    await this.supabase
      .from('products')
      .update({ stock: newStock, updated_at: new Date().toISOString() })
      .eq('id', productId)
      .eq('tenant_id', tenantId)

    // Record stock history
    await this.supabase
      .from('stock_history')
      .insert({
        product_id: productId,
        quantity_change: -quantity,
        reason: 'sale',
        reference_id: saleId
      })
  }
}
