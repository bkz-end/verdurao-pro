'use client'

import { useState } from 'react'
import { Cart, CartItem } from '@/lib/pdv/pdv.service'
import { Icons } from '@/components/ui/icons'
import { haptics } from '@/lib/utils/haptics'

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
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 p-4 safe-area-bottom">
        <div className="max-w-lg mx-auto text-center text-slate-400 flex items-center justify-center gap-2">
          <Icons.pdv className="w-5 h-5" />
          <span>Selecione produtos para começar</span>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 safe-area-bottom z-50">
      {/* Expanded Cart Items */}
      {isExpanded && (
        <div className="bg-white border-t border-slate-200 shadow-lg max-h-[50vh] overflow-y-auto">
          <div className="max-w-lg mx-auto p-4 space-y-3">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <h3 className="font-semibold text-slate-800">Itens do Carrinho</h3>
              <button
                type="button"
                onClick={onClear}
                className="text-sm text-red-500 hover:text-red-600 font-medium"
              >
                Limpar
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
      <div className="bg-emerald-600 text-white shadow-lg">
        <div className="max-w-lg mx-auto flex items-center">
          <button
            type="button"
            onClick={toggleExpanded}
            className="flex-1 flex items-center gap-3 p-4 min-h-[64px] text-left
                       hover:bg-emerald-700 active:bg-emerald-800 transition-colors"
          >
            <div className="relative">
              <Icons.pdv className="w-6 h-6" />
              <span className="absolute -top-2 -right-2 bg-white text-emerald-600 text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                {itemCount}
              </span>
            </div>

            <div className="flex-1">
              <div className="text-sm text-emerald-100">
                {totalQuantity.toFixed(totalQuantity % 1 === 0 ? 0 : 2)} {totalQuantity === 1 ? 'item' : 'itens'}
              </div>
              <div className="text-lg font-bold">{formattedTotal}</div>
            </div>

            <Icons.chevronRight className={`w-5 h-5 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
          </button>

          <button
            type="button"
            onClick={handleFinalize}
            disabled={isLoading}
            className="min-h-[56px] px-6 m-2 bg-white text-emerald-600 font-semibold rounded-xl
                       hover:bg-emerald-50 active:scale-[0.98]
                       disabled:opacity-50 disabled:cursor-not-allowed
                       transition-all duration-150 flex items-center gap-2"
          >
            {isLoading ? (
              <Icons.loader className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <Icons.check className="w-5 h-5" />
                Finalizar
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

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
      <div className="flex-1 min-w-0">
        <div className="font-medium text-slate-800 truncate">{item.product.name}</div>
        <div className="text-sm text-slate-500">
          {formattedUnitPrice}/{unitDisplay}
        </div>
      </div>

      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={handleDecrease}
          className="w-10 h-10 flex items-center justify-center rounded-lg bg-slate-100
                     hover:bg-slate-200 active:bg-slate-300 transition-colors"
        >
          <Icons.minus className="w-4 h-4 text-slate-600" />
        </button>

        <span className="w-14 text-center font-medium text-slate-800 text-sm">
          {item.quantity.toFixed(item.product.unit === 'un' ? 0 : 2)}
        </span>

        <button
          type="button"
          onClick={handleIncrease}
          className="w-10 h-10 flex items-center justify-center rounded-lg bg-slate-100
                     hover:bg-slate-200 active:bg-slate-300 transition-colors"
        >
          <Icons.plus className="w-4 h-4 text-slate-600" />
        </button>
      </div>

      <div className="w-20 text-right font-semibold text-slate-800">
        {formattedSubtotal}
      </div>

      <button
        type="button"
        onClick={handleRemove}
        className="w-10 h-10 flex items-center justify-center rounded-lg text-red-500
                   hover:bg-red-50 active:bg-red-100 transition-colors"
      >
        <Icons.close className="w-4 h-4" />
      </button>
    </div>
  )
}
