'use client'

import { useState } from 'react'
import { Cart, CartItem } from '@/lib/pdv/pdv.service'
import { haptics } from '@/lib/utils/haptics'

/**
 * FloatingCart - Bottom floating cart component
 * Requirements: 4.1, 4.4, 4.5, 12.1, 12.3, 12.4
 * 
 * Features:
 * - Fixed at bottom of screen for thumb accessibility
 * - Shows item count and total
 * - Expandable to show cart items
 * - Quick finalize action
 * - Haptic feedback on interactions
 */
export interface FloatingCartProps {
  cart: Cart
  onUpdateQuantity: (itemId: string, quantity: number) => void
  onRemoveItem: (itemId: string) => void
  onFinalize: () => void
  onClear: () => void
  isLoading?: boolean
}

export function FloatingCart({
  cart,
  onUpdateQuantity,
  onRemoveItem,
  onFinalize,
  onClear,
  isLoading = false
}: FloatingCartProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  const itemCount = cart.items.length
  const totalQuantity = cart.items.reduce((sum, item) => sum + item.quantity, 0)

  // Format price in BRL
  const formattedTotal = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(cart.total)

  const toggleExpanded = () => {
    if (itemCount > 0) {
      haptics.tap()
      setIsExpanded(!isExpanded)
    }
  }

  const handleFinalize = () => {
    if (itemCount > 0 && !isLoading) {
      haptics.success()
      onFinalize()
    }
  }

  if (itemCount === 0) {
    return (
      <div className="fixed bottom-0 left-0 right-0 bg-gray-100 border-t border-gray-200 p-4 safe-area-bottom">
        <div className="max-w-lg mx-auto text-center text-gray-400">
          Carrinho vazio - selecione produtos para começar
        </div>
      </div>
    )
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 safe-area-bottom z-50">
      {/* Expanded Cart Items */}
      {isExpanded && (
        <div className="bg-white border-t border-gray-200 shadow-lg max-h-[50vh] overflow-y-auto">
          <div className="max-w-lg mx-auto p-4 space-y-3">
            <div className="flex justify-between items-center pb-2 border-b">
              <h3 className="font-semibold text-gray-800">Itens do Carrinho</h3>
              <button
                type="button"
                onClick={onClear}
                className="text-sm text-red-500 hover:text-red-600 active:text-red-700"
                aria-label="Limpar carrinho"
              >
                Limpar tudo
              </button>
            </div>
            
            {cart.items.map((item) => (
              <CartItemRow
                key={item.id}
                item={item}
                onUpdateQuantity={onUpdateQuantity}
                onRemove={onRemoveItem}
              />
            ))}
          </div>
        </div>
      )}

      {/* Cart Summary Bar */}
      <div className="bg-green-500 text-white shadow-lg">
        <div className="max-w-lg mx-auto flex items-center">
          {/* Cart Info - Clickable to expand */}
          <button
            type="button"
            onClick={toggleExpanded}
            className="flex-1 flex items-center gap-3 p-4 min-h-[64px] text-left
                       hover:bg-green-600 active:bg-green-700 transition-colors"
            aria-expanded={isExpanded}
            aria-label={`Carrinho com ${itemCount} ${itemCount === 1 ? 'item' : 'itens'}, total ${formattedTotal}`}
          >
            {/* Cart Icon with Badge */}
            <div className="relative">
              <svg
                className="w-7 h-7"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
                />
              </svg>
              <span className="absolute -top-2 -right-2 bg-white text-green-600 text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                {itemCount}
              </span>
            </div>

            {/* Cart Summary */}
            <div className="flex-1">
              <div className="text-sm opacity-90">
                {totalQuantity.toFixed(totalQuantity % 1 === 0 ? 0 : 2)} {totalQuantity === 1 ? 'item' : 'itens'}
              </div>
              <div className="text-lg font-bold">{formattedTotal}</div>
            </div>

            {/* Expand/Collapse Icon */}
            <svg
              className={`w-5 h-5 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
            </svg>
          </button>

          {/* Finalize Button - 56px min height for WCAG AAA */}
          <button
            type="button"
            onClick={handleFinalize}
            disabled={isLoading}
            className="min-h-[56px] px-6 m-2 bg-white text-green-600 font-bold rounded-xl
                       hover:bg-green-50 active:bg-green-100 active:scale-[0.98]
                       disabled:opacity-50 disabled:cursor-not-allowed
                       transition-all duration-150"
            aria-label="Finalizar venda"
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" aria-hidden="true">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span>...</span>
              </span>
            ) : (
              'Finalizar'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

/**
 * CartItemRow - Individual cart item display with quantity controls
 * Requirements: 4.4, 12.1
 */
interface CartItemRowProps {
  item: CartItem
  onUpdateQuantity: (itemId: string, quantity: number) => void
  onRemove: (itemId: string) => void
}

function CartItemRow({ item, onUpdateQuantity, onRemove }: CartItemRowProps) {
  const formattedSubtotal = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(item.subtotal)

  const formattedUnitPrice = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(item.unitPrice)

  const unitDisplay = item.product.unit === 'un' ? 'un' : item.product.unit

  // Determine step based on unit type
  const step = item.product.unit === 'un' ? 1 : 0.1

  const handleDecrease = () => {
    haptics.tap()
    const newQuantity = Math.max(0, item.quantity - step)
    if (newQuantity <= 0) {
      onRemove(item.id)
    } else {
      onUpdateQuantity(item.id, Number(newQuantity.toFixed(2)))
    }
  }

  const handleIncrease = () => {
    haptics.tap()
    const newQuantity = item.quantity + step
    onUpdateQuantity(item.id, Number(newQuantity.toFixed(2)))
  }

  const handleRemove = () => {
    haptics.warning()
    onRemove(item.id)
  }

  return (
    <div className="flex items-center gap-3 py-2">
      {/* Product Info */}
      <div className="flex-1 min-w-0">
        <div className="font-medium text-gray-800 truncate">{item.product.name}</div>
        <div className="text-sm text-gray-500">
          {formattedUnitPrice}/{unitDisplay}
        </div>
      </div>

      {/* Quantity Controls - 44px min touch targets */}
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={handleDecrease}
          className="w-11 h-11 flex items-center justify-center rounded-lg bg-gray-100
                     hover:bg-gray-200 active:bg-gray-300 transition-colors"
          aria-label={`Diminuir quantidade de ${item.product.name}`}
        >
          <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
          </svg>
        </button>

        <span className="w-16 text-center font-medium text-gray-800">
          {item.quantity.toFixed(item.product.unit === 'un' ? 0 : 2)} {unitDisplay}
        </span>

        <button
          type="button"
          onClick={handleIncrease}
          className="w-11 h-11 flex items-center justify-center rounded-lg bg-gray-100
                     hover:bg-gray-200 active:bg-gray-300 transition-colors"
          aria-label={`Aumentar quantidade de ${item.product.name}`}
        >
          <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </div>

      {/* Subtotal */}
      <div className="w-20 text-right font-semibold text-gray-800">
        {formattedSubtotal}
      </div>

      {/* Remove Button */}
      <button
        type="button"
        onClick={handleRemove}
        className="w-11 h-11 flex items-center justify-center rounded-lg text-red-500
                   hover:bg-red-50 active:bg-red-100 transition-colors"
        aria-label={`Remover ${item.product.name} do carrinho`}
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      </button>
    </div>
  )
}
