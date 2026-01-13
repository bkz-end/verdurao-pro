'use client'

import { useState, useCallback, useEffect } from 'react'
import { Product } from '@/types'
import { Cart, createCart, addToCart, updateCartItem, removeFromCart, clearCart } from '@/lib/pdv/pdv.service'
import { SearchBar } from '@/components/pdv/SearchBar'
import { ProductPillGrid } from '@/components/pdv/ProductPill'
import { FloatingCart } from '@/components/pdv/FloatingCart'
import { PDVHeader } from '@/components/pdv/PDVHeader'
import { QuantityModal } from '@/components/pdv/QuantityModal'
import { useFeedback } from '@/hooks/useFeedback'

/**
 * PDV Page - Point of Sale mobile-first interface
 * Requirements: 4.1, 4.5, 12.5
 * 
 * Features:
 * - Header with store name and profile
 * - Always-visible search bar with auto-focus
 * - Product suggestions grid
 * - Floating cart at bottom
 * - 3-touch flow: select → quantity → finalize
 */

// Mock data for development - will be replaced with real data from Supabase
const MOCK_PRODUCTS: Product[] = [
  {
    id: '1',
    tenant_id: 'tenant-1',
    sku: 'BAN001',
    name: 'Banana Prata',
    price: 5.99,
    cost_price: 3.50,
    unit: 'kg',
    default_quantity: 0.5,
    stock: 50,
    category: 'Frutas',
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: '2',
    tenant_id: 'tenant-1',
    sku: 'MAC001',
    name: 'Maçã Fuji',
    price: 8.99,
    cost_price: 5.00,
    unit: 'kg',
    default_quantity: 0.5,
    stock: 30,
    category: 'Frutas',
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: '3',
    tenant_id: 'tenant-1',
    sku: 'TOM001',
    name: 'Tomate Italiano',
    price: 7.49,
    cost_price: 4.00,
    unit: 'kg',
    default_quantity: 0.5,
    stock: 25,
    category: 'Legumes',
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: '4',
    tenant_id: 'tenant-1',
    sku: 'ALF001',
    name: 'Alface Americana',
    price: 3.99,
    cost_price: 2.00,
    unit: 'un',
    default_quantity: 1,
    stock: 40,
    category: 'Verduras',
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: '5',
    tenant_id: 'tenant-1',
    sku: 'CEP001',
    name: 'Cebola Roxa',
    price: 6.99,
    cost_price: 3.50,
    unit: 'kg',
    default_quantity: 0.5,
    stock: 35,
    category: 'Legumes',
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: '6',
    tenant_id: 'tenant-1',
    sku: 'LAR001',
    name: 'Laranja Pera',
    price: 4.99,
    cost_price: 2.50,
    unit: 'kg',
    default_quantity: 0.5,
    stock: 60,
    category: 'Frutas',
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: '7',
    tenant_id: 'tenant-1',
    sku: 'BAT001',
    name: 'Batata Inglesa',
    price: 5.49,
    cost_price: 3.00,
    unit: 'kg',
    default_quantity: 0.5,
    stock: 45,
    category: 'Legumes',
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: '8',
    tenant_id: 'tenant-1',
    sku: 'COU001',
    name: 'Couve Manteiga',
    price: 2.99,
    cost_price: 1.50,
    unit: 'un',
    default_quantity: 1,
    stock: 0,
    category: 'Verduras',
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }
]

