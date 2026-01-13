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
import Link from 'next/link'

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
  }
]

export default function PerdasPage() {
  // State
  const [products] = useState<Product[]>(MOCK_PRODUCTS)
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [quantity, setQuantity] = useState(0)
  const [reason, setReason] = useState<LossReason | null>(null)
  const [notes, setNotes] = useState('')
  const [isProductModalOpen, setIsProductModalOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isOnline, setIsOnline] = useState(true)
  const [errors, setErrors] = useState<Record<string, string>>({})

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
      <main className="flex-1 overflow-y-auto pb-24">
        <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
          {/* Page Title with Report Link */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-800">Registrar Perda</h1>
              <p className="text-gray-500">Informe os detalhes da perda de produto</p>
            </div>
            <Link
              href="/perdas/relatorio"
              className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-green-600 
                         bg-green-50 rounded-lg hover:bg-green-100 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
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
            <label className="block text-sm font-medium text-gray-700">
              Observações (opcional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Adicione detalhes sobre a perda..."
              rows={3}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl
                         focus:border-green-500 focus:ring-2 focus:ring-green-200 focus:outline-none
                         resize-none transition-colors"
            />
          </div>
        </div>
      </main>

      {/* Submit Button - Fixed at bottom */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-200 safe-area-bottom">
        <div className="max-w-lg mx-auto">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!isFormValid || isLoading}
            className={`
              w-full h-14 rounded-xl font-semibold text-white
              transition-all
              ${isFormValid && !isLoading
                ? 'bg-red-500 hover:bg-red-600 active:bg-red-700 active:scale-[0.98]'
                : 'bg-gray-300 cursor-not-allowed'
              }
            `}
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Registrando...
              </span>
            ) : (
              'Registrar Perda'
            )}
          </button>
        </div>
      </div>

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
