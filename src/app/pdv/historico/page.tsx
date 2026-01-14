'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { Sale, SalePaymentMethod } from '@/types'
import { Icons } from '@/components/ui/icons'

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

type DateFilter = 'today' | 'yesterday' | 'week' | 'month' | 'custom'
type PaymentFilter = 'all' | SalePaymentMethod

export default function HistoricoVendasPage() {
  const [sales, setSales] = useState<SaleWithItems[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedSale, setSelectedSale] = useState<SaleWithItems | null>(null)
  const [dateFilter, setDateFilter] = useState<DateFilter>('today')
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [showFilters, setShowFilters] = useState(false)

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
      .maybeSingle()

    if (!storeUser) return

    const now = new Date()
    let startDate = new Date()
    
    if (dateFilter === 'today') {
      startDate.setHours(0, 0, 0, 0)
    } else if (dateFilter === 'yesterday') {
      startDate.setDate(now.getDate() - 1)
      startDate.setHours(0, 0, 0, 0)
    } else if (dateFilter === 'week') {
      startDate.setDate(now.getDate() - 7)
    } else {
      startDate.setDate(now.getDate() - 30)
    }

    let endDate = new Date()
    if (dateFilter === 'yesterday') {
      endDate = new Date()
      endDate.setHours(0, 0, 0, 0)
    }

    let query = supabase
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

    if (dateFilter === 'yesterday') {
      query = query.lt('created_at', endDate.toISOString())
    }

    const { data } = await query

    if (data) {
      setSales(data as unknown as SaleWithItems[])
    }
    setLoading(false)
  }

  // Filtered sales based on payment method and search
  const filteredSales = useMemo(() => {
    return sales.filter(sale => {
      // Payment filter
      if (paymentFilter !== 'all' && sale.payment_method !== paymentFilter) {
        return false
      }
      // Search filter (by item name or sale ID)
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase()
        const hasMatchingItem = sale.sale_items?.some(item => 
          item.product?.name?.toLowerCase().includes(query)
        )
        const matchesId = sale.id.toLowerCase().includes(query)
        if (!hasMatchingItem && !matchesId) return false
      }
      return true
    })
  }, [sales, paymentFilter, searchQuery])

  // Group sales by date
  const groupedSales = useMemo(() => {
    const groups: { [key: string]: SaleWithItems[] } = {}
    filteredSales.forEach(sale => {
      const date = new Date(sale.created_at).toLocaleDateString('pt-BR')
      if (!groups[date]) groups[date] = []
      groups[date].push(sale)
    })
    return groups
  }, [filteredSales])

  // Stats
  const stats = useMemo(() => {
    const byPayment: { [key: string]: { count: number; total: number } } = {
      dinheiro: { count: 0, total: 0 },
      pix: { count: 0, total: 0 },
      cartao: { count: 0, total: 0 },
      fiado: { count: 0, total: 0 }
    }
    
    let total = 0
    let count = 0
    
    filteredSales.forEach(sale => {
      total += sale.total
      count++
      if (sale.payment_method && byPayment[sale.payment_method]) {
        byPayment[sale.payment_method].count++
        byPayment[sale.payment_method].total += sale.total
      }
    })

    return { total, count, byPayment, average: count > 0 ? total / count : 0 }
  }, [filteredSales])

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
  }

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  }

  const formatDateFull = (dateStr: string) => {
    const date = new Date(dateStr)
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    
    if (date.toDateString() === today.toDateString()) return 'Hoje'
    if (date.toDateString() === yesterday.toDateString()) return 'Ontem'
    return date.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'short' })
  }

  const paymentConfig: { [key: string]: { icon: string; label: string; color: string } } = {
    dinheiro: { icon: '💵', label: 'Dinheiro', color: 'emerald' },
    pix: { icon: '📱', label: 'Pix', color: 'cyan' },
    cartao: { icon: '💳', label: 'Cartão', color: 'violet' },
    fiado: { icon: '📝', label: 'Fiado', color: 'amber' }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-lg mx-auto px-4 py-3">
          <div className="flex items-center gap-3">
            <Link href="/pdv" className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition-colors">
              <Icons.chevronLeft className="w-5 h-5 text-slate-600" />
            </Link>
            <div className="flex-1">
              <h1 className="text-lg font-semibold text-slate-800">Histórico de Vendas</h1>
              <p className="text-xs text-slate-500">{stats.count} vendas · {formatCurrency(stats.total)}</p>
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors
                ${showFilters ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            >
              <Icons.filter className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Filters Panel */}
      {showFilters && (
        <div className="bg-white border-b border-slate-200 px-4 py-4 space-y-4 animate-slide-down">
          <div className="max-w-lg mx-auto space-y-4">
            {/* Search */}
            <div className="relative">
              <Icons.search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar por produto..."
                className="w-full h-11 pl-10 pr-4 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>

            {/* Payment Filter */}
            <div>
              <p className="text-xs font-medium text-slate-500 mb-2">Forma de Pagamento</p>
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={() => setPaymentFilter('all')}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all
                    ${paymentFilter === 'all' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600'}`}
                >
                  Todos
                </button>
                {Object.entries(paymentConfig).map(([key, config]) => (
                  <button
                    key={key}
                    onClick={() => setPaymentFilter(key as PaymentFilter)}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all flex items-center gap-1.5
                      ${paymentFilter === key ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600'}`}
                  >
                    <span>{config.icon}</span>
                    {config.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Date Filter Pills */}
      <div className="bg-white border-b border-slate-100 px-4 py-3 sticky top-[60px] z-10">
        <div className="max-w-lg mx-auto flex gap-2 overflow-x-auto no-scrollbar">
          {[
            { key: 'today', label: 'Hoje' },
            { key: 'yesterday', label: 'Ontem' },
            { key: 'week', label: '7 dias' },
            { key: 'month', label: '30 dias' }
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setDateFilter(key as DateFilter)}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all
                ${dateFilter === key
                  ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/25'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="max-w-lg mx-auto px-4 py-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl p-4 text-white">
            <p className="text-emerald-100 text-xs font-medium">Total</p>
            <p className="text-2xl font-bold tracking-tight">{formatCurrency(stats.total)}</p>
            <p className="text-emerald-100 text-xs mt-1">{stats.count} vendas</p>
          </div>
          <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
            <p className="text-slate-500 text-xs font-medium">Ticket Médio</p>
            <p className="text-2xl font-bold text-slate-800 tracking-tight">{formatCurrency(stats.average)}</p>
            <p className="text-slate-400 text-xs mt-1">por venda</p>
          </div>
        </div>

        {/* Payment Breakdown */}
        <div className="mt-3 bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
          <p className="text-xs font-medium text-slate-500 mb-3">Por Forma de Pagamento</p>
          <div className="grid grid-cols-4 gap-2">
            {Object.entries(paymentConfig).map(([key, config]) => {
              const data = stats.byPayment[key]
              return (
                <div key={key} className="text-center">
                  <div className="text-xl mb-1">{config.icon}</div>
                  <p className="text-sm font-bold text-slate-800">{data.count}</p>
                  <p className="text-xs text-slate-500">{formatCurrency(data.total)}</p>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Sales List */}
      <main className="max-w-lg mx-auto px-4 pb-8">
        {loading ? (
          <div className="flex justify-center py-12">
            <Icons.loader className="w-8 h-8 text-emerald-600 animate-spin" />
          </div>
        ) : filteredSales.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Icons.transactions className="w-8 h-8 text-slate-400" />
            </div>
            <p className="text-slate-500 font-medium">Nenhuma venda encontrada</p>
            <p className="text-slate-400 text-sm mt-1">Tente ajustar os filtros</p>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(groupedSales).map(([date, daySales]) => (
              <div key={date}>
                <div className="flex items-center gap-2 mb-3">
                  <h2 className="text-sm font-semibold text-slate-800 capitalize">
                    {formatDateFull(daySales[0].created_at)}
                  </h2>
                  <div className="flex-1 h-px bg-slate-200" />
                  <span className="text-xs text-slate-500">
                    {daySales.length} vendas · {formatCurrency(daySales.reduce((s, v) => s + v.total, 0))}
                  </span>
                </div>
                <div className="space-y-2">
                  {daySales.map((sale) => {
                    const config = paymentConfig[sale.payment_method || 'dinheiro']
                    return (
                      <button
                        key={sale.id}
                        onClick={() => setSelectedSale(sale)}
                        className="w-full bg-white rounded-xl p-4 border border-slate-100 shadow-sm hover:shadow-md hover:border-slate-200 transition-all text-left group"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-xl bg-slate-50 flex items-center justify-center text-2xl group-hover:scale-105 transition-transform">
                            {config?.icon || '💰'}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <p className="font-bold text-slate-800">{formatCurrency(sale.total)}</p>
                              <p className="text-sm text-slate-500">{formatTime(sale.created_at)}</p>
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-xs text-slate-500">
                                {sale.sale_items?.length || 0} {sale.sale_items?.length === 1 ? 'item' : 'itens'}
                              </span>
                              {sale.store_user?.name && (
                                <>
                                  <span className="text-slate-300">·</span>
                                  <span className="text-xs text-slate-500 truncate">{sale.store_user.name}</span>
                                </>
                              )}
                            </div>
                          </div>
                          <Icons.chevronRight className="w-5 h-5 text-slate-300 group-hover:text-slate-400 transition-colors" />
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Sale Detail Modal */}
      {selectedSale && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end justify-center" onClick={() => setSelectedSale(null)}>
          <div 
            className="w-full max-w-lg bg-white rounded-t-3xl max-h-[90vh] overflow-hidden animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="sticky top-0 bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-800">Detalhes da Venda</h2>
                <p className="text-sm text-slate-500">#{selectedSale.id.slice(0, 8)}</p>
              </div>
              <button
                onClick={() => setSelectedSale(null)}
                className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition-colors"
              >
                <Icons.close className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            <div className="overflow-y-auto max-h-[calc(90vh-80px)]">
              <div className="p-6 space-y-6">
                {/* Total Card */}
                <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl p-5 text-white text-center">
                  <p className="text-emerald-100 text-sm">Total da Venda</p>
                  <p className="text-4xl font-bold tracking-tight mt-1">{formatCurrency(selectedSale.total)}</p>
                </div>

                {/* Sale Info */}
                <div className="bg-slate-50 rounded-xl p-4 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 text-sm">Data e Hora</span>
                    <span className="font-medium text-slate-800">
                      {new Date(selectedSale.created_at).toLocaleDateString('pt-BR')} às {formatTime(selectedSale.created_at)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 text-sm">Pagamento</span>
                    <span className="font-medium text-slate-800 flex items-center gap-2">
                      {paymentConfig[selectedSale.payment_method || 'dinheiro']?.icon}
                      {paymentConfig[selectedSale.payment_method || 'dinheiro']?.label}
                    </span>
                  </div>
                  {selectedSale.store_user && (
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500 text-sm">Vendedor</span>
                      <span className="font-medium text-slate-800">{selectedSale.store_user.name}</span>
                    </div>
                  )}
                </div>

                {/* Items */}
                <div>
                  <h3 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
                    <Icons.stock className="w-5 h-5 text-slate-400" />
                    Itens ({selectedSale.sale_items?.length || 0})
                  </h3>
                  <div className="bg-white rounded-xl border border-slate-100 divide-y divide-slate-100">
                    {selectedSale.sale_items?.map((item) => (
                      <div key={item.id} className="p-4 flex items-center justify-between">
                        <div className="flex-1">
                          <p className="font-medium text-slate-800">{item.product?.name}</p>
                          <p className="text-sm text-slate-500">
                            {item.quantity} {item.product?.unit} × {formatCurrency(item.unit_price)}
                          </p>
                        </div>
                        <p className="font-bold text-slate-800">{formatCurrency(item.subtotal)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        @keyframes slide-up { from { transform: translateY(100%); } to { transform: translateY(0); } }
        @keyframes slide-down { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }
        .animate-slide-up { animation: slide-up 0.3s ease-out; }
        .animate-slide-down { animation: slide-down 0.2s ease-out; }
      `}</style>
    </div>
  )
}