export default function PDVPage() {
  // State
  const [cart, setCart] = useState<Cart>(() => createCart())
  const [searchQuery, setSearchQuery] = useState('')
  const [products, setProducts] = useState<Product[]>(MOCK_PRODUCTS)
  const [filteredProducts, setFilteredProducts] = useState<Product[]>(MOCK_PRODUCTS)
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [isQuantityModalOpen, setIsQuantityModalOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isOnline, setIsOnline] = useState(true)
  
  // Feedback hook for visual notifications
  const { showFeedback, FeedbackComponent } = useFeedback()

  // Monitor online status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    setIsOnline(navigator.onLine)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // Filter products based on search query
  const handleSearch = useCallback((query: string) => {
    if (!query.trim()) {
      setFilteredProducts(products)
      return
    }

    const normalizedQuery = query.toLowerCase().trim()
    const filtered = products.filter(product => {
      const nameMatch = product.name.toLowerCase().includes(normalizedQuery)
      const skuMatch = product.sku.toLowerCase().includes(normalizedQuery)
      const categoryMatch = product.category?.toLowerCase().includes(normalizedQuery) ?? false
      return nameMatch || skuMatch || categoryMatch
    })

    setFilteredProducts(filtered)
  }, [products])

  // Handle product selection - opens quantity modal (touch 1)
  const handleProductSelect = useCallback((product: Product) => {
    if (product.stock <= 0) return
    setSelectedProduct(product)
    setIsQuantityModalOpen(true)
  }, [])

  // Handle quantity confirmation - adds to cart (touch 2)
  const handleQuantityConfirm = useCallback((product: Product, quantity: number) => {
    setCart(currentCart => addToCart(currentCart, product, quantity))
    setIsQuantityModalOpen(false)
    setSelectedProduct(null)
  }, [])

  // Handle cart item quantity update
  const handleUpdateQuantity = useCallback((itemId: string, quantity: number) => {
    setCart(currentCart => updateCartItem(currentCart, itemId, quantity))
  }, [])

  // Handle cart item removal
  const handleRemoveItem = useCallback((itemId: string) => {
    setCart(currentCart => removeFromCart(currentCart, itemId))
  }, [])

  // Handle cart clear
  const handleClearCart = useCallback(() => {
    setCart(currentCart => clearCart(currentCart))
  }, [])

  // Handle sale finalization (touch 3)
  // Requirements: 4.5 - Finalize sale in max 3 touches
  const handleFinalize = useCallback(async () => {
    if (cart.items.length === 0) return

    setIsLoading(true)

    try {
      // TODO: Integrate with PDVService.finalizeSale() when Supabase is connected
      // For now, simulate API call for development
      await new Promise(resolve => setTimeout(resolve, 800))

      // Format total for display
      const formattedTotal = new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
      }).format(cart.total)

      // Clear cart after successful sale
      setCart(createCart())

      // Show success feedback with visual notification
      showFeedback({
        type: 'success',
        message: `Venda finalizada! Total: ${formattedTotal}`,
        duration: 3000
      })
    } catch (error) {
      console.error('Failed to finalize sale:', error)
      showFeedback({
        type: 'error',
        message: 'Erro ao finalizar venda. Tente novamente.',
        duration: 4000
      })
    } finally {
      setIsLoading(false)
    }
  }, [cart, showFeedback])

  // Handle profile click
  const handleProfileClick = useCallback(() => {
    // TODO: Implement profile menu/navigation
    console.log('Profile clicked')
  }, [])

  // Get frequent products (top 6 by some criteria - for now just first 6)
  const frequentProducts = products.slice(0, 6)

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Feedback Toast Notifications */}
      <FeedbackComponent />
      
      {/* Header */}
      <PDVHeader
        storeName="Verdurão do João"
        userName="Maria"
        isOnline={isOnline}
        onProfileClick={handleProfileClick}
      />

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto pb-32">
        <div className="max-w-lg mx-auto px-4 py-4 space-y-6">
          {/* Search Bar - Always visible */}
          <SearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            onSearch={handleSearch}
            placeholder="Buscar produto por nome ou código..."
            autoFocus={true}
          />

          {/* Search Results or Suggestions */}
          {searchQuery.trim() ? (
            <ProductPillGrid
              products={filteredProducts}
              onSelect={handleProductSelect}
              title="Resultados da busca"
              emptyMessage="Nenhum produto encontrado"
            />
          ) : (
            <>
              {/* Frequent Products */}
              <ProductPillGrid
                products={frequentProducts}
                onSelect={handleProductSelect}
                title="Produtos frequentes"
              />

              {/* All Products */}
              <ProductPillGrid
                products={products}
                onSelect={handleProductSelect}
                title="Todos os produtos"
              />
            </>
          )}
        </div>
      </main>

      {/* Floating Cart */}
      <FloatingCart
        cart={cart}
        onUpdateQuantity={handleUpdateQuantity}
        onRemoveItem={handleRemoveItem}
        onFinalize={handleFinalize}
        onClear={handleClearCart}
        isLoading={isLoading}
      />

      {/* Quantity Modal */}
      <QuantityModal
        product={selectedProduct}
        isOpen={isQuantityModalOpen}
        onClose={() => {
          setIsQuantityModalOpen(false)
          setSelectedProduct(null)
        }}
        onConfirm={handleQuantityConfirm}
      />
    </div>
  )
}
