'use client'

import { useState, useEffect } from 'react'
import { Cart } from '@/lib/pdv/pdv.service'
import { SalePaymentMethod } from '@/types'

interface CheckoutModalProps {
  cart: Cart
  isOpen: boolean
  isLoading: boolean
  onClose: () => void
  onConfirm: (paymentMethod: SalePaymentMethod, amountPaid?: number) => void
}

export function CheckoutModal({ cart, isOpen, isLoading, onClose, onConfirm }: CheckoutModalProps) {
  const [paymentMethod, setPaymentMethod] = useState<SalePaymentMethod>('dinheiro')
  const [amountPaid, setAmountPaid] = useState('')
  const [change, setChange] = useState(0)

  // Reset when modal opens
  useEffect(() => {
    if (isOpen) {
      setPaymentMethod('dinheiro')
      setAmountPaid('')
      setChange(0)
    }
  }, [isOpen])

  // Calculate change
  useEffect(() => {
    if (paymentMethod === 'dinheiro' && amountPaid) {
      const paid = parseFloat(amountPaid.replace(',', '.'))
      if (!isNaN(paid) && paid >= cart.total) {
        setChange(paid - cart.total)
      } else {
        setChange(0)
      }
    } else {
      setChange(0)
    }
  }, [amountPaid, cart.total, paymentMethod])

  if (!isOpen) return null

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value)
  }

  const canFinalize = paymentMethod !== 'dinheiro' || 
    (amountPaid && parseFloat(amountPaid.replace(',', '.')) >= cart.total)

  const handleConfirm = () => {
    const paid = paymentMethod === 'dinheiro' ? parseFloat(amountPaid.replace(',', '.')) : undefined
    onConfirm(paymentMethod, paid)
  }

  const quickAmounts = [10, 20, 50, 100]

  const paymentMethods = [
    { key: 'dinheiro' as const, icon: '💵', label: 'Dinheiro' },
    { key: 'pix' as const, icon: '📱', label: 'Pix' },
    { key: 'cartao' as const, icon: '💳', label: 'Cartão' },
    { key: 'fiado' as const, icon: '📝', label: 'Fiado' }
  ]

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end justify-center">
      <div className="w-full max-w-lg bg-white rounded-t-3xl animate-slide-up max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-800">Finalizar Venda</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Total */}
          <div className="text-center bg-gray-50 rounded-2xl p-6">
            <p className="text-gray-500 text-sm mb-1">Total da Venda</p>
            <p className="text-4xl font-bold text-gray-800">{formatCurrency(cart.total)}</p>
            <p className="text-gray-500 text-sm mt-1">{cart.items.length} {cart.items.length === 1 ? 'item' : 'itens'}</p>
          </div>

          {/* Payment Method */}
          <div className="space-y-3">
            <p className="font-semibold text-gray-700">Forma de Pagamento</p>
            <div className="grid grid-cols-4 gap-2">
              {paymentMethods.map(({ key, icon, label }) => (
                <button
                  key={key}
                  onClick={() => setPaymentMethod(key)}
                  className={`p-3 rounded-xl border-2 transition-all flex flex-col items-center gap-1
                    ${paymentMethod === key 
                      ? 'border-green-500 bg-green-50' 
                      : 'border-gray-200 hover:border-gray-300'
                    }`}
                >
                  <span className="text-xl">{icon}</span>
                  <span className={`text-xs font-medium ${paymentMethod === key ? 'text-green-700' : 'text-gray-600'}`}>
                    {label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Cash Payment - Amount and Change */}
          {paymentMethod === 'dinheiro' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="font-semibold text-gray-700">Valor Recebido</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">R$</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={amountPaid}
                    onChange={(e) => setAmountPaid(e.target.value)}
                    placeholder="0,00"
                    className="w-full h-14 pl-12 pr-4 text-2xl font-bold text-gray-800 border-2 border-gray-200 rounded-xl focus:border-gray-400 focus:outline-none"
                  />
                </div>
              </div>

              {/* Quick Amount Buttons */}
              <div className="flex gap-2">
                {quickAmounts.map((amount) => (
                  <button
                    key={amount}
                    onClick={() => setAmountPaid(amount.toString())}
                    className="flex-1 py-2 px-3 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700 font-medium transition-colors"
                  >
                    R$ {amount}
                  </button>
                ))}
              </div>

              {/* Change Display */}
              {change > 0 && (
                <div className="bg-green-50 border-2 border-green-200 rounded-xl p-4 text-center">
                  <p className="text-green-600 text-sm mb-1">Troco</p>
                  <p className="text-3xl font-bold text-green-700">{formatCurrency(change)}</p>
                </div>
              )}

              {amountPaid && parseFloat(amountPaid.replace(',', '.')) < cart.total && (
                <p className="text-red-500 text-sm text-center">
                  Valor insuficiente. Faltam {formatCurrency(cart.total - parseFloat(amountPaid.replace(',', '.')))}
                </p>
              )}
            </div>
          )}

          {/* Confirm Button */}
          <button
            onClick={handleConfirm}
            disabled={!canFinalize || isLoading}
            className={`w-full py-4 rounded-xl font-bold text-lg transition-all
              ${canFinalize && !isLoading
                ? 'bg-green-600 text-white hover:bg-green-700 active:scale-[0.98]'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Finalizando...
              </span>
            ) : (
              `✓ Confirmar Venda`
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
