'use client'

import { Product } from '@/types'
import { haptics } from '@/lib/utils/haptics'

/**
 * ProductSelector - Component for selecting a product for loss registration
 * Requirements: 7.1
 * 
 * Features:
 * - Shows selected product info
 * - Click to open product search
 * - Large touch target (56px min)
 */
export interface ProductSelectorProps {
  product: Product | null
  onClick: () => void
}

export function ProductSelector({ product, onClick }: ProductSelectorProps) {
  const handleClick = () => {
    haptics.tap()
    onClick()
  }

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">
        Produto
      </label>
      <button
        type="button"
        onClick={handleClick}
        className={`
          w-full h-14 px-4 flex items-center justify-between rounded-xl border-2
          transition-colors
          ${product 
            ? 'bg-white border-green-300 text-gray-800' 
            : 'bg-gray-50 border-gray-200 text-gray-400 hover:bg-gray-100'
          }
        `}
      >
        {product ? (
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <span className="text-green-700 font-bold text-sm">
                {product.name.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="text-left">
              <p className="font-medium">{product.name}</p>
              <p className="text-sm text-gray-500">
                SKU: {product.sku} • Estoque: {product.stock} {product.unit}
              </p>
            </div>
          </div>
        ) : (
          <span>Toque para selecionar um produto</span>
        )}
        <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>
    </div>
  )
}
