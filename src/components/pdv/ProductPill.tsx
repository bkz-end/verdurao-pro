'use client'

import { Product } from '@/types'
import { haptics } from '@/lib/utils/haptics'

/**
 * ProductPill - Quick selection button for frequent products
 * Requirements: 4.1, 4.6, 12.1, 12.3, 12.4
 * 
 * Features:
 * - Minimum 56px height for WCAG AAA touch target compliance
 * - Thumb-accessible positioning
 * - Visual feedback on touch
 * - Haptic feedback on selection
 * - Displays product name and price
 */
export interface ProductPillProps {
  product: Product
  onSelect: (product: Product) => void
  isSelected?: boolean
  disabled?: boolean
}

export function ProductPill({
  product,
  onSelect,
  isSelected = false,
  disabled = false
}: ProductPillProps) {
  const handleClick = () => {
    if (!disabled) {
      // Trigger haptic feedback on selection
      haptics.select()
      onSelect(product)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.key === 'Enter' || e.key === ' ') && !disabled) {
      e.preventDefault()
      haptics.tap()
      onSelect(product)
    }
  }

  // Format price in BRL
  const formattedPrice = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(product.price)

  // Format unit display
  const unitDisplay = product.unit === 'un' ? '/un' : `/${product.unit}`

  // Determine if out of stock
  const isOutOfStock = product.stock <= 0

  return (
    <button
      type="button"
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      disabled={disabled || isOutOfStock}
      className={`
        min-h-[56px] px-4 py-3 rounded-xl font-medium text-left
        transition-all duration-150 ease-out
        flex flex-col justify-center
        ${isSelected
          ? 'bg-green-500 text-white shadow-lg scale-[1.02]'
          : isOutOfStock
            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
            : 'bg-white border-2 border-gray-200 text-gray-800 hover:border-green-400 hover:shadow-md active:scale-[0.98] active:bg-green-50'
        }
      `}
      aria-label={`${product.name}, ${formattedPrice}${unitDisplay}${isOutOfStock ? ', sem estoque' : ''}`}
      aria-pressed={isSelected}
      aria-disabled={disabled || isOutOfStock}
    >
      <span className="text-sm font-semibold truncate max-w-full">
        {product.name}
      </span>
      <span className={`text-xs ${isSelected ? 'text-green-100' : 'text-gray-500'}`}>
        {formattedPrice}{unitDisplay}
        {isOutOfStock && <span className="ml-2 text-red-400">(sem estoque)</span>}
      </span>
    </button>
  )
}

/**
 * ProductPillGrid - Grid layout for ProductPill components
 * Requirements: 12.1
 * 
 * Responsive grid that adapts to screen size while maintaining
 * thumb-accessible touch targets
 */
export interface ProductPillGridProps {
  products: Product[]
  onSelect: (product: Product) => void
  selectedProductId?: string
  title?: string
  emptyMessage?: string
}

export function ProductPillGrid({
  products,
  onSelect,
  selectedProductId,
  title,
  emptyMessage = 'Nenhum produto encontrado'
}: ProductPillGridProps) {
  if (products.length === 0) {
    return (
      <div className="py-8 text-center text-gray-400">
        {emptyMessage}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {title && (
        <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide">
          {title}
        </h3>
      )}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {products.map((product) => (
          <ProductPill
            key={product.id}
            product={product}
            onSelect={onSelect}
            isSelected={product.id === selectedProductId}
          />
        ))}
      </div>
    </div>
  )
}
