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
import { createClient } from '@/lib/supabase/client'
import { SubscriptionGuard } from '@/components/subscription/SubscriptionGuard'
import { SubscriptionFloatingButton } from '@/components/subscription/SubscriptionFloatingButton'

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

export default function PDVPage() {
  return (
    <SubscriptionGuard>
      <PDVContent />
    </SubscriptionGuard>
  )
}

function PDVContent() {
  // State
  const [cart, setCart] = useState<Cart>(() => createCart())
  const [searchQuery, setSearchQuery] = useState('')
  const [products, setProducts] = useState<Product[]>([])
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([])
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [isQuantityModalOpen, setIsQuantityModalOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isOnline, setIsOnline] = useState(true)
  const [storeName, setStoreName] = useState('')
  const [userName, setUserName] = useState('')
  
  // Feedback hook for visual notifications
  const { showFeedback, FeedbackComponent } = useFeedback()

  // Load store data and products from Supabase
  useEffect(() => {
    async function loadData() {
      const supabase = createClient()
      
      // Get current user's store info
      const { data: { user } } = await supabase.auth.getUser()
      if (!user?.email) return      // Get store user info
      const { data: storeUser } = await supabase
        .from('store_users')
        .select('tenant_id, name')
        .eq('email', user.email.toLowerCase())
        .single()

      if (!storeUser) return

      setUserName(storeUser.name || '')

      // Get tenant info
      const { data: tenant } = await supabase
        .from('tenants')
        .select('store_name')
        .eq('id', storeUser.tenant_id)
        .single()

      if (tenant) {
        setStoreName(tenant.store_name)
      }

      // Load products for this tenant (starts empty for new users)
      const { data: productsData } = await supabase
        .from('products')
        .select('*')
        .eq('tenant_id', storeUser.tenant_id)
        .eq('is_active', true)
        .order('name')

      if (productsData) {
        setProducts(productsData as Product[])
        setFilteredProducts(productsData as Product[])
      }
    }

    loadData()
  }, [])

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
        storeName={storeName || 'Carregando...'}
        userName={userName || ''}
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

      {/* Subscription Floating Button */}
      <SubscriptionFloatingButton />
    </div>
  )
}
