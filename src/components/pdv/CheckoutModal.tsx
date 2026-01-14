'use client'

import { useState, useEffect } from 'react'
import { Cart } from '@/lib/pdv/pdv.service'
import { SalePaymentMethod } from '@/types'
import { Icons } from '@/components/ui/icons'

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

  useEffect(() => {
    if (isOpen) {
      setPaymentMethod('dinheiro')
      setAmountPaid('')
      setChange(0)
    }
  }, [isOpen])

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

  const paymentMethods: { key: SalePaymentMethod; icon: keyof typeof Icons; label: string }[] = [
    { key: 'dinheiro', icon: 'cash', label: 'Dinheiro' },
    { key: 'pix', icon: 'pix', label: 'Pix' },
    { key: 'cartao', icon: 'card', label: 'Cartão' },
    { key: 'fiado', icon: 'credit', label: 'Fiado' }
  ]

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end justify-center">
      <div className="w-full max-w-lg bg-white rounded-t-3xl animate-slide-up max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-800">Finalizar Venda</h2>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full hover:bg-slate-100 flex items-center justify-center transition-colors"
          >
            <Icons.close className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Total */}
          <div className="text-center bg-slate-50 rounded-2xl p-6">
            <p className="text-slate-500 text-sm mb-1">Total da Venda</p>
            <p className="text-4xl font-bold tracking-tight text-slate-900">{formatCurrency(cart.total)}</p>
            <p className="text-slate-500 text-sm mt-1">{cart.items.length} {cart.items.length === 1 ? 'item' : 'itens'}</p>
          </div>

          {/* Payment Method */}
          <div className="space-y-3">
            <p className="text-sm font-medium text-slate-600">Forma de Pagamento</p>
            <div className="grid grid-cols-4 gap-2">
              {paymentMethods.map(({ key, icon, label }) => {
                const Icon = Icons[icon]
                return (
                  <button
                    key={key}
                    onClick={() => setPaymentMethod(key)}
                    className={`p-3 rounded-xl border-2 transition-all flex flex-col items-center gap-1.5
                      ${paymentMethod === key 
                        ? 'border-emerald-500 bg-emerald-50' 
                        : 'border-slate-200 hover:border-slate-300'
                      }`}
                  >
                    <Icon className={`w-5 h-5 ${paymentMethod === key ? 'text-emerald-600' : 'text-slate-500'}`} />
                    <span className={`text-xs font-medium ${paymentMethod === key ? 'text-emerald-700' : 'text-slate-600'}`}>
                      {label}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Cash Payment */}
          {paymentMethod === 'dinheiro' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-600">Valor Recebido</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-medium">R$</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={amountPaid}
                    onChange={(e) => setAmountPaid(e.target.value)}
                    placeholder="0,00"
                    className="w-full h-14 pl-12 pr-4 text-2xl font-bold text-slate-800 
                               border-2 border-slate-200 rounded-xl 
                               focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20
                               transition-all"
                  />
                </div>
              </div>

              <div className="flex gap-2">
                {quickAmounts.map((amount) => (
                  <button
                    key={amount}
                    onClick={() => setAmountPaid(amount.toString())}
                    className="flex-1 py-2.5 px-3 bg-slate-100 hover:bg-slate-200 rounded-lg 
                               text-slate-700 font-medium transition-colors text-sm"
                  >
                    R$ {amount}
                  </button>
                ))}
              </div>

              {change > 0 && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-center">
                  <p className="text-emerald-600 text-sm mb-1">Troco</p>
                  <p className="text-3xl font-bold text-emerald-700">{formatCurrency(change)}</p>
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
            className={`w-full py-4 rounded-xl font-semibold text-lg transition-all flex items-center justify-center gap-2
              ${canFinalize && !isLoading
                ? 'bg-emerald-600 text-white hover:bg-emerald-700 active:scale-[0.98] shadow-lg shadow-emerald-500/25'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
              }`}
          >
            {isLoading ? (
              <>
                <Icons.loader className="w-5 h-5 animate-spin" />
                Finalizando...
              </>
            ) : (
              <>
                <Icons.check className="w-5 h-5" />
                Confirmar Venda
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
