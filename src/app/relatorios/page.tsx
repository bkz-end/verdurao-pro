'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ReportService, SalesReport, MostSoldProduct, ProductProfitMargin, ReportPeriod, ProductSalesData } from '@/lib/reports'
import { Product } from '@/types'
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
}

export default function RelatoriosPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedPeriod, setSelectedPeriod] = useState<ReportPeriod>('day')
  const [tenantId, setTenantId] = useState<string | null>(null)

  useEffect(() => {
    loadTenantAndData()
  }, [])

  useEffect(() => {
    if (tenantId) {
      loadDashboardData(tenantId)
    }
  }, [selectedPeriod, tenantId])

  async function loadTenantAndData() {
    try {
      setLoading(true)
      setError(null)

      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setError('Usuário não autenticado')
        return
      }

      const { data: storeUser } = await supabase
        .from('store_users')
        .select('tenant_id')
        .eq('email', user.email)
        .single()

      if (!storeUser) {
        setError('Usuário não vinculado a uma loja')
        return
      }

      setTenantId(storeUser.tenant_id)
      await loadDashboardData(storeUser.tenant_id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar dados')
    } finally {
      setLoading(false)
    }
  }

  const handleRefresh = useCallback(async () => {
    if (!tenantId || refreshing) return
    setRefreshing(true)
    try {
      await loadDashboardData(tenantId)
    } finally {
      setRefreshing(false)
    }
  }, [tenantId, refreshing])

  async function loadDashboardData(tid: string) {
    try {
      const supabase = createClient()
      const reportService = new ReportService(supabase)
      
      const [dashboardReport, mostSoldWeek, mostSoldMonth, topProducts, profitMargins] = await Promise.all([
        reportService.getDashboardReport(tid),
        reportService.getMostSoldProduct(tid, 'week'),
        reportService.getMostSoldProduct(tid, 'month'),
        reportService.getTopSellingProducts(tid, selectedPeriod, 5),
        reportService.getProductProfitMargins(tid)
      ])

      setData({
        ...dashboardReport,
        mostSoldWeek,
        mostSoldMonth,
        topProducts,
        profitMargins
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar relatórios')
    }
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
  }

  const currentReport = selectedPeriod === 'day' 
    ? data?.today 
    : selectedPeriod === 'week' 
      ? data?.week 
      : data?.month

  const currentMostSold = selectedPeriod === 'day'
    ? data?.mostSoldToday
    : selectedPeriod === 'week'
      ? data?.mostSoldWeek
      : data?.mostSoldMonth

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Icons.loader className="w-8 h-8 text-emerald-600 animate-spin" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <Icons.losses className="w-12 h-12 text-red-400 mx-auto mb-3" />
          <p className="text-red-600">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition-colors">
              <Icons.chevronLeft className="w-5 h-5 text-slate-600" />
            </Link>
            <h1 className="text-lg font-semibold text-slate-800">Relatórios</h1>
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition-colors disabled:opacity-50"
          >
            <Icons.loader className={`w-5 h-5 text-slate-600 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 space-y-6">
        {/* Period Filter */}
        <div className="flex gap-2">
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
                  : 'bg-white text-slate-600 border border-slate-200'
                }`}
            >
              {period.label}
            </button>
          ))}
        </div>

        {/* Main Stats */}
        <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl p-5 text-white">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-emerald-100 text-sm">Receita Total</p>
              <p className="text-3xl font-bold tracking-tight">{formatCurrency(currentReport?.totalRevenue || 0)}</p>
            </div>
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
              <Icons.dollar className="w-6 h-6" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/20">
            <div>
              <p className="text-emerald-100 text-sm">Vendas</p>
              <p className="text-xl font-bold">{currentReport?.totalSales || 0}</p>
            </div>
            <div>
              <p className="text-emerald-100 text-sm">Ticket Médio</p>
              <p className="text-xl font-bold">{formatCurrency(currentReport?.averageTicket || 0)}</p>
            </div>
          </div>
        </div>

        {/* Most Sold Product */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <Icons.star className="w-5 h-5 text-amber-500" />
            <h2 className="font-semibold text-slate-800">Mais Vendido</h2>
          </div>
          {currentMostSold ? (
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-slate-800">{currentMostSold.product.name}</p>
                <p className="text-sm text-slate-500">SKU: {currentMostSold.product.sku}</p>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-emerald-600">
                  {currentMostSold.totalQuantity} {currentMostSold.product.unit}
                </p>
                <p className="text-sm text-slate-500">{formatCurrency(currentMostSold.totalRevenue)}</p>
              </div>
            </div>
          ) : (
            <p className="text-slate-400 text-center py-4">Nenhuma venda no período</p>
          )}
        </div>

        {/* Top Products */}
        {data?.topProducts && data.topProducts.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
              <Icons.trendUp className="w-5 h-5 text-emerald-500" />
              <h2 className="font-semibold text-slate-800">Top 5 Produtos</h2>
            </div>
            <div className="divide-y divide-slate-100">
              {data.topProducts.map((product, index) => (
                <div key={product.productId} className="px-5 py-3 flex items-center gap-3">
                  <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold
                    ${index === 0 ? 'bg-amber-100 text-amber-700' :
                      index === 1 ? 'bg-slate-100 text-slate-600' :
                      index === 2 ? 'bg-orange-100 text-orange-700' :
                      'bg-slate-50 text-slate-400'
                    }`}>
                    {index + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-800 truncate">{product.productName}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-slate-800">{product.totalQuantity.toFixed(1)}</p>
                    <p className="text-xs text-slate-500">{formatCurrency(product.totalRevenue)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Out of Stock Alert */}
        {data?.outOfStock && data.outOfStock.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-red-200 flex items-center gap-2">
              <Icons.losses className="w-5 h-5 text-red-500" />
              <h2 className="font-semibold text-red-800">Produtos em Falta ({data.outOfStock.length})</h2>
            </div>
            <div className="divide-y divide-red-100 max-h-48 overflow-y-auto">
              {data.outOfStock.map(product => (
                <div key={product.id} className="px-5 py-3 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-red-800">{product.name}</p>
                    <p className="text-sm text-red-600">SKU: {product.sku}</p>
                  </div>
                  <span className="px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs font-medium">
                    Sem estoque
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Profit Margins */}
        {data?.profitMargins && data.profitMargins.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
              <Icons.reports className="w-5 h-5 text-emerald-500" />
              <h2 className="font-semibold text-slate-800">Margem de Lucro</h2>
            </div>
            <div className="divide-y divide-slate-100 max-h-64 overflow-y-auto">
              {data.profitMargins.slice(0, 10).map(margin => (
                <div key={margin.productId} className="px-5 py-3 flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-800 truncate">{margin.productName}</p>
                    <p className="text-xs text-slate-500">
                      {formatCurrency(margin.costPrice)} → {formatCurrency(margin.price)}
                    </p>
                  </div>
                  <div className="text-right ml-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-bold
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
      </main>

      <BottomNav />
    </div>
  )
}
