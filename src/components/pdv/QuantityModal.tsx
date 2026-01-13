'use client'

import { useState, useEffect, useRef } from 'react'
import { Product } from '@/types'
import { haptics } from '@/lib/utils/haptics'

/**
 * QuantityModal - Modal for adjusting product quantity before adding to cart
 * Requirements: 4.3, 4.5, 12.1, 12.3, 12.4
 * 
 * Features:
 * - Quick quantity selection with preset buttons
 * - Custom quantity input
 * - Unit-aware display (un vs kg)
 * - Large touch targets (56px min)
 * - Haptic feedback on interactions
 * - Part of 3-touch flow: select → quantity → add
 */
export interface QuantityModalProps {
  product: Product | null
  isOpen: boolean
  onClose: () => void
  onConfirm: (product: Product, quantity: number) => void
}

export function QuantityModal({
  product,
  isOpen,
  onClose,
  onConfirm
}: QuantityModalProps) {
  const [quantity, setQuantity] = useState(1)
  const inputRef = useRef<HTMLInputElement>(null)

  // Reset quantity when product changes
  useEffect(() => {
    if (product) {
      setQuantity(product.default_quantity)
    }
  }, [product])

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.select()
    }
  }, [isOpen])

  if (!isOpen || !product) return null

  const isUnitBased = product.unit === 'un'
  const step = isUnitBased ? 1 : 0.1
  const unitLabel = isUnitBased ? 'un' : product.unit

  // Preset quantities based on unit type
  const presets = isUnitBased
    ? [1, 2, 3, 5, 10]
    : [0.25, 0.5, 1, 1.5, 2]

  const formattedPrice = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(product.price)

  const subtotal = quantity * product.price
  const formattedSubtotal = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(subtotal)

  const handleQuantityChange = (newQuantity: number) => {
    haptics.tap()
    const validQuantity = Math.max(step, Number(newQuantity.toFixed(2)))
    setQuantity(validQuantity)
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value)
    if (!isNaN(value) && value > 0) {
      // Don't trigger haptic on input change to avoid excessive feedback
      const validQuantity = Math.max(step, Number(value.toFixed(2)))
      setQuantity(validQuantity)
    }
  }

  const handleConfirm = () => {
    if (quantity > 0) {
      haptics.success()
      onConfirm(product, quantity)
      onClose()
    }
  }

  const handleClose = () => {
    haptics.tap()
    onClose()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleConfirm()
    } else if (e.key === 'Escape') {
      handleClose()
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50"
      onClick={handleClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="quantity-modal-title"
    >
      <div
        className="w-full max-w-lg bg-white rounded-t-2xl p-6 pb-8 safe-area-bottom animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Product Info */}
        <div className="text-center mb-6">
          <h2 id="quantity-modal-title" className="text-xl font-bold text-gray-800">
            {product.name}
          </h2>
          <p className="text-gray-500">
            {formattedPrice}/{unitLabel}
          </p>
        </div>

        {/* Quantity Input */}
        <div className="flex items-center justify-center gap-4 mb-6">
          <button
            type="button"
            onClick={() => handleQuantityChange(quantity - step)}
            disabled={quantity <= step}
            className="w-14 h-14 flex items-center justify-center rounded-xl bg-gray-100
                       hover:bg-gray-200 active:bg-gray-300 disabled:opacity-50
                       transition-colors"
            aria-label="Diminuir quantidade"
          >
            <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
            </svg>
          </button>

          <div className="flex items-baseline gap-2">
            <input
              ref={inputRef}
              type="number"
              value={quantity}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              step={step}
              min={step}
              className="w-24 h-14 text-center text-2xl font-bold border-2 border-gray-200 rounded-xl
                         focus:border-green-500 focus:ring-2 focus:ring-green-200 focus:outline-none"
              aria-label="Quantidade"
            />
            <span className="text-lg text-gray-500">{unitLabel}</span>
          </div>

          <button
            type="button"
            onClick={() => handleQuantityChange(quantity + step)}
            className="w-14 h-14 flex items-center justify-center rounded-xl bg-gray-100
                       hover:bg-gray-200 active:bg-gray-300 transition-colors"
            aria-label="Aumentar quantidade"
          >
            <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>

        {/* Preset Buttons */}
        <div className="flex justify-center gap-2 mb-6">
          {presets.map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => handleQuantityChange(preset)}
              className={`min-w-[56px] h-11 px-3 rounded-lg font-medium transition-colors
                ${quantity === preset
                  ? 'bg-green-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200 active:bg-gray-300'
                }`}
            >
              {preset} {unitLabel}
            </button>
          ))}
        </div>

        {/* Subtotal */}
        <div className="text-center mb-6 py-3 bg-gray-50 rounded-xl">
          <span className="text-gray-500">Subtotal: </span>
          <span className="text-xl font-bold text-gray-800">{formattedSubtotal}</span>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleClose}
            className="flex-1 h-14 rounded-xl font-semibold text-gray-600 bg-gray-100
                       hover:bg-gray-200 active:bg-gray-300 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="flex-1 h-14 rounded-xl font-semibold text-white bg-green-500
                       hover:bg-green-600 active:bg-green-700 active:scale-[0.98]
                       transition-all"
          >
            Adicionar
          </button>
        </div>
      </div>
    </div>
  )
}
