'use client'

import { useState, useCallback } from 'react'
import { Product } from '@/types'
import { SearchBar } from '@/components/pdv/SearchBar'
import { haptics } from '@/lib/utils/haptics'

/**
 * ProductSearchModal - Modal for searching and selecting a product
 * Requirements: 7.1
 * 
 * Features:
 * - Search products by name or SKU
 * - Shows stock info for each product
 * - Large touch targets (56px min)
 */
export interface ProductSearchModalProps {
  isOpen: boolean
  products: Product[]
  onSelect: (product: Product) => void
  onClose: () => void
}

export function ProductSearchModal({
  isOpen,
  products,
  onSelect,
  onClose
}: ProductSearchModalProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [filteredProducts, setFilteredProducts] = useState<Product[]>(products)

  const handleSearch = useCallback((query: string) => {
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

  const handleSelect = (product: Product) => {
    haptics.tap()
    onSelect(product)
    setSearchQuery('')
    setFilteredProducts(products)
  }

  const handleClose = () => {
    haptics.tap()
    setSearchQuery('')
    setFilteredProducts(products)
    onClose()
  }

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-white"
      role="dialog"
      aria-modal="true"
      aria-labelledby="product-search-title"
    >
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b border-gray-200">
        <button
          type="button"
          onClick={handleClose}
          className="w-10 h-10 flex items-center justify-center rounded-full
                     hover:bg-gray-100 active:bg-gray-200 transition-colors"
          aria-label="Fechar"
        >
          <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        <h2 id="product-search-title" className="text-lg font-semibold text-gray-800">
          Selecionar Produto
        </h2>
      </div>

      {/* Search */}
      <div className="p-4">
        <SearchBar
          value={searchQuery}
          onChange={setSearchQuery}
          onSearch={handleSearch}
          placeholder="Buscar por nome ou código..."
          autoFocus={true}
        />
      </div>

      {/* Product List */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {filteredProducts.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            Nenhum produto encontrado
          </div>
        ) : (
          <div className="space-y-2">
            {filteredProducts.map((product) => (
              <button
                key={product.id}
                type="button"
                onClick={() => handleSelect(product)}
                disabled={product.stock <= 0}
                className={`
                  w-full h-16 px-4 flex items-center gap-3 rounded-xl border-2
                  transition-colors text-left
                  ${product.stock <= 0
                    ? 'bg-gray-50 border-gray-200 opacity-50 cursor-not-allowed'
                    : 'bg-white border-gray-200 hover:border-green-300 hover:bg-green-50'
                  }
                `}
              >
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <span className="text-green-700 font-bold">
                    {product.name.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-800 truncate">{product.name}</p>
                  <p className="text-sm text-gray-500">
                    SKU: {product.sku}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className={`font-medium ${product.stock <= 0 ? 'text-red-600' : 'text-gray-800'}`}>
                    {product.stock} {product.unit}
                  </p>
                  <p className="text-sm text-gray-500">em estoque</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
