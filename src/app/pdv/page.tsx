'use client'

import { useState, useCallback, useEffect } from 'react'
import { Product, CashRegisterSession, SalePaymentMethod } from '@/types'
import { Cart, createCart, addToCart, updateCartItem, removeFromCart, clearCart } from '@/lib/pdv/pdv.service'
import { SearchBar } from '@/components/pdv/SearchBar'
import { ProductPillGrid } from '@/components/pdv/ProductPill'
import { FloatingCart } from '@/components/pdv/FloatingCart'
import { PDVHeader } from '@/components/pdv/PDVHeader'
import { QuantityModal } from '@/components/pdv/QuantityModal'
import { CheckoutModal } from '@/components/pdv/CheckoutModal'
import { useFeedback } from '@/hooks/useFeedback'
import { createClient } from '@/lib/supabase/client'
import { SubscriptionGuard } from '@/components/subscription/SubscriptionGuard'
import Link from 'next/link'

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
  const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isOnline, setIsOnline] = useState(true)
  const [storeName, setStoreName] = useState('')
  const [userName, setUserName] = useState('')
  const [trialDaysLeft, setTrialDaysLeft] = useState<number | null>(null)
  const [subscriptionStatus, setSubscriptionStatus] = useState('')
  const [cashSession, setCashSession] = useState<CashRegisterSession | null>(null)
  const [tenantId, setTenantId] = useState('')
  const [userId, setUserId] = useState('')
  const [todaySales, setTodaySales] = useState({ count: 0, total: 0 })
  
  const { showFeedback, FeedbackComponent } = useFeedback()

  // Load data
  useEffect(() => {
    async function loadData() {
      const supabase = createClient()
      
      const { data: { user } } = await supabase.auth.getUser()
      if (!user?.email) return

      const { data: storeUser } = await supabase
        .from('store_users')
        .select('tenant_id, name, id')
        .eq('email', user.email.toLowerCase())
        .single()

      if (!storeUser) return

      setUserName(storeUser.name || '')
      setTenantId(storeUser.tenant_id)
      setUserId(storeUser.id)

      // Get tenant info
      const { data: tenant } = await supabase
        .from('tenants')
        .select('store_name, trial_ends_at, subscription_status')
        .eq('id', storeUser.tenant_id)
        .single()

      if (tenant) {
        setStoreName(tenant.store_name)
        setSubscriptionStatus(tenant.subscription_status || '')
        
        if (tenant.trial_ends_at) {
          const trialEnd = new Date(tenant.trial_ends_at)
          const now = new Date()
          const diffTime = trialEnd.getTime() - now.getTime()
          const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
          setTrialDaysLeft(daysLeft > 0 ? daysLeft : 0)
        }
      }

      // Load products
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

      // Check for open cash session
      const { data: openSession } = await supabase
        .from('cash_register_sessions')
        .select('*')
        .eq('tenant_id', storeUser.tenant_id)
        .eq('status', 'open')
        .single()

      setCashSession(openSession)

      // Load today's sales
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      
      const { data: salesData } = await supabase
        .from('sales')
        .select('total')
        .eq('tenant_id', storeUser.tenant_id)
        .gte('created_at', today.toISOString())

      if (salesData) {
        setTodaySales({
          count: salesData.length,
          total: salesData.reduce((sum, s) => sum + s.total, 0)
        })
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

  // Filter products
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

  const handleProductSelect = useCallback((product: Product) => {
    if (product.stock <= 0) return
    setSelectedProduct(product)
    setIsQuantityModalOpen(true)
  }, [])

  const handleQuantityConfirm = useCallback((product: Product, quantity: number) => {
    setCart(currentCart => addToCart(currentCart, product, quantity))
    setIsQuantityModalOpen(false)
    setSelectedProduct(null)
  }, [])

  const handleUpdateQuantity = useCallback((itemId: string, quantity: number) => {
    setCart(currentCart => updateCartItem(currentCart, itemId, quantity))
  }, [])

  const handleRemoveItem = useCallback((itemId: string) => {
    setCart(currentCart => removeFromCart(currentCart, itemId))
  }, [])

  const handleClearCart = useCallback(() => {
    setCart(currentCart => clearCart(currentCart))
  }, [])

  const handleFinalize = useCallback(() => {
    if (cart.items.length === 0) return
    setIsCheckoutModalOpen(true)
  }, [cart.items.length])

  const handleCheckoutConfirm = useCallback(async (paymentMethod: SalePaymentMethod, amountPaid?: number) => {
    setIsLoading(true)

    try {
      const supabase = createClient()
      
      // Create sale
      const { data: sale, error: saleError } = await supabase
        .from('sales')
        .insert({
          tenant_id: tenantId,
          user_id: userId,
          total: cart.total,
          payment_method: paymentMethod,
          session_id: cashSession?.id || null
        })
        .select()
        .single()

      if (saleError) throw saleError

      // Create sale items
      const saleItems = cart.items.map(item => ({
        sale_id: sale.id,
        product_id: item.product.id,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        subtotal: item.subtotal
      }))

      const { error: itemsError } = await supabase
        .from('sale_items')
        .insert(saleItems)

      if (itemsError) throw itemsError

      // Update stock
      for (const item of cart.items) {
        await supabase
          .from('products')
          .update({ stock: item.product.stock - item.quantity })
          .eq('id', item.product.id)
      }

      const formattedTotal = new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
      }).format(cart.total)

      const paymentLabel = paymentMethod === 'dinheiro' ? '💵 Dinheiro' : 
                          paymentMethod === 'pix' ? '📱 Pix' : 
                          paymentMethod === 'cartao' ? '💳 Cartão' : '📝 Fiado'

      // Update today's sales
      setTodaySales(prev => ({
        count: prev.count + 1,
        total: prev.total + cart.total
      }))

      // Update products stock locally
      setProducts(prev => prev.map(p => {
        const cartItem = cart.items.find(i => i.product.id === p.id)
        if (cartItem) {
          return { ...p, stock: p.stock - cartItem.quantity }
        }
        return p
      }))
      setFilteredProducts(prev => prev.map(p => {
        const cartItem = cart.items.find(i => i.product.id === p.id)
        if (cartItem) {
          return { ...p, stock: p.stock - cartItem.quantity }
        }
        return p
      }))

      setCart(createCart())
      setIsCheckoutModalOpen(false)

      showFeedback({
        type: 'success',
        message: `✓ Venda finalizada! ${formattedTotal} - ${paymentLabel}`,
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
  }, [cart, tenantId, userId, cashSession, showFeedback])

  const handleProfileClick = useCallback(() => {}, [])

  const frequentProducts = products.slice(0, 6)
  const formatCurrency = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <FeedbackComponent />
      
      <PDVHeader
        storeName={storeName || 'Carregando...'}
        userName={userName || ''}
        isOnline={isOnline}
        trialDaysLeft={trialDaysLeft}
        subscriptionStatus={subscriptionStatus}
        onProfileClick={handleProfileClick}
      />

      {/* Quick Stats Bar */}
      <div className="bg-white border-b border-gray-100 px-4 py-2">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/pdv/caixa" className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium
              ${cashSession ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
              {cashSession ? '🟢' : '🔴'} Caixa
            </Link>
            <Link href="/pdv/historico" className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-gray-100 text-gray-600 text-sm font-medium">
              📋 Histórico
            </Link>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-500">Hoje</p>
            <p className="text-sm font-semibold text-gray-800">{todaySales.count} vendas • {formatCurrency(todaySales.total)}</p>
          </div>
        </div>
      </div>

      {/* Cash Warning */}
      {!cashSession && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-3">
          <div className="max-w-lg mx-auto flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-amber-600">⚠️</span>
              <span className="text-sm text-amber-800">Caixa fechado</span>
            </div>
            <Link href="/pdv/caixa" className="text-sm font-medium text-amber-700 hover:text-amber-800">
              Abrir caixa →
            </Link>
          </div>
        </div>
      )}

      <main className="flex-1 overflow-y-auto pb-32">
        <div className="max-w-lg mx-auto px-4 py-4 space-y-6">
          <SearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            onSearch={handleSearch}
            placeholder="Buscar produto..."
            autoFocus={true}
          />

          {searchQuery.trim() ? (
            <ProductPillGrid
              products={filteredProducts}
              onSelect={handleProductSelect}
              title="Resultados"
              emptyMessage="Nenhum produto encontrado"
            />
          ) : (
            <>
              {frequentProducts.length > 0 && (
                <ProductPillGrid
                  products={frequentProducts}
                  onSelect={handleProductSelect}
                  title="⭐ Frequentes"
                />
              )}
              <ProductPillGrid
                products={products}
                onSelect={handleProductSelect}
                title="Todos os produtos"
              />
            </>
          )}
        </div>
      </main>

      <FloatingCart
        cart={cart}
        onUpdateQuantity={handleUpdateQuantity}
        onRemoveItem={handleRemoveItem}
        onFinalize={handleFinalize}
        onClear={handleClearCart}
        isLoading={isLoading}
      />

      <QuantityModal
        product={selectedProduct}
        isOpen={isQuantityModalOpen}
        onClose={() => {
          setIsQuantityModalOpen(false)
          setSelectedProduct(null)
        }}
        onConfirm={handleQuantityConfirm}
      />

      <CheckoutModal
        cart={cart}
        isOpen={isCheckoutModalOpen}
        isLoading={isLoading}
        onClose={() => setIsCheckoutModalOpen(false)}
        onConfirm={handleCheckoutConfirm}
      />
    </div>
  )
}
