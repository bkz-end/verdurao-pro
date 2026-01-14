'use client'

import { useState, useCallback, useEffect } from 'react'
import { Product, LossReason } from '@/types'
import { PDVHeader } from '@/components/pdv/PDVHeader'
import { ProductSelector } from '@/components/losses/ProductSelector'
import { ProductSearchModal } from '@/components/losses/ProductSearchModal'
import { LossQuantityInput } from '@/components/losses/LossQuantityInput'
import { ReasonSelector } from '@/components/losses/ReasonSelector'
import { useFeedback } from '@/hooks/useFeedback'
import { haptics } from '@/lib/utils/haptics'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { BottomNav } from '@/components/ui/bottom-nav'
import { Icons } from '@/components/ui/icons'

/**
 * Perdas Page - Mobile-first loss registration interface
 * Requirements: 7.1
 * 
 * Features:
 * - Product search and selection
 * - Quantity input with stock validation
 * - Reason selection (expiration, damage, theft, other)
 * - Optional notes field
 * - Mobile-optimized layout
 */

export default function PerdasPage() {
  // State
  const [products, setProducts] = useState<Product[]>([])
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [quantity, setQuantity] = useState(0)
  const [reason, setReason] = useState<LossReason | null>(null)
  const [notes, setNotes] = useState('')
  const [isProductModalOpen, setIsProductModalOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isOnline, setIsOnline] = useState(true)
  const [errors, setErrors] = useState<Record<string, string>>({})
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
      if (!user?.email) return

      // Get store user info
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

  // Reset quantity when product changes
  useEffect(() => {
    if (selectedProduct) {
      const defaultQty = selectedProduct.unit === 'un' ? 1 : 0.5
      setQuantity(defaultQty)
    } else {
      setQuantity(0)
    }
  }, [selectedProduct])

  // Handle product selection
  const handleProductSelect = useCallback((product: Product) => {
    setSelectedProduct(product)
    setIsProductModalOpen(false)
    setErrors(prev => ({ ...prev, product: '' }))
  }, [])

  // Handle profile click
  const handleProfileClick = useCallback(() => {
    // TODO: Implement profile menu/navigation
    console.log('Profile clicked')
  }, [])

  // Validate form
  const validateForm = useCallback(() => {
    const newErrors: Record<string, string> = {}

    if (!selectedProduct) {
      newErrors.product = 'Selecione um produto'
    }

    if (quantity <= 0) {
      newErrors.quantity = 'Quantidade deve ser maior que zero'
    } else if (selectedProduct && quantity > selectedProduct.stock) {
      newErrors.quantity = 'Quantidade maior que o estoque disponível'
    }

    if (!reason) {
      newErrors.reason = 'Selecione um motivo'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }, [selectedProduct, quantity, reason])

  // Handle form submission
  const handleSubmit = useCallback(async () => {
    if (!validateForm()) {
      haptics.error()
      return
    }

    setIsLoading(true)

    try {
      // TODO: Integrate with LossService.recordLoss() when Supabase is connected
      // For now, simulate API call for development
      await new Promise(resolve => setTimeout(resolve, 800))

      haptics.success()
      showFeedback({
        type: 'success',
        message: `Perda registrada: ${quantity} ${selectedProduct?.unit} de ${selectedProduct?.name}`,
        duration: 3000
      })

      // Reset form
      setSelectedProduct(null)
      setQuantity(0)
      setReason(null)
      setNotes('')
      setErrors({})
    } catch (error) {
      console.error('Failed to record loss:', error)
      haptics.error()
      showFeedback({
        type: 'error',
        message: 'Erro ao registrar perda. Tente novamente.',
        duration: 4000
      })
    } finally {
      setIsLoading(false)
    }
  }, [validateForm, selectedProduct, quantity, showFeedback])

  // Check if form is valid for submit button state
  const isFormValid = selectedProduct && quantity > 0 && reason

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
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
      <main className="flex-1 overflow-y-auto pb-40">
        <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
          {/* Page Title with Report Link */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-800">Registrar Perda</h1>
              <p className="text-slate-500">Informe os detalhes da perda de produto</p>
            </div>
            <Link
              href="/perdas/relatorio"
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-emerald-600 
                         bg-emerald-50 rounded-xl hover:bg-emerald-100 transition-colors shadow-sm"
            >
              <Icons.reports className="w-4 h-4" />
              Relatório
            </Link>
          </div>

          {/* Product Selection */}
          <ProductSelector
            product={selectedProduct}
            onClick={() => setIsProductModalOpen(true)}
          />
          {errors.product && (
            <p className="text-sm text-red-600 -mt-4">{errors.product}</p>
          )}

          {/* Quantity Input */}
          <LossQuantityInput
            product={selectedProduct}
            value={quantity}
            onChange={setQuantity}
            error={errors.quantity}
          />

          {/* Reason Selection */}
          <ReasonSelector
            value={reason}
            onChange={(r) => {
              setReason(r)
              setErrors(prev => ({ ...prev, reason: '' }))
            }}
          />
          {errors.reason && (
            <p className="text-sm text-red-600 -mt-4">{errors.reason}</p>
          )}

          {/* Notes (Optional) */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-700">
              Observações (opcional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Adicione detalhes sobre a perda..."
              rows={3}
              className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl bg-white
                         focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 focus:outline-none
                         resize-none transition-colors shadow-sm"
            />
          </div>

          {/* Submit Button */}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!isFormValid || isLoading}
            className={`
              w-full h-14 rounded-xl font-semibold text-white shadow-sm
              transition-all flex items-center justify-center gap-2
              ${isFormValid && !isLoading
                ? 'bg-red-500 hover:bg-red-600 active:bg-red-700 active:scale-[0.98] hover:shadow-md'
                : 'bg-slate-300 cursor-not-allowed'
              }
            `}
          >
            {isLoading ? (
              <>
                <Icons.loader className="w-5 h-5 animate-spin" />
                Registrando...
              </>
            ) : (
              <>
                <Icons.losses className="w-5 h-5" />
                Registrar Perda
              </>
            )}
          </button>
        </div>
      </main>

      {/* Bottom Navigation */}
      <BottomNav />

      {/* Product Search Modal */}
      <ProductSearchModal
        isOpen={isProductModalOpen}
        products={products}
        onSelect={handleProductSelect}
        onClose={() => setIsProductModalOpen(false)}
      />
    </div>
  )
}
