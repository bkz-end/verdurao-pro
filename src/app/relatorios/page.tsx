'use client'

import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ReportService, SalesReport, MostSoldProduct, ProductProfitMargin, ReportPeriod, ProductSalesData } from '@/lib/reports'
import { Product, SalePaymentMethod } from '@/types'
import { Icons } from '@/components/ui/icons'
import { BottomNav } from '@/components/ui/bottom-nav'
import Link from 'next/link'

interface DashboardData {
  today: SalesReport
  week: SalesReport
  month: SalesReport
  mostSoldToday: MostSoldProduct | null
  mostSoldWeek: MostSoldProduct | null
  mostSoldMonth: MostSoldProduct | null
  topProducts: ProductSalesData[]
  outOfStock: Product[]
  profitMargins: ProductProfitMargin[]
  salesByPayment: { method: SalePaymentMethod; count: number; total: number }[]
  salesByHour: { hour: number; count: number; total: number }[]
}

type TabType = 'overview' | 'products' | 'analysis'

export default function RelatoriosPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedPeriod, setSelectedPeriod] = useState<ReportPeriod>('day')
  const [activeTab, setActiveTab] = useState<TabType>('overview')
  const [tenantId, setTenantId] = useState<string | null>(null)

  useEffect(() => { loadTenantAndData() }, [])
  useEffect(() => { if (tenantId) loadDashboardData(tenantId) }, [selectedPeriod, tenantId])

  async function loadTenantAndData() {
    try {
      setLoading(true)
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setError('Usuário não autenticado'); return }
      const { data: storeUser } = await supabase
        .from('store_users').select('tenant_id').eq('email', user.email).single()
      if (!storeUser) { setError('Usuário não vinculado'); return }
      setTenantId(storeUser.tenant_id)
      await loadDashboardData(storeUser.tenant_id)
    } catch (err) { setError(err instanceof Error ? err.message : 'Erro') }
    finally { setLoading(false) }
  }

  async function loadDashboardData(tid: string) {
    try {
      const supabase = createClient()
      const reportService = new ReportService(supabase)
      
      const [dashboardReport, mostSoldWeek, mostSoldMonth, topProducts, profitMargins] = await Promise.all([
        reportService.getDashboardReport(tid),
        reportService.getMostSoldProduct(tid, 'week'),
        reportService.getMostSoldProduct(tid, 'month'),
        reportService.getTopSellingProducts(tid, selectedPeriod, 10),
        reportService.getProductProfitMargins(tid)
      ])

      // Get sales by payment method
      const now = new Date()
      let startDate = new Date()
      if (selectedPeriod === 'day') startDate.setHours(0, 0, 0, 0)
      else if (selectedPeriod === 'week') startDate.setDate(now.getDate() - 7)
      else startDate.setDate(now.getDate() - 30)

      const { data: salesData } = await supabase
        .from('sales')
        .select('payment_method, total, created_at')
        .eq('tenant_id', tid)
        .gte('created_at', startDate.toISOString())

      const byPayment: { [key: string]: { count: number; total: number } } = {}
      const byHour: { [key: number]: { count: number; total: number } } = {}
      
      salesData?.forEach(sale => {
        const method = sale.payment_method || 'dinheiro'
        if (!byPayment[method]) byPayment[method] = { count: 0, total: 0 }
        byPayment[method].count++
        byPayment[method].total += sale.total

        const hour = new Date(sale.created_at).getHours()
        if (!byHour[hour]) byHour[hour] = { count: 0, total: 0 }
        byHour[hour].count++
        byHour[hour].total += sale.total
      })

      setData({
        ...dashboardReport,
        mostSoldWeek,
        mostSoldMonth,
        topProducts,
        profitMargins,
        salesByPayment: Object.entries(byPayment).map(([method, data]) => ({
          method: method as SalePaymentMethod, ...data
        })),
        salesByHour: Object.entries(byHour).map(([hour, data]) => ({
          hour: parseInt(hour), ...data
        })).sort((a, b) => a.hour - b.hour)
      })
    } catch (err) { setError(err instanceof Error ? err.message : 'Erro') }
  }

  const formatCurrency = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
  
  const currentReport = selectedPeriod === 'day' ? data?.today : selectedPeriod === 'week' ? data?.week : data?.month
  const currentMostSold = selectedPeriod === 'day' ? data?.mostSoldToday : selectedPeriod === 'week' ? data?.mostSoldWeek : data?.mostSoldMonth

  const paymentConfig: { [key: string]: { icon: string; label: string; color: string } } = {
    dinheiro: { icon: '💵', label: 'Dinheiro', color: 'emerald' },
    pix: { icon: '📱', label: 'Pix', color: 'cyan' },
    cartao: { icon: '💳', label: 'Cartão', color: 'violet' },
    fiado: { icon: '📝', label: 'Fiado', color: 'amber' }
  }

  // Calculate comparison with previous period
  const comparison = useMemo(() => {
    if (!data) return null
    const current = selectedPeriod === 'day' ? data.today : selectedPeriod === 'week' ? data.week : data.month
    const previous = selectedPeriod === 'day' ? data.week : selectedPeriod === 'week' ? data.month : data.month
    if (!previous.totalRevenue) return null
    const change = ((current.totalRevenue - previous.totalRevenue / (selectedPeriod === 'day' ? 7 : selectedPeriod === 'week' ? 4 : 1)) / (previous.totalRevenue / (selectedPeriod === 'day' ? 7 : selectedPeriod === 'week' ? 4 : 1))) * 100
    return { value: change, isPositive: change >= 0 }
  }, [data, selectedPeriod])

  if (loading) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <Icons.loader className="w-8 h-8 text-emerald-600 animate-spin" />
    </div>
  )

  if (error) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="text-center"><Icons.losses className="w-12 h-12 text-red-400 mx-auto mb-3" /><p className="text-red-600">{error}</p></div>
    </div>
  )

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-lg mx-auto px-4 py-3">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition-colors">
              <Icons.chevronLeft className="w-5 h-5 text-slate-600" />
            </Link>
            <div className="flex-1">
              <h1 className="text-lg font-semibold text-slate-800">Relatórios</h1>
              <p className="text-xs text-slate-500">Análise de vendas e produtos</p>
            </div>
            <Link href="/pdv/historico" className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition-colors">
              <Icons.transactions className="w-5 h-5 text-slate-600" />
            </Link>
          </div>
        </div>
      </header>

      {/* Period Filter */}
      <div className="bg-white border-b border-slate-100 px-4 py-3 sticky top-[60px] z-10">
        <div className="max-w-lg mx-auto flex gap-2">
          {[
            { value: 'day' as const, label: 'Hoje' },
            { value: 'week' as const, label: '7 dias' },
            { value: 'month' as const, label: '30 dias' }
          ].map(period => (
            <button
              key={period.value}
              onClick={() => setSelectedPeriod(period.value)}
              className={`flex-1 py-2.5 px-4 rounded-xl font-medium transition-all text-sm
                ${selectedPeriod === period.value
                  ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/25'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
            >
              {period.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-slate-100 px-4">
        <div className="max-w-lg mx-auto flex">
          {[
            { key: 'overview' as const, label: 'Visão Geral', icon: Icons.reports },
            { key: 'products' as const, label: 'Produtos', icon: Icons.stock },
            { key: 'analysis' as const, label: 'Análise', icon: Icons.trendUp }
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors flex items-center justify-center gap-1.5
                ${activeTab === tab.key
                  ? 'border-emerald-600 text-emerald-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <main className="max-w-lg mx-auto px-4 py-6 space-y-6">
        {activeTab === 'overview' && (
          <>
            {/* Main Stats Card */}
            <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl p-5 text-white">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="text-emerald-100 text-sm">Receita Total</p>
                  <p className="text-3xl font-bold tracking-tight">{formatCurrency(currentReport?.totalRevenue || 0)}</p>
                  {comparison && (
                    <div className={`flex items-center gap-1 mt-1 text-sm ${comparison.isPositive ? 'text-emerald-100' : 'text-red-200'}`}>
                      {comparison.isPositive ? <Icons.trendUp className="w-4 h-4" /> : <Icons.trendDown className="w-4 h-4" />}
                      <span>{comparison.isPositive ? '+' : ''}{comparison.value.toFixed(0)}% vs período anterior</span>
                    </div>
                  )}
                </div>
                <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center">
                  <Icons.dollar className="w-7 h-7" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4 pt-4 border-t border-white/20">
                <div>
                  <p className="text-emerald-100 text-xs">Vendas</p>
                  <p className="text-xl font-bold">{currentReport?.totalSales || 0}</p>
                </div>
                <div>
                  <p className="text-emerald-100 text-xs">Ticket Médio</p>
                  <p className="text-xl font-bold">{formatCurrency(currentReport?.averageTicket || 0)}</p>
                </div>
                <div>
                  <p className="text-emerald-100 text-xs">Itens</p>
                  <p className="text-xl font-bold">{currentReport?.totalItems || 0}</p>
                </div>
              </div>
            </div>

            {/* Payment Methods */}
            {data?.salesByPayment && data.salesByPayment.length > 0 && (
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                <h2 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
                  <Icons.wallet className="w-5 h-5 text-slate-400" />
                  Formas de Pagamento
                </h2>
                <div className="space-y-3">
                  {data.salesByPayment.sort((a, b) => b.total - a.total).map(item => {
                    const config = paymentConfig[item.method]
                    const percentage = currentReport?.totalRevenue ? (item.total / currentReport.totalRevenue) * 100 : 0
                    return (
                      <div key={item.method}>
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <span className="text-lg">{config?.icon}</span>
                            <span className="text-sm font-medium text-slate-700">{config?.label}</span>
                          </div>
                          <div className="text-right">
                            <span className="text-sm font-bold text-slate-800">{formatCurrency(item.total)}</span>
                            <span className="text-xs text-slate-500 ml-2">({item.count})</span>
                          </div>
                        </div>
                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${percentage}%` }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Most Sold */}
            {currentMostSold && (
              <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl border border-amber-200 p-5">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-2xl">🏆</span>
                  <h2 className="font-semibold text-amber-800">Campeão de Vendas</h2>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-bold text-slate-800 text-lg">{currentMostSold.product.name}</p>
                    <p className="text-sm text-slate-500">SKU: {currentMostSold.product.sku}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-emerald-600">{currentMostSold.totalQuantity}</p>
                    <p className="text-sm text-slate-500">{currentMostSold.product.unit} vendidos</p>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {activeTab === 'products' && (
          <>
            {/* Top Products */}
            {data?.topProducts && data.topProducts.length > 0 && (
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                  <h2 className="font-semibold text-slate-800 flex items-center gap-2">
                    <Icons.trendUp className="w-5 h-5 text-emerald-500" />
                    Top 10 Produtos
                  </h2>
                  <span className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded-full">
                    {selectedPeriod === 'day' ? 'Hoje' : selectedPeriod === 'week' ? '7 dias' : '30 dias'}
                  </span>
                </div>
                <div className="divide-y divide-slate-100">
                  {data.topProducts.map((product, index) => (
                    <div key={product.productId} className="px-5 py-4 flex items-center gap-3">
                      <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold
                        ${index === 0 ? 'bg-amber-100 text-amber-700' :
                          index === 1 ? 'bg-slate-200 text-slate-600' :
                          index === 2 ? 'bg-orange-100 text-orange-700' :
                          'bg-slate-50 text-slate-400'
                        }`}>
                        {index + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-slate-800 truncate">{product.productName}</p>
                        <p className="text-xs text-slate-500">{product.totalQuantity.toFixed(1)} unidades</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-slate-800">{formatCurrency(product.totalRevenue)}</p>
                        <p className="text-xs text-slate-500">{product.salesCount} vendas</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Out of Stock */}
            {data?.outOfStock && data.outOfStock.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-2xl overflow-hidden">
                <div className="px-5 py-4 border-b border-red-200 flex items-center gap-2">
                  <Icons.losses className="w-5 h-5 text-red-500" />
                  <h2 className="font-semibold text-red-800">Produtos em Falta ({data.outOfStock.length})</h2>
                </div>
                <div className="divide-y divide-red-100 max-h-64 overflow-y-auto">
                  {data.outOfStock.map(product => (
                    <div key={product.id} className="px-5 py-3 flex items-center justify-between">
                      <div>
                        <p className="font-medium text-red-800">{product.name}</p>
                        <p className="text-sm text-red-600">SKU: {product.sku}</p>
                      </div>
                      <Link href="/estoque" className="px-3 py-1.5 bg-red-100 text-red-700 rounded-full text-xs font-medium hover:bg-red-200 transition-colors">
                        Repor
                      </Link>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Profit Margins */}
            {data?.profitMargins && data.profitMargins.length > 0 && (
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
                  <Icons.dollar className="w-5 h-5 text-emerald-500" />
                  <h2 className="font-semibold text-slate-800">Margem de Lucro</h2>
                </div>
                <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
                  {data.profitMargins.map(margin => (
                    <div key={margin.productId} className="px-5 py-3 flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-slate-800 truncate">{margin.productName}</p>
                        <p className="text-xs text-slate-500">
                          Custo: {formatCurrency(margin.costPrice)} → Venda: {formatCurrency(margin.price)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 ml-3">
                        <span className="text-sm font-medium text-slate-600">{formatCurrency(margin.profit)}</span>
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold
                          ${margin.profitMargin >= 30 ? 'bg-emerald-100 text-emerald-700' :
                            margin.profitMargin >= 15 ? 'bg-amber-100 text-amber-700' :
                            'bg-red-100 text-red-700'
                          }`}>
                          {margin.profitMargin.toFixed(0)}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {activeTab === 'analysis' && (
          <>
            {/* Sales by Hour */}
            {data?.salesByHour && data.salesByHour.length > 0 && (
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                <h2 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
                  <Icons.clock className="w-5 h-5 text-slate-400" />
                  Vendas por Horário
                </h2>
                <div className="space-y-2">
                  {data.salesByHour.map(item => {
                    const maxTotal = Math.max(...data.salesByHour.map(h => h.total))
                    const percentage = maxTotal ? (item.total / maxTotal) * 100 : 0
                    return (
                      <div key={item.hour} className="flex items-center gap-3">
                        <span className="text-xs text-slate-500 w-12">{item.hour.toString().padStart(2, '0')}:00</span>
                        <div className="flex-1 h-6 bg-slate-100 rounded-full overflow-hidden relative">
                          <div 
                            className="h-full bg-gradient-to-r from-emerald-400 to-emerald-500 rounded-full transition-all"
                            style={{ width: `${percentage}%` }}
                          />
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-medium text-slate-600">
                            {item.count} vendas
                          </span>
                        </div>
                        <span className="text-xs font-medium text-slate-700 w-20 text-right">{formatCurrency(item.total)}</span>
                      </div>
                    )
                  })}
                </div>
                <div className="mt-4 pt-4 border-t border-slate-100">
                  <p className="text-sm text-slate-500">
                    <span className="font-medium text-slate-700">Horário de pico: </span>
                    {data.salesByHour.reduce((max, h) => h.total > max.total ? h : max, data.salesByHour[0]).hour}:00
                  </p>
                </div>
              </div>
            )}

            {/* Quick Stats */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
                    <Icons.trendUp className="w-4 h-4 text-emerald-600" />
                  </div>
                </div>
                <p className="text-2xl font-bold text-slate-800">{currentReport?.totalSales || 0}</p>
                <p className="text-xs text-slate-500">Total de vendas</p>
              </div>
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center">
                    <Icons.stock className="w-4 h-4 text-violet-600" />
                  </div>
                </div>
                <p className="text-2xl font-bold text-slate-800">{currentReport?.totalItems || 0}</p>
                <p className="text-xs text-slate-500">Itens vendidos</p>
              </div>
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
                    <Icons.star className="w-4 h-4 text-amber-600" />
                  </div>
                </div>
                <p className="text-2xl font-bold text-slate-800">{formatCurrency(currentReport?.averageTicket || 0)}</p>
                <p className="text-xs text-slate-500">Ticket médio</p>
              </div>
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center">
                    <Icons.losses className="w-4 h-4 text-red-600" />
                  </div>
                </div>
                <p className="text-2xl font-bold text-slate-800">{data?.outOfStock?.length || 0}</p>
                <p className="text-xs text-slate-500">Produtos em falta</p>
              </div>
            </div>

            {/* Insights */}
            <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-5 text-white">
              <h2 className="font-semibold mb-4 flex items-center gap-2">
                <Icons.help className="w-5 h-5 text-slate-400" />
                Insights
              </h2>
              <div className="space-y-3 text-sm">
                {currentMostSold && (
                  <p className="text-slate-300">
                    🏆 <span className="text-white font-medium">{currentMostSold.product.name}</span> é seu produto mais vendido com {currentMostSold.totalQuantity} unidades
                  </p>
                )}
                {data?.outOfStock && data.outOfStock.length > 0 && (
                  <p className="text-slate-300">
                    ⚠️ Você tem <span className="text-red-400 font-medium">{data.outOfStock.length} produtos</span> em falta que precisam de reposição
                  </p>
                )}
                {data?.salesByHour && data.salesByHour.length > 0 && (
                  <p className="text-slate-300">
                    ⏰ Seu horário de pico é às <span className="text-white font-medium">
                      {data.salesByHour.reduce((max, h) => h.total > max.total ? h : max, data.salesByHour[0]).hour}:00
                    </span>
                  </p>
                )}
                {data?.profitMargins && data.profitMargins.length > 0 && (
                  <p className="text-slate-300">
                    💰 Margem média de lucro: <span className="text-emerald-400 font-medium">
                      {(data.profitMargins.reduce((sum, m) => sum + m.profitMargin, 0) / data.profitMargins.length).toFixed(0)}%
                    </span>
                  </p>
                )}
              </div>
            </div>
          </>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
