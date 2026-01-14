'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { Sale, SalePaymentMethod } from '@/types'

interface SaleWithItems extends Sale {
  sale_items: {
    id: string
    quantity: number
    unit_price: number
    subtotal: number
    product: {
      name: string
      unit: string
    }
  }[]
  store_user?: {
    name: string
  }
}

export default function HistoricoVendasPage() {
  const [sales, setSales] = useState<SaleWithItems[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedSale, setSelectedSale] = useState<SaleWithItems | null>(null)
  const [dateFilter, setDateFilter] = useState<'today' | 'week' | 'month'>('today')
  const [totals, setTotals] = useState({ count: 0, total: 0 })

  useEffect(() => {
    loadSales()
  }, [dateFilter])

  async function loadSales() {
    setLoading(true)
    const supabase = createClient()
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.email) return

    const { data: storeUser } = await supabase
      .from('store_users')
      .select('tenant_id')
      .eq('email', user.email.toLowerCase())
      .single()

    if (!storeUser) return

    // Calculate date range
    const now = new Date()
    let startDate = new Date()
    
    if (dateFilter === 'today') {
      startDate.setHours(0, 0, 0, 0)
    } else if (dateFilter === 'week') {
      startDate.setDate(now.getDate() - 7)
    } else {
      startDate.setDate(now.getDate() - 30)
    }

    const { data } = await supabase
      .from('sales')
      .select(`
        *,
        sale_items (
          id,
          quantity,
          unit_price,
          subtotal,
          product:products (name, unit)
        ),
        store_user:store_users (name)
      `)
      .eq('tenant_id', storeUser.tenant_id)
      .gte('created_at', startDate.toISOString())
      .order('created_at', { ascending: false })

    if (data) {
      setSales(data as unknown as SaleWithItems[])
      setTotals({
        count: data.length,
        total: data.reduce((sum, s) => sum + s.total, 0)
      })
    }
    setLoading(false)
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value)
  }

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit'
    })
  }

  const getPaymentIcon = (method: SalePaymentMethod | null) => {
    switch (method) {
      case 'dinheiro': return '💵'
      case 'pix': return '📱'
      case 'cartao': return '💳'
      case 'fiado': return '📝'
      default: return '💰'
    }
  }

  const getPaymentLabel = (method: SalePaymentMethod | null) => {
    switch (method) {
      case 'dinheiro': return 'Dinheiro'
      case 'pix': return 'Pix'
      case 'cartao': return 'Cartão'
      case 'fiado': return 'Fiado'
      default: return '-'
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-4 sticky top-0 z-10">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <Link
            href="/pdv"
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100"
          >
            <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-gray-800">Histórico de Vendas</h1>
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-4 space-y-4">
        {/* Date Filter */}
        <div className="flex gap-2">
          {[
            { key: 'today', label: 'Hoje' },
            { key: 'week', label: '7 dias' },
            { key: 'month', label: '30 dias' }
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setDateFilter(key as typeof dateFilter)}
              className={`flex-1 py-2 px-4 rounded-xl font-medium transition-all
                ${dateFilter === key
                  ? 'bg-green-500 text-white'
                  : 'bg-white text-gray-600 border border-gray-200'
                }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Summary Card */}
        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-2xl p-5 text-white">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-green-100 text-sm">Total do período</p>
              <p className="text-3xl font-bold mt-1">{formatCurrency(totals.total)}</p>
            </div>
            <div className="text-right">
              <p className="text-green-100 text-sm">Vendas</p>
              <p className="text-2xl font-bold mt-1">{totals.count}</p>
            </div>
          </div>
        </div>

        {/* Sales List */}
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full" />
          </div>
        ) : sales.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <span className="text-4xl mb-3 block">📋</span>
            Nenhuma venda no período
          </div>
        ) : (
          <div className="space-y-3">
            {sales.map((sale) => (
              <button
                key={sale.id}
                onClick={() => setSelectedSale(sale)}
                className="w-full bg-white rounded-xl p-4 border border-gray-100 shadow-sm
                           hover:shadow-md transition-shadow text-left"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{getPaymentIcon(sale.payment_method)}</span>
                    <div>
                      <p className="font-semibold text-gray-800">{formatCurrency(sale.total)}</p>
                      <p className="text-sm text-gray-500">
                        {formatDate(sale.created_at)} às {formatTime(sale.created_at)}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-500">{sale.sale_items?.length || 0} itens</p>
                    <svg className="w-5 h-5 text-gray-400 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </main>

      {/* Sale Detail Modal */}
      {selectedSale && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end justify-center">
          <div className="w-full max-w-lg bg-white rounded-t-3xl max-h-[85vh] overflow-y-auto animate-slide-up">
            <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-800">Detalhes da Venda</h2>
              <button
                onClick={() => setSelectedSale(null)}
                className="p-2 hover:bg-gray-100 rounded-full"
              >
                <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Sale Info */}
              <div className="bg-gray-50 rounded-xl p-4 space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-500">Data</span>
                  <span className="font-medium">
                    {new Date(selectedSale.created_at).toLocaleDateString('pt-BR')} às {formatTime(selectedSale.created_at)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Pagamento</span>
                  <span className="font-medium flex items-center gap-2">
                    {getPaymentIcon(selectedSale.payment_method)}
                    {getPaymentLabel(selectedSale.payment_method)}
                  </span>
                </div>
                {selectedSale.store_user && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Vendedor</span>
                    <span className="font-medium">{selectedSale.store_user.name}</span>
                  </div>
                )}
              </div>

              {/* Items */}
              <div>
                <h3 className="font-semibold text-gray-800 mb-3">Itens</h3>
                <div className="space-y-3">
                  {selectedSale.sale_items?.map((item) => (
                    <div key={item.id} className="flex justify-between items-center py-2 border-b border-gray-100">
                      <div>
                        <p className="font-medium text-gray-800">{item.product?.name}</p>
                        <p className="text-sm text-gray-500">
                          {item.quantity} {item.product?.unit} × {formatCurrency(item.unit_price)}
                        </p>
                      </div>
                      <p className="font-semibold text-gray-800">{formatCurrency(item.subtotal)}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Total */}
              <div className="bg-green-50 rounded-xl p-4 flex justify-between items-center">
                <span className="text-lg font-semibold text-green-800">Total</span>
                <span className="text-2xl font-bold text-green-600">{formatCurrency(selectedSale.total)}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
