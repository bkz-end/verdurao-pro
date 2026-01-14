'use client'

import { useState, useCallback, useEffect } from 'react'
import { Product, CashRegisterSession, SalePaymentMethod } from '@/types'
import { Cart, createCart, addToCart, updateCartItem, removeFromCart, clearCart } from '@/lib/pdv/pdv.service'
import { ProductPillGrid } from '@/components/pdv/ProductPill'
import { FloatingCart } from '@/components/pdv/FloatingCart'
import { QuantityModal } from '@/components/pdv/QuantityModal'
import { CheckoutModal } from '@/components/pdv/CheckoutModal'
import { useFeedback } from '@/hooks/useFeedback'
import { createClient } from '@/lib/supabase/client'
import { SubscriptionGuard } from '@/components/subscription/SubscriptionGuard'
import { Icons } from '@/components/ui/icons'
import Link from 'next/link'

export default function PDVPage() {
  return (
    <SubscriptionGuard>
      <PDVContent />
    </SubscriptionGuard>
  )
}

function PDVContent() {
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
  const [cashSession, setCashSession] = useState<CashRegisterSession | null>(null)
  const [tenantId, setTenantId] = useState('')
  const [userId, setUserId] = useState('')
  const [todaySales, setTodaySales] = useState({ count: 0, total: 0 })
  
  const { showFeedback, FeedbackComponent } = useFeedback()

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

      setTenantId(storeUser.tenant_id)
      setUserId(storeUser.id)

      // Load all data in parallel for speed
      const today = new Date()
      today.setHours(0, 0, 0, 0)

      const [tenantRes, productsRes, sessionRes, salesRes] = await Promise.all([
        supabase
          .from('tenants')
          .select('store_name')
          .eq('id', storeUser.tenant_id)
          .single(),
        supabase
          .from('products')
          .select('*')
          .eq('tenant_id', storeUser.tenant_id)
          .eq('is_active', true)
          .order('name'),
        supabase
          .from('cash_register_sessions')
          .select('*')
          .eq('tenant_id', storeUser.tenant_id)
          .eq('status', 'open')
          .maybeSingle(),
        supabase
          .from('sales')
          .select('total')
          .eq('tenant_id', storeUser.tenant_id)
          .gte('created_at', today.toISOString())
      ])

      if (tenantRes.data) setStoreName(tenantRes.data.store_name)
      
      if (productsRes.data) {
        setProducts(productsRes.data as Product[])
        setFilteredProducts(productsRes.data as Product[])
      }

      setCashSession(sessionRes.data)

      if (salesRes.data) {
        setTodaySales({
          count: salesRes.data.length,
          total: salesRes.data.reduce((sum, s) => sum + s.total, 0)
        })
      }
    }

    loadData()
  }, [])

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

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query)
    if (!query.trim()) {
      setFilteredProducts(products)
      return
    }
    const normalizedQuery = query.toLowerCase().trim()
    const filtered = products.filter(product => {
      const nameMatch = product.name.toLowerCase().includes(normalizedQuery)
      const skuMatch = product.sku.toLowerCase().includes(normalizedQuery)
      return nameMatch || skuMatch
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

  const handleCheckoutConfirm = useCallback(async (paymentMethod: SalePaymentMethod) => {
    setIsLoading(true)

    try {
      const supabase = createClient()
      
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

      setTodaySales(prev => ({
        count: prev.count + 1,
        total: prev.total + cart.total
      }))

      setProducts(prev => prev.map(p => {
        const cartItem = cart.items.find(i => i.product.id === p.id)
        if (cartItem) return { ...p, stock: p.stock - cartItem.quantity }
        return p
      }))
      setFilteredProducts(prev => prev.map(p => {
        const cartItem = cart.items.find(i => i.product.id === p.id)
        if (cartItem) return { ...p, stock: p.stock - cartItem.quantity }
        return p
      }))

      setCart(createCart())
      setIsCheckoutModalOpen(false)

      showFeedback({
        type: 'success',
        message: `Venda finalizada: ${formattedTotal}`,
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

  const formatCurrency = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
  const frequentProducts = products.slice(0, 8)

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <FeedbackComponent />
      
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-4 py-3 safe-area-top">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition-colors">
              <Icons.chevronLeft className="w-5 h-5 text-slate-600" />
            </Link>
            <div>
              <h1 className="font-semibold text-slate-800">{storeName || 'PDV'}</h1>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-500' : 'bg-red-500'}`} />
                {isOnline ? 'Online' : 'Offline'}
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Link 
              href="/pdv/caixa" 
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors
                ${cashSession 
                  ? 'bg-emerald-100 text-emerald-700' 
                  : 'bg-slate-100 text-slate-600'
                }`}
            >
              <Icons.wallet className="w-4 h-4" />
              Caixa
            </Link>
            <Link 
              href="/pdv/historico" 
              className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition-colors"
            >
              <Icons.transactions className="w-5 h-5 text-slate-600" />
            </Link>
          </div>
        </div>
      </header>

      {/* Stats Bar */}
      <div className="bg-white border-b border-slate-100 px-4 py-2">
        <div className="max-w-lg mx-auto flex items-center justify-between text-sm">
          <span className="text-slate-500">Hoje</span>
          <span className="font-semibold text-slate-800">
            {todaySales.count} vendas · {formatCurrency(todaySales.total)}
          </span>
        </div>
      </div>

      {/* Cash Warning */}
      {!cashSession && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2.5">
          <div className="max-w-lg mx-auto flex items-center justify-between">
            <div className="flex items-center gap-2 text-amber-800">
              <Icons.losses className="w-4 h-4" />
              <span className="text-sm font-medium">Caixa fechado</span>
            </div>
            <Link href="/pdv/caixa" className="text-sm font-medium text-amber-700 hover:text-amber-800">
              Abrir caixa
            </Link>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="bg-white px-4 py-3 border-b border-slate-100">
        <div className="max-w-lg mx-auto">
          <div className="relative">
            <Icons.search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Buscar produto..."
              autoFocus
              className="w-full h-12 pl-12 pr-4 bg-slate-50 border border-slate-200 rounded-xl
                         text-slate-800 placeholder:text-slate-400
                         focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20
                         transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => handleSearch('')}
                className="absolute right-4 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center hover:bg-slate-300"
              >
                <Icons.close className="w-4 h-4 text-slate-500" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Products */}
      <main className="flex-1 overflow-y-auto pb-32">
        <div className="max-w-lg mx-auto px-4 py-4 space-y-6">
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
                  title="Frequentes"
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
