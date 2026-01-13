'use client'

import { useState, useRef, useEffect } from 'react'
import { Product } from '@/types'
import { haptics } from '@/lib/utils/haptics'

/**
 * LossQuantityInput - Input for loss quantity with product context
 * Requirements: 7.1, 12.1
 * 
 * Features:
 * - Shows current stock for reference
 * - Validates quantity doesn't exceed stock
 * - Large touch targets (56px min)
 * - Haptic feedback on interactions
 */
export interface LossQuantityInputProps {
  product: Product | null
  value: number
  onChange: (quantity: number) => void
  error?: string
}

export function LossQuantityInput({
  product,
  value,
  onChange,
  error
}: LossQuantityInputProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [localValue, setLocalValue] = useState(value.toString())

  useEffect(() => {
    setLocalValue(value.toString())
  }, [value])

  if (!product) {
    return (
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">
          Quantidade
        </label>
        <div className="h-14 flex items-center justify-center bg-gray-100 rounded-xl text-gray-400">
          Selecione um produto primeiro
        </div>
      </div>
    )
  }

  const isUnitBased = product.unit === 'un'
  const step = isUnitBased ? 1 : 0.1
  const unitLabel = isUnitBased ? 'un' : product.unit
  const maxQuantity = product.stock

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value
    setLocalValue(inputValue)
    
    const numValue = parseFloat(inputValue)
    if (!isNaN(numValue) && numValue >= 0) {
      onChange(Math.min(numValue, maxQuantity))
    }
  }

  const handleIncrement = () => {
    haptics.tap()
    const newValue = Math.min(value + step, maxQuantity)
    onChange(Number(newValue.toFixed(2)))
  }

  const handleDecrement = () => {
    haptics.tap()
    const newValue = Math.max(value - step, step)
    onChange(Number(newValue.toFixed(2)))
  }

  const handleBlur = () => {
    // Normalize value on blur
    const numValue = parseFloat(localValue)
    if (isNaN(numValue) || numValue <= 0) {
      setLocalValue(step.toString())
      onChange(step)
    } else {
      const normalized = Math.min(numValue, maxQuantity)
      setLocalValue(normalized.toString())
      onChange(Number(normalized.toFixed(2)))
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <label className="block text-sm font-medium text-gray-700">
          Quantidade
        </label>
        <span className="text-sm text-gray-500">
          Estoque: {product.stock} {unitLabel}
        </span>
      </div>
      
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleDecrement}
          disabled={value <= step}
          className="w-14 h-14 flex items-center justify-center rounded-xl bg-gray-100
                     hover:bg-gray-200 active:bg-gray-300 disabled:opacity-50
                     transition-colors"
          aria-label="Diminuir quantidade"
        >
          <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
          </svg>
        </button>

        <div className="flex-1 flex items-center gap-2">
          <input
            ref={inputRef}
            type="number"
            value={localValue}
            onChange={handleChange}
            onBlur={handleBlur}
            step={step}
            min={step}
            max={maxQuantity}
            className={`
              w-full h-14 text-center text-xl font-bold border-2 rounded-xl
              focus:ring-2 focus:outline-none transition-colors
              ${error 
                ? 'border-red-300 focus:border-red-500 focus:ring-red-200' 
                : 'border-gray-200 focus:border-green-500 focus:ring-green-200'
              }
            `}
            aria-label="Quantidade de perda"
          />
          <span className="text-lg text-gray-500 min-w-[40px]">{unitLabel}</span>
        </div>

        <button
          type="button"
          onClick={handleIncrement}
          disabled={value >= maxQuantity}
          className="w-14 h-14 flex items-center justify-center rounded-xl bg-gray-100
                     hover:bg-gray-200 active:bg-gray-300 disabled:opacity-50
                     transition-colors"
          aria-label="Aumentar quantidade"
        >
          <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </div>

      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}
    </div>
  )
}
